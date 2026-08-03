import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../convex/convex_client.dart';
import '../convex/deck_api.dart';
import '../models/deck.dart';

/// Anonymous per-install identity, the phone's equivalent of the browser's
/// `getClientId()` in `src/lib/session.ts`.
///
/// It lives in the keychain rather than in preferences for one reason: on iOS
/// the keychain survives a reinstall, and this id *is* the user's ownership of
/// every deck they have made. There are no accounts. Lose it and the decks are
/// still on the server, permanently unreachable.
const _clientIdKey = 'medslides.clientId';

final _secureStorageProvider = Provider(
  (ref) => const FlutterSecureStorage(
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  ),
);

final clientIdProvider = FutureProvider<String>((ref) async {
  final storage = ref.watch(_secureStorageProvider);
  final existing = await storage.read(key: _clientIdKey);
  if (existing != null && existing.isNotEmpty) return existing;
  final fresh = const Uuid().v4();
  await storage.write(key: _clientIdKey, value: fresh);
  return fresh;
});

final convexProvider = FutureProvider<ConvexService>(
  (ref) => ConvexService.ensureInitialized(DeckApi.deploymentUrl),
);

final deckApiProvider = FutureProvider<DeckApi>((ref) async {
  final convex = await ref.watch(convexProvider.future);
  return DeckApi(convex);
});

/// Live list of this install's decks.
final myDecksProvider = StreamProvider<List<DeckSummary>>((ref) async* {
  final api = await ref.watch(deckApiProvider.future);
  final clientId = await ref.watch(clientIdProvider.future);

  final controller = StreamController<List<DeckSummary>>();
  final subscription = await api.watchMyDecks(
    clientId,
    onData: controller.add,
    onError: (message) => controller.addError(message),
  );
  ref.onDispose(() {
    subscription.cancel();
    controller.close();
  });
  yield* controller.stream;
});

/// Live view of one deck, including a generation in progress.
final deckProvider =
    StreamProvider.family<Deck?, String>((ref, deckId) async* {
  final api = await ref.watch(deckApiProvider.future);

  final controller = StreamController<Deck?>();
  final subscription = await api.watchDeck(
    deckId,
    onData: controller.add,
    onError: (message) => controller.addError(message),
  );
  ref.onDispose(() {
    subscription.cancel();
    controller.close();
  });
  yield* controller.stream;
});

/// Which slide the deck screen and the presenter are looking at. Shared so
/// leaving the presenter puts you back on the slide you were presenting.
final currentSlideProvider =
    StateProvider.family<int, String>((ref, deckId) => 0);

/// The composer's text, held here so dictation can write into it from the
/// button without the two widgets having to know about each other.
final composerProvider = StateProvider<String>((ref) => '');

/// Dictation partials are surfaced separately from the committed text: a
/// partial is a guess and gets replaced wholesale, so mixing it into the
/// composer's value would fight the user's own edits.
final dictationPartialProvider = StateProvider<String>((ref) => '');

@immutable
class GenerationRequest {
  const GenerationRequest({
    this.topic = '',
    this.audience = 'Residentes e internos',
    this.slideCount = 10,
    this.depth = 'panorama',
  });

  final String topic;
  final String audience;
  final int slideCount;
  final String depth;

  GenerationRequest copyWith({
    String? topic,
    String? audience,
    int? slideCount,
    String? depth,
  }) =>
      GenerationRequest(
        topic: topic ?? this.topic,
        audience: audience ?? this.audience,
        slideCount: slideCount ?? this.slideCount,
        depth: depth ?? this.depth,
      );

  /// Mirrors the server's own guard in `decks.start`, so an obviously short
  /// topic is refused before a round trip rather than after one.
  bool get isValid => topic.trim().length >= 8;
}

final generationRequestProvider =
    StateProvider<GenerationRequest>((ref) => const GenerationRequest());

/// Audiences offered in the form. Mirrors `AUDIENCES` in `src/lib/deck.ts`.
const audiences = [
  'Residentes e internos',
  'Colegas especialistas (congresso)',
  'Equipe multiprofissional',
  'Pacientes e familiares',
];
