import '../models/deck.dart';
import 'convex_client.dart';

/// The MedSlides backend, as the phone sees it.
///
/// Function names are strings because the Dart side has no generated bindings
/// against this deployment — the names are the contract. They match
/// `convex/decks.ts`, `convex/chat.ts`. A rename on the backend breaks the app
/// at runtime, not at compile time, which is the cost of not generating
/// bindings; the surface is small enough (seven calls) to be worth it.
class DeckApi {
  DeckApi(this._convex);

  final ConvexService _convex;

  /// Production deployment. The web app reads this from
  /// `NEXT_PUBLIC_CONVEX_URL`; the phone has no env at runtime, so it is
  /// compiled in and overridable at build time for pointing a debug build at
  /// the dev deployment:
  ///   flutter run --dart-define=MEDSLIDES_CONVEX_URL=https://….convex.cloud
  static const deploymentUrl = String.fromEnvironment(
    'MEDSLIDES_CONVEX_URL',
    defaultValue: 'https://ardent-wolf-30.convex.cloud',
  );

  /// The deck the user is about to watch being written.
  Future<String> start({
    required String topic,
    required String audience,
    required int slideCount,
    required String depth,
    required String clientId,
  }) async {
    final id = await _convex.mutation('decks:start', {
      'topic': topic,
      'audience': audience,
      'slideCount': slideCount,
      'depth': depth,
      'clientId': clientId,
    });
    if (id is! String) throw StateError('A apresentação não foi criada.');
    return id;
  }

  Future<List<DeckSummary>> listMine(String clientId) async {
    final raw = await _convex.query('decks:listMine', {'clientId': clientId});
    if (raw is! List) return const [];
    return raw.map(DeckSummary.parse).whereType<DeckSummary>().toList();
  }

  /// Live view of one deck. Cancel the returned subscription when the screen
  /// goes away — a leaked subscription keeps decoding slide payloads for a
  /// deck nobody is looking at.
  Future<ConvexSubscription> watchDeck(
    String deckId, {
    required void Function(Deck? deck) onData,
    void Function(String message)? onError,
  }) =>
      _convex.subscribe(
        'decks:get',
        {'deckId': deckId},
        onData: (raw) => onData(Deck.parse(raw)),
        onError: onError,
      );

  Future<ConvexSubscription> watchMyDecks(
    String clientId, {
    required void Function(List<DeckSummary> decks) onData,
    void Function(String message)? onError,
  }) =>
      _convex.subscribe(
        'decks:listMine',
        {'clientId': clientId},
        onData: (raw) => onData(
          raw is List
              ? raw.map(DeckSummary.parse).whereType<DeckSummary>().toList()
              : const [],
        ),
        onError: onError,
      );

  /// Deck-wide AI edit. Returns the assistant's reply; the slide changes arrive
  /// separately through the live subscription.
  Future<String> chat({
    required String deckId,
    required String clientId,
    required String message,
  }) async {
    final reply = await _convex.action('chat:send', {
      'deckId': deckId,
      'clientId': clientId,
      'message': message,
    });
    return reply is String ? reply : 'Pronto.';
  }

  /// Slide-scoped AI edit — the popover's equivalent.
  Future<String> editSlide({
    required String deckId,
    required String clientId,
    required int slideIndex,
    required String instruction,
  }) async {
    final reply = await _convex.action('chat:editOne', {
      'deckId': deckId,
      'clientId': clientId,
      'slideIndex': slideIndex,
      'instruction': instruction,
    });
    return reply is String ? reply : 'Pronto.';
  }

  /// Inline text edit, the same mutation the web workspace uses when you tap a
  /// bullet. Only text fields travel: the mutation merges them server-side so
  /// an edit can never drop the photo or the verified references.
  Future<void> editSlideText({
    required String deckId,
    required String clientId,
    required int slideIndex,
    required Map<String, dynamic> patch,
  }) =>
      _convex.mutation('decks:editSlide', {
        'deckId': deckId,
        'clientId': clientId,
        'slideIndex': slideIndex,
        'patch': patch,
      });

  /// Remaining generated-image budget, so the UI can say so before you ask.
  Future<({int used, int limit})> aiImageBudget(String clientId) async {
    final raw = await _convex.query('decks:aiImageBudget', {
      'clientId': clientId,
    });
    if (raw is! Map) return (used: 0, limit: 0);
    final used = raw['used'];
    final limit = raw['limit'];
    return (
      used: used is num ? used.toInt() : 0,
      limit: limit is num ? limit.toInt() : 0,
    );
  }
}
