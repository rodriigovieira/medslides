import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medslides_mobile/models/deck.dart';
import 'package:medslides_mobile/slides/motion.dart';
import 'package:medslides_mobile/slides/motion_scope.dart';

/// The recipe numbers are transcribed from `src/lib/motion.ts`, so the risk is
/// not that the arithmetic is wrong but that a number drifts from the web's.
/// These assert the values the web's own comments quote as measured off the
/// reference deck.
void main() {
  test('progressiva stages ~250 ms apart, as measured on the reference deck', () {
    const plan =
        MotionPlan(preset: MotionPreset.progressiva, pace: MotionPace.normal);
    final first = plan.timingFor(0);
    final second = plan.timingFor(1);
    expect(first.delay, Duration.zero);
    // 80 × 3.1 = 248 ms.
    expect((second.delay - first.delay).inMilliseconds, 248);
  });

  test('etapas waits ~350 ms per step', () {
    const plan =
        MotionPlan(preset: MotionPreset.etapas, pace: MotionPace.normal);
    // 80 × 4.4 = 352 ms.
    expect(plan.timingFor(1).delay.inMilliseconds, 352);
  });

  test('solene transformar matches the reference deck\'s 2 s morph', () {
    const plan =
        MotionPlan(preset: MotionPreset.transformar, pace: MotionPace.solene);
    // 420 × 2.86 × 1.8 = 2162 ms, the hold before anything else starts.
    expect(plan.timingFor(0).delay.inMilliseconds, 2162);
  });

  test('nenhuma costs nothing at all', () {
    const plan =
        MotionPlan(preset: MotionPreset.nenhuma, pace: MotionPace.normal);
    expect(plan.recipe, isNull);
    expect(plan.timingFor(3).delay, Duration.zero);
    expect(plan.timingFor(3).duration, Duration.zero);
  });

  test('pace scales the whole build', () {
    const normal =
        MotionPlan(preset: MotionPreset.suave, pace: MotionPace.normal);
    const quick =
        MotionPlan(preset: MotionPreset.suave, pace: MotionPace.rapido);
    expect(quick.timingFor(2).delay.inMilliseconds,
        (normal.timingFor(2).delay.inMilliseconds * 0.65).round());
  });

  _widgets();

  group('parsing', () {
    test('an unknown preset falls back to suave, never to nenhuma', () {
      // A deck saved by a newer build carries names this one has not heard of.
      // Falling back to nenhuma would make the presenter silently stop moving.
      final plan = MotionPlan.parse({'preset': 'holograma', 'pace': 'normal'});
      expect(plan.preset, MotionPreset.suave);
    });

    test('a missing animation is the default build', () {
      expect(MotionPlan.parse(null).preset, MotionPreset.suave);
      expect(MotionPlan.parse(null).pace, MotionPace.normal);
    });

    test('a slide carries its animation through Slide.parse', () {
      final slide = Slide.parse({
        'layout': 'destaque',
        'title': 'Sepse',
        'animation': {'preset': 'numero', 'pace': 'solene'},
      });
      expect(slide.motion.preset, MotionPreset.numero);
      expect(slide.motion.pace, MotionPace.solene);
    });

    test('every stored preset name resolves — the vocabulary is the contract',
        () {
      // These strings are the storage contract shared with MOTION_PRESETS in
      // src/lib/deck.ts. A rename on either side breaks decks made by the
      // other, so the whole list is asserted rather than a sample.
      const stored = [
        'nenhuma',
        'suave',
        'progressiva',
        'heroi',
        'numero',
        'etapas',
        'transformar',
        'destacar',
      ];
      for (final name in stored) {
        expect(MotionPreset.parse(name).name, name);
      }
      for (final pace in ['rapido', 'normal', 'solene']) {
        expect(MotionPace.parse(pace).name, pace);
      }
    });
  });
}

/// The arithmetic above is only half of it: these prove the widgets actually
/// hold an element back and then bring it in, which is the part a wrong
/// `didChangeDependencies` would silently skip while every number still
/// checked out.
void _widgets() {
  Widget harness({required MotionPlan plan, bool playing = true}) {
    return MediaQuery(
      data: const MediaQueryData(),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: MotionScope(
          plan: plan,
          playing: playing,
          child: Column(
            children: staged([
              const Text('first'),
              const Text('second'),
            ]),
          ),
        ),
      ),
    );
  }

  double opacityOf(WidgetTester tester, String text) {
    final opacity = tester.widget<Opacity>(
      find.ancestor(of: find.text(text), matching: find.byType(Opacity)).first,
    );
    return opacity.opacity;
  }

  testWidgets('a staged element is held back, then arrives', (tester) async {
    await tester.pumpWidget(harness(
      plan: const MotionPlan(
        preset: MotionPreset.progressiva,
        pace: MotionPace.normal,
      ),
    ));

    // Nothing has run yet: both elements start hidden, so a slide never
    // flashes its finished state before building.
    expect(opacityOf(tester, 'first'), 0);
    expect(opacityOf(tester, 'second'), 0);

    // A zero pump lets each element's scheduled start resolve; the entrances
    // themselves have not run yet.
    await tester.pump(Duration.zero);

    // The first element's own entrance is 300 × 1.6 = 480 ms. The second is
    // still on its way in, because it did not start until 248 ms in.
    // Thresholds rather than exact 1s: the assertion is about which element
    // has arrived and which has not, and pinning it to a frame boundary would
    // make it fail on rounding rather than on behaviour.
    await tester.pump(const Duration(milliseconds: 480));
    expect(opacityOf(tester, 'first'), greaterThan(0.95));
    expect(opacityOf(tester, 'second'), lessThan(0.95));

    await tester.pump(const Duration(milliseconds: 400));
    expect(opacityOf(tester, 'second'), greaterThan(0.95));
  });

  testWidgets('nenhuma renders the slide whole, with no Opacity at all',
      (tester) async {
    await tester.pumpWidget(harness(
      plan: const MotionPlan(
        preset: MotionPreset.nenhuma,
        pace: MotionPace.normal,
      ),
    ));
    expect(find.text('first'), findsOneWidget);
    expect(
      find.ancestor(of: find.text('first'), matching: find.byType(Opacity)),
      findsNothing,
    );
  });

  testWidgets('reduce motion delivers every slide whole and still',
      (tester) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: MotionScope(
            plan: const MotionPlan(
              preset: MotionPreset.progressiva,
              pace: MotionPace.normal,
            ),
            playing: true,
            child: Column(children: staged([const Text('first')])),
          ),
        ),
      ),
    );
    // The cheat sheet promises this in both languages. Without it the promise
    // is only kept on the web.
    expect(find.text('first'), findsOneWidget);
    expect(
      find.ancestor(of: find.text('first'), matching: find.byType(Opacity)),
      findsNothing,
    );
  });
}
