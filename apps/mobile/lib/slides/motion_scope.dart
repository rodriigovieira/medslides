import 'package:flutter/material.dart';

import 'motion.dart';

/// Carries the slide's motion plan down to the elements that stage on it.
///
/// An inherited widget rather than a constructor argument threaded through
/// nine layouts: most elements do not care, and the ones that do are nested
/// several widgets deep inside layouts that were ported to match the web's
/// structure, not to pass animation state around.
///
/// Absent — which is the case everywhere except the presenter — [MotionChild]
/// renders its child plainly. That is deliberate: the deck screen's little
/// preview and the PNG render test both want the finished slide, not a slide
/// mid-build, and neither should have to opt out of anything.
class MotionScope extends InheritedWidget {
  const MotionScope({
    super.key,
    required this.plan,
    required this.playing,
    required super.child,
  });

  final MotionPlan plan;

  /// False while the slide is off-screen in the page view. Elements start from
  /// their hidden state and only run when the slide is the one being looked
  /// at, so a presenter who swipes back sees the build again rather than a
  /// slide that already played to an empty room.
  final bool playing;

  static MotionScope? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<MotionScope>();

  @override
  bool updateShouldNotify(MotionScope old) =>
      old.plan.preset != plan.preset ||
      old.plan.pace != plan.pace ||
      old.playing != playing;
}

/// Wraps a layout's children so they arrive in reading order.
///
/// Written as a list transform rather than as an edit to each of the nine
/// layouts: the layouts were ported to match `SlideView.tsx`'s structure line
/// for line, and threading an incrementing counter through them by hand would
/// both bury that correspondence and be wrong the first time someone inserts
/// an element in the middle.
///
/// Pure spacers do not consume an index — they are invisible, and letting them
/// take a slot would silently double every stagger gap.
///
/// [statAt] marks the child that `numero` should zoom instead of rise, and
/// [keyAt] the one `destacar` pulses; both are positions in [children].
List<Widget> staged(
  List<Widget> children, {
  int? statAt,
  int? keyAt,
}) {
  var index = 0;
  return [
    for (var i = 0; i < children.length; i++)
      if (children[i] is SizedBox)
        children[i]
      else
        MotionChild(
          index: index++,
          isStat: i == statAt,
          isKeyElement: i == keyAt,
          child: children[i],
        ),
  ];
}

/// One staged element of a slide.
///
/// [index] is its position in the build order — reading order, which is the
/// order the web stages in too. Elements that should arrive together share an
/// index.
class MotionChild extends StatefulWidget {
  const MotionChild({
    super.key,
    required this.index,
    required this.child,
    this.isKeyElement = false,
    this.isStat = false,
  });

  final int index;
  final Widget child;

  /// The element `destacar` pulses once, after the build settles.
  final bool isKeyElement;

  /// The big number `numero` zooms instead of rising.
  final bool isStat;

  @override
  State<MotionChild> createState() => _MotionChildState();
}

class _MotionChildState extends State<MotionChild>
    with TickerProviderStateMixin {
  AnimationController? _controller;
  AnimationController? _pulse;
  MotionPlan? _plan;
  bool _started = false;

  @override
  void dispose() {
    _controller?.dispose();
    _pulse?.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scope = MotionScope.of(context);

    // "Reduce Motion" in iOS accessibility settings means every slide is
    // simply there, whole and still. The web makes the same promise in the
    // motion cheat sheet's list of limits, and a promise about accessibility
    // that only one of the two surfaces keeps is worse than not making it.
    final reduced = MediaQuery.disableAnimationsOf(context);

    // No scope, no recipe, or reduced motion: the slide is simply there.
    // Anything already built stays built rather than snapping back to hidden.
    if (scope == null || scope.plan.recipe == null || reduced) {
      _controller?.dispose();
      _controller = null;
      _plan = null;
      _started = false;
      return;
    }

    final plan = scope.plan;
    final timing = plan.timingFor(widget.index);
    if (_plan?.preset != plan.preset || _plan?.pace != plan.pace) {
      _controller?.dispose();
      _controller = AnimationController(vsync: this, duration: timing.duration);
      _plan = plan;
      _started = false;
    }

    if (scope.playing && !_started) {
      _started = true;
      _run(timing.delay);
    } else if (!scope.playing) {
      _started = false;
      _controller?.value = 0;
      _pulse?.stop();
    }
  }

  Future<void> _run(Duration delay) async {
    final controller = _controller;
    if (controller == null) return;
    await Future<void>.delayed(delay);
    if (!mounted || controller != _controller) return;
    await controller.forward();

    if (!mounted || !widget.isKeyElement) return;
    if (_plan?.recipe?.pulse != true) return;
    _pulse ??= AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    // One pulse, after the build has settled — never a loop. A key element
    // that keeps throbbing behind a speaker is the failure mode this preset
    // is trying to avoid.
    await _pulse!.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return widget.child;

    final recipe = _plan?.recipe;
    final zooms = recipe?.zoom == true && widget.isStat;
    final grows = recipe?.grow == true;

    return AnimatedBuilder(
      animation: Listenable.merge([controller, _pulse]),
      child: widget.child,
      builder: (context, child) {
        final t = Curves.easeOutCubic.transform(controller.value);

        // Zoom entrance for the stat, a short rise for everything else — the
        // reference deck's two commonest effects, and the reason `numero`
        // exists as a preset at all.
        final scale = zooms
            ? 0.82 + 0.18 * t
            : grows
                ? 0.96 + 0.04 * t
                : 1.0;
        final rise = zooms ? 0.0 : (1 - t) * 14;

        final pulse = _pulse;
        final pulseScale = pulse == null || !pulse.isAnimating
            ? 1.0
            : 1 + 0.05 * _pulseCurve(pulse.value);

        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, rise),
            child: Transform.scale(scale: scale * pulseScale, child: child),
          ),
        );
      },
    );
  }

  /// Up and back down once: 0 → 1 → 0 over the pulse's life.
  double _pulseCurve(double v) =>
      v < 0.5 ? Curves.easeOut.transform(v * 2) : Curves.easeIn.transform((1 - v) * 2);
}
