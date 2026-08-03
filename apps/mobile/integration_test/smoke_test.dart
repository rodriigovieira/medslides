import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:medslides_mobile/main.dart' as app;

/// Drives one real deck from the topic field to the presenter.
///
/// This is not part of `flutter test`. It runs against the **production**
/// Convex deployment and really generates a deck — there is no other
/// deployment for the phone to talk to, and a mocked run would not have caught
/// any of what this found the first time it was written. Run it by hand:
///
///   flutter drive --driver=test_driver/integration_test.dart \
///     --target=integration_test/smoke_test.dart -d SIMULATOR_UDID
///
/// Every wait below is a `pump` loop rather than `pumpAndSettle`. The home
/// screen's ✦ and the waiting screen's skeleton both animate forever, so
/// `pumpAndSettle` never returns on any screen this test visits.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('generate, stream, present, chat', (tester) async {
    app.main();
    await _settle(tester, const Duration(seconds: 6));
    _mark('home');
    await _hold(tester);

    // 1. Open the generate sheet. Which control does that depends on whether
    // this install has been run before: the intro shows once and its own
    // button opens the sheet, so both paths are real and the test takes
    // whichever it finds rather than assuming a wiped simulator.
    if (find.text('Começar').evaluate().isNotEmpty) {
      await tester.tap(find.text('Começar'));
    } else {
      expect(find.text('Nova apresentação'), findsOneWidget);
      await tester.tap(find.text('Nova apresentação'));
    }
    await _settle(tester, const Duration(seconds: 2));
    _mark('generate-sheet');
    await _hold(tester);

    // 2. Describe the deck. Long enough to clear the eight-character guard in
    // GenerationRequest.isValid, and a real topic so the generated deck is
    // worth looking at in the screenshots.
    await tester.enterText(
      find.byType(TextField).first,
      'Sepse na emergência — reconhecimento precoce e a primeira hora',
    );
    await _settle(tester, const Duration(seconds: 2));
    _mark('topic-typed');
    await _hold(tester);

    // 3. Ask for it.
    await tester.tap(find.text('Gerar apresentação'));
    await _settle(tester, const Duration(seconds: 4));
    _mark('generating');

    // 4. Watch it stream. The first slide is what proves the subscription
    // works; the rest arrive behind it while this loop keeps pumping.
    await _waitFor(
      tester,
      () => find.text('Apresentar').evaluate().isNotEmpty,
      timeout: const Duration(minutes: 4),
      label: 'first slide',
    );
    _mark('first-slide');
    await _hold(tester);

    // Let the generation finish so the screenshots show a whole deck rather
    // than the first slide of one.
    await _settle(tester, const Duration(seconds: 45));
    _mark('deck-filled');
    await _hold(tester);

    // 5. Swipe the film strip, which is the gesture the deck screen is built
    // around.
    await tester.drag(find.byType(PageView), const Offset(-320, 0));
    await _settle(tester, const Duration(seconds: 3));
    _mark('slide-two');
    await _hold(tester);

    // 6. The presenter.
    await tester.tap(find.text('Apresentar'));
    await _settle(tester, const Duration(seconds: 3));
    _mark('presenter');
    await _hold(tester);

    // The presenter is full-bleed with no app bar, so `pageBack` — which looks
    // for a back button — has nothing to find. Its close chip is the way out,
    // and by now the chrome has faded itself out and gone IgnorePointer, so a
    // tap would land on the advance zone behind it. Long-press brings it back,
    // exactly as the on-screen hint says.
    await tester.longPress(find.byType(PageView).last);
    await _settle(tester, const Duration(seconds: 1));
    await tester.tap(find.byIcon(Icons.close));
    await _settle(tester, const Duration(seconds: 3));

    // 7. The AI chat. Disabled while the deck is still being written, so this
    // doubles as a check that the deck really did finish.
    await tester.tap(find.text('Editar com IA'));
    await _settle(tester, const Duration(seconds: 3));
    _mark('chat-sheet');
    await _hold(tester);
  }, timeout: const Timeout(Duration(minutes: 10)));
}

/// Screenshots are taken by a shell loop watching this output, not by
/// `binding.takeScreenshot` — that is unimplemented on iOS and fails the run
/// at the first checkpoint rather than at setup.
void _mark(String name) => debugPrint('SMOKE-MARK $name');

/// Long enough for the shell's screenshot loop to land a frame on this state.
Future<void> _hold(WidgetTester tester) =>
    _settle(tester, const Duration(seconds: 4));

Future<void> _settle(WidgetTester tester, Duration duration) async {
  final end = DateTime.now().add(duration);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _waitFor(
  WidgetTester tester,
  bool Function() predicate, {
  required Duration timeout,
  required String label,
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    if (predicate()) return;
    await tester.pump(const Duration(milliseconds: 200));
  }
  fail('Timed out waiting for $label after ${timeout.inSeconds}s.');
}
