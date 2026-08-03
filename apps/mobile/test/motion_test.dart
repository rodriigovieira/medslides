import 'package:flutter_test/flutter_test.dart';
import 'package:medslides_mobile/models/deck.dart';
import 'package:medslides_mobile/slides/motion.dart';

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
