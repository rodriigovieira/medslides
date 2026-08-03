import 'dart:convert';

import 'package:convex_flutter/convex_flutter.dart';

/// Thin wrapper over the Convex client, carrying the arg convention the
/// patched `convex_flutter` in `packages/` expects:
///   - query / subscribe args are `Map<String,String>`, each value `jsonEncode`d
///   - mutation and action args are `Map<String,dynamic>` (encoded internally)
/// Results come back as JSON strings and are decoded here.
///
/// Lifted from Panda Code's `relay_client.dart`, which has been through this
/// already — including the singleton race below, which is not theoretical: two
/// widgets initialising at once is the normal case on a cold start.
class ConvexService {
  ConvexService(this._client);

  final ConvexClient _client;

  static Future<ConvexService>? _initializing;

  static Future<ConvexService> _initialize(String deploymentUrl) async {
    await ConvexClient.initialize(
      ConvexConfig(deploymentUrl: deploymentUrl, clientId: 'medslides-mobile'),
    );
    return ConvexService(ConvexClient.instance);
  }

  /// Initialise, or reuse the existing singleton. `ConvexClient` is
  /// process-wide, so a second `initialize` throws rather than replacing it.
  static Future<ConvexService> ensureInitialized(String deploymentUrl) async {
    final url = deploymentUrl.trim();
    try {
      final existing = ConvexClient.instance;
      if (existing.config.deploymentUrl == url) return ConvexService(existing);
      ConvexClient.resetInstance();
    } on StateError {
      // Not initialised yet.
    }

    final inFlight = _initializing;
    if (inFlight != null) return inFlight;

    final init = _initialize(url);
    _initializing = init;
    try {
      return await init;
    } on StateError catch (error) {
      // Another caller may have initialised between the optimistic check above
      // and `initialize`. Reuse it only if it really exists.
      if (error.message == 'ConvexClient already initialized') {
        return ConvexService(ConvexClient.instance);
      }
      rethrow;
    } finally {
      if (identical(_initializing, init)) _initializing = null;
    }
  }

  static void reset() {
    _initializing = null;
    ConvexClient.resetInstance();
  }

  Map<String, String> _encode(Map<String, dynamic> args) => {
        for (final entry in args.entries)
          if (entry.value != null) entry.key: jsonEncode(entry.value),
      };

  dynamic _decode(String json) => json.isEmpty ? null : jsonDecode(json);

  Future<dynamic> query(String name, Map<String, dynamic> args) async =>
      _decode(await _client.query(name, _encode(args)));

  Future<dynamic> mutation(String name, Map<String, dynamic> args) async =>
      _decode(await _client.mutation(name: name, args: args));

  Future<dynamic> action(String name, Map<String, dynamic> args) async =>
      _decode(await _client.action(name: name, args: args));

  /// Live subscription. This is the whole reason the app talks Convex rather
  /// than polling an HTTP endpoint: a deck being generated writes itself into
  /// the document slide by slide, and the phone watches it fill in exactly as
  /// the browser does.
  Future<ConvexSubscription> subscribe(
    String name,
    Map<String, dynamic> args, {
    required void Function(dynamic value) onData,
    void Function(String message)? onError,
  }) async {
    final handle = await _client.subscribe(
      name: name,
      args: _encode(args),
      onUpdate: (json) => onData(_decode(json)),
      onError: (message, _) => onError?.call(message),
    );
    return ConvexSubscription(handle);
  }
}

class ConvexSubscription {
  ConvexSubscription(this._handle);

  final SubscriptionHandle _handle;

  void cancel() => _handle.cancel();
}
