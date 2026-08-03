import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show basicLocaleListResolution;
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

/// The language the user picked, or null for "follow the phone".
///
/// Kept beside the client id for the same reason: it is a preference about
/// this person, and losing it on reinstall would silently drop them back to
/// the phone's language mid-use.
const _localeKey = 'medslides.locale';

/// Every language the app is actually translated into. Portuguese first,
/// because Flutter falls back to the head of this list when the phone is set
/// to something we do not speak — and Portuguese is the language the slides
/// come back in, so it is the right thing to land on.
const supportedLocales = [Locale('pt'), Locale('en')];

final localePreferenceProvider =
    AsyncNotifierProvider<LocalePreference, Locale?>(LocalePreference.new);

class LocalePreference extends AsyncNotifier<Locale?> {
  @override
  Future<Locale?> build() async {
    final stored = await ref.watch(_secureStorageProvider).read(key: _localeKey);
    if (stored == null || stored.isEmpty) return null;
    return supportedLocales
        .where((locale) => locale.languageCode == stored)
        .firstOrNull;
  }

  /// Pass null to go back to following the phone.
  Future<void> choose(Locale? locale) async {
    final storage = ref.read(_secureStorageProvider);
    if (locale == null) {
      await storage.delete(key: _localeKey);
    } else {
      await storage.write(key: _localeKey, value: locale.languageCode);
    }
    state = AsyncData(locale);
  }
}

/// The language the app is actually showing, preference or phone.
///
/// Dictation reads this rather than the phone's locale: someone running the
/// app in Portuguese on an English phone was being transcribed as English,
/// which does not fail loudly — it produces confident nonsense.
final activeLocaleProvider = Provider<Locale>((ref) {
  final chosen = ref.watch(localePreferenceProvider).valueOrNull;
  if (chosen != null) return chosen;
  return basicLocaleListResolution(
    PlatformDispatcher.instance.locales,
    supportedLocales,
  );
});

/// What the speech recogniser should listen for. Region matters here in a way
/// it does not for the interface: `pt` alone leaves iOS to guess between
/// Brazilian and European Portuguese.
final dictationLocaleProvider = Provider<String>((ref) {
  return switch (ref.watch(activeLocaleProvider).languageCode) {
    'en' => 'en-US',
    _ => 'pt-BR',
  };
});

/// Whether the intro has already been read.
///
/// Stored beside the client id in the keychain rather than in preferences, and
/// therefore surviving a reinstall for the same reason the decks do: someone
/// reinstalling is not a new user, and re-explaining the product to them is
/// worse than showing them their decks.
const _introSeenKey = 'medslides.introSeen';

final introSeenProvider = FutureProvider<bool>((ref) async {
  final storage = ref.watch(_secureStorageProvider);
  return await storage.read(key: _introSeenKey) == 'true';
});

Future<void> markIntroSeen(WidgetRef ref) async {
  await ref
      .read(_secureStorageProvider)
      .write(key: _introSeenKey, value: 'true');
  ref.invalidate(introSeenProvider);
}

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
