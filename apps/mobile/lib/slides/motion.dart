import 'package:flutter/widgets.dart';

/// Screen-only motion, mirrored **by value** from `src/lib/motion.ts`.
///
/// Same trade as `MedColors` against `globals.css`: there is no shared
/// pipeline between a Web Animations engine and Flutter, so the numbers are
/// transcribed and the two files are read side by side. What is shared is the
/// vocabulary — `MOTION_PRESETS` in `src/lib/deck.ts` is the storage contract,
/// and a slide animated one way in the browser and another on the phone is a
/// bug in whichever drifted.
///
/// The presets were derived from a real specialist deck (ESC Cardio-Oncology
/// 2026, 32 slides) whose animation XML the web team read. The two facts worth
/// carrying over here: **17 of its 32 slides do not move at all**, which is why
/// `nenhuma` is a first-class preset rather than an afterthought; and Zoom
/// entrance outnumbered every other effect two to one, which is why `numero`
/// is its own preset.
///
/// Deliberately *not* ported: the shared-element hero morph. On the web it
/// measures two DOM trees and interpolates between them; doing that honestly
/// in Flutter needs real shared-element transitions, and a half-version that
/// blinks would be worse than the fade these presets already give. `heroi` and
/// `transformar` therefore render as their build, with `transformar` keeping
/// its hold so the pacing still reads as intended.
enum MotionPreset {
  nenhuma,
  suave,
  progressiva,
  heroi,
  numero,
  etapas,
  transformar,
  destacar;

  /// An unknown name falls back to the default rather than to no motion.
  ///
  /// A deck saved by a newer build carries preset names this build has never
  /// heard of. Treating those as `nenhuma` would make the presenter silently
  /// stop animating; `suave` gives the same slide roughly the right feel.
  /// Nothing here can fail closed onto missing content — the slide is fully
  /// rendered either way.
  static MotionPreset parse(Object? raw) {
    for (final value in MotionPreset.values) {
      if (value.name == raw) return value;
    }
    return MotionPreset.suave;
  }
}

/// Overall tempo, applied on top of whichever preset.
enum MotionPace {
  rapido(0.65),
  normal(1),
  solene(1.8);

  const MotionPace(this.factor);

  /// `solene` × `transformar` is 1.8 × 1200 ms = 2160 ms, which is the
  /// reference deck's `dur="2000"` morph. The default is deliberately faster:
  /// that deck is read from thirty metres at a congress, and the same two
  /// seconds a metre from a phone feels sluggish.
  final double factor;

  static MotionPace parse(Object? raw) {
    for (final value in MotionPace.values) {
      if (value.name == raw) return value;
    }
    return MotionPace.normal;
  }
}

/// The base units. One `stagger` is 80 ms, one `build` is 300 ms.
const _buildMs = 300;
const _staggerMs = 80;
const _moveMs = 420;

@immutable
class MotionRecipe {
  const MotionRecipe({
    required this.stagger,
    required this.build,
    required this.move,
    this.grow = false,
    this.zoom = false,
    this.pulse = false,
    this.hold = false,
  });

  /// Multiplies the gap between staged elements. 1 = 80 ms.
  final double stagger;

  /// Multiplies each element's own entrance. 1 = 300 ms.
  final double build;

  /// Multiplies the held pause on `transformar`. 1 = 420 ms.
  final double move;

  /// Staged elements also grow in slightly, not just rise.
  final bool grow;

  /// The big number zooms rather than rises.
  final bool zoom;

  /// One pulse on the key element after the build settles.
  final bool pulse;

  /// Nothing starts until the travel would have landed.
  final bool hold;
}

/// `null` means no motion at all — an early return rather than "a recipe with
/// everything off", so there is no code path that could leave a slide
/// half-built.
const Map<MotionPreset, MotionRecipe?> motionRecipes = {
  MotionPreset.nenhuma: null,

  /// The default, and what every deck made before this feature existed gets.
  MotionPreset.suave: MotionRecipe(stagger: 1, build: 1, move: 1),

  /// The reference deck's own pacing: 80 × 3.1 ≈ 250 ms apart, measured off
  /// its slide 3. For a slide whose bullets are the argument.
  MotionPreset.progressiva: MotionRecipe(stagger: 3.1, build: 1.6, move: 1),

  /// Identical to `suave` on the web too — the name exists so a doctor can
  /// *ask* for it and so the backend can refuse it on a layout with no hub,
  /// rather than silently doing nothing.
  MotionPreset.heroi: MotionRecipe(stagger: 1, build: 1, move: 1),

  /// Zoom entrance on the big number. Slightly wider stagger so the number is
  /// not still growing while its caption lands.
  MotionPreset.numero:
      MotionRecipe(stagger: 1.4, build: 1.2, move: 1, zoom: true),

  /// A protocol one step at a time: 80 × 4.4 ≈ 350 ms, slower than bullets
  /// because a step is a thing you wait for rather than read.
  MotionPreset.etapas:
      MotionRecipe(stagger: 4.4, build: 1.4, move: 1, grow: true),

  /// The rest of the slide holds until the travel would have landed.
  MotionPreset.transformar:
      MotionRecipe(stagger: 1, build: 1, move: 2.86, hold: true),

  /// A normal build, then one pulse on the key element after it settles.
  MotionPreset.destacar:
      MotionRecipe(stagger: 1, build: 1, move: 1, pulse: true),
};

/// A resolved preset plus its tempo.
@immutable
class MotionPlan {
  const MotionPlan({required this.preset, required this.pace});

  final MotionPreset preset;
  final MotionPace pace;

  static const still = MotionPlan(
    preset: MotionPreset.nenhuma,
    pace: MotionPace.normal,
  );

  MotionRecipe? get recipe => motionRecipes[preset];

  /// Parses the `animation` object off a slide. Both fields are stored as free
  /// strings on purpose — see the note in `convex/schema.ts` — so anything
  /// unrecognised resolves rather than throws.
  static MotionPlan parse(Object? raw) {
    if (raw is! Map) {
      return const MotionPlan(
        preset: MotionPreset.suave,
        pace: MotionPace.normal,
      );
    }
    return MotionPlan(
      preset: MotionPreset.parse(raw['preset']),
      pace: MotionPace.parse(raw['pace']),
    );
  }

  /// When element [index] starts, and how long its entrance runs.
  ({Duration delay, Duration duration}) timingFor(int index) {
    final r = recipe;
    if (r == null) return (delay: Duration.zero, duration: Duration.zero);
    final pace = this.pace.factor;
    final held = r.hold ? _moveMs * r.move * pace : 0;
    return (
      delay: Duration(
        milliseconds: (held + index * _staggerMs * r.stagger * pace).round(),
      ),
      duration: Duration(milliseconds: (_buildMs * r.build * pace).round()),
    );
  }

  /// Total time from slide entry until everything has settled, used to time
  /// the `destacar` pulse.
  Duration settleAfter(int elementCount) {
    final last = timingFor(elementCount > 0 ? elementCount - 1 : 0);
    return last.delay + last.duration;
  }
}
