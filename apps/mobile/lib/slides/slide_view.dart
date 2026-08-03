import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../models/deck.dart';
import '../theme/med_tokens.dart';
import 'slide_body.dart';

/// One slide, drawn to match `src/components/SlideView.tsx`.
///
/// The web sizes everything in `cqw` — percent of the slide's own width — so a
/// single component serves the thumbnail, the editor and the projector. That
/// idea ports exactly: [SlideMetrics.of] hands every child a `u` equal to one
/// percent of the slide width, and each size below is the same number as the
/// stylesheet's, times `u`. Read them side by side; they are meant to match
/// line for line.
///
/// Anything that reads as a magic number here almost certainly has a twin in
/// `SlideView.tsx`, `Diagram.tsx` or `pptx.ts`. Change one, change all three —
/// screen, phone and PowerPoint are supposed to be the same picture.
class SlideView extends StatelessWidget {
  const SlideView({
    super.key,
    required this.slide,
    required this.index,
    required this.total,
    this.deck,
  });

  final Slide slide;
  final int index;
  final int total;

  /// Needed only to resolve the slide's reference numbers into real articles.
  final Deck? deck;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final u = constraints.maxWidth / 100;
          final treatment = slide.treatment;
          final dark = slide.isDark;
          final cited = deck?.citedOn(slide) ?? const <Reference>[];

          // The citation strip is real content, not decoration: reserve its
          // height so body text can never flow underneath it. Mirrors `footer`
          // in fit.ts.
          final footer = cited.isNotEmpty ? 5.4 : 2.6;

          return SlideMetrics(
            u: u,
            dark: dark,
            child: ClipRect(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(
                    color: dark ? MedColors.inkDeep : MedColors.paperRaised,
                  ),
                  if (treatment == Treatment.full) _FullBleed(slide: slide),
                  if (treatment == Treatment.panel) _Panel(slide: slide, u: u),
                  Padding(
                    padding: EdgeInsets.only(
                      left: 7 * u,
                      right: (treatment == Treatment.panel ? 46 : 7) * u,
                      top: 6.5 * u,
                      bottom: (6.5 + footer - 2.6) * u,
                    ),
                    child: SlideBody(slide: slide),
                  ),
                  if (slide.layout != SlideLayout.capa)
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Container(
                        width: 15 * u,
                        height: 0.85 * u,
                        color: dark ? MedColors.paper : MedColors.clinical,
                      ),
                    ),
                  _Footer(
                    slide: slide,
                    index: index,
                    total: total,
                    cited: cited,
                    treatment: treatment,
                    u: u,
                    dark: dark,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Carries the slide's own unit down the tree, so a nested widget can size
/// itself against the slide rather than against the screen. Without it every
/// layout would need the width threaded through it by hand.
class SlideMetrics extends InheritedWidget {
  const SlideMetrics({
    super.key,
    required this.u,
    required this.dark,
    required super.child,
  });

  /// One `cqw`: a hundredth of the slide's width.
  final double u;
  final bool dark;

  static SlideMetrics of(BuildContext context) {
    final metrics =
        context.dependOnInheritedWidgetOfExactType<SlideMetrics>();
    assert(metrics != null, 'SlideMetrics is only available inside a SlideView');
    return metrics!;
  }

  @override
  bool updateShouldNotify(SlideMetrics oldWidget) =>
      u != oldWidget.u || dark != oldWidget.dark;
}

class _FullBleed extends StatelessWidget {
  const _FullBleed({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        _SlideImage(url: slide.imageUrl!, fit: BoxFit.cover),
        DecoratedBox(decoration: BoxDecoration(gradient: _scrim(slide.layout))),
      ],
    );
  }
}

/// Mirrors `scrimFor` in `src/lib/compose.ts`.
///
/// A directional gradient works when the text sits on one side. Where the
/// content spans the whole slide it cannot: whichever end the gradient lightens
/// is an end with text on it, so those layouts get a near-flat scrim instead.
LinearGradient _scrim(SlideLayout layout) {
  if (layout == SlideLayout.capa) {
    return const LinearGradient(
      begin: Alignment.bottomCenter,
      end: Alignment.topCenter,
      stops: [0, 0.34, 0.7, 1],
      colors: [
        Color.fromRGBO(8, 16, 24, 0.94),
        Color.fromRGBO(8, 16, 24, 0.72),
        Color.fromRGBO(8, 16, 24, 0.30),
        Color.fromRGBO(8, 16, 24, 0.18),
      ],
    );
  }
  if (layout.coversCanvas) {
    return const LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      stops: [0, 0.5, 1],
      colors: [
        Color.fromRGBO(8, 16, 24, 0.92),
        Color.fromRGBO(8, 16, 24, 0.86),
        Color.fromRGBO(8, 16, 24, 0.92),
      ],
    );
  }
  return const LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    stops: [0, 0.45, 1],
    colors: [
      Color.fromRGBO(8, 16, 24, 0.90),
      Color.fromRGBO(8, 16, 24, 0.74),
      Color.fromRGBO(8, 16, 24, 0.44),
    ],
  );
}

class _Panel extends StatelessWidget {
  const _Panel({required this.slide, required this.u});

  final Slide slide;
  final double u;

  @override
  Widget build(BuildContext context) {
    final illustration = slide.isIllustration;

    return Positioned(
      top: 0,
      bottom: 0,
      right: 0,
      width: 41 * u,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (illustration) const ColoredBox(color: MedColors.paperRaised),
          // A photograph bleeds off the panel; an illustration is a whole
          // object, so cropping it to fill would eat the margins it was drawn
          // with. `multiply` then drops its white against the page — the model
          // only ever returns JPEG, so there is no alpha to rely on.
          if (illustration)
            Padding(
              padding: EdgeInsets.all(3 * u),
              child: _BlendMask(
                blendMode: BlendMode.multiply,
                child: _SlideImage(url: slide.imageUrl!, fit: BoxFit.contain),
              ),
            )
          else
            _SlideImage(url: slide.imageUrl!, fit: BoxFit.cover),
          if (!illustration)
            Positioned(
              top: 0,
              bottom: 0,
              left: 0,
              width: 9 * u,
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    stops: [0, 0.55, 1],
                    colors: [
                      MedColors.paperRaised,
                      Color(0x8CFFFEFB),
                      Color(0x00FFFEFB),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SlideImage extends StatelessWidget {
  const _SlideImage({required this.url, required this.fit});

  final String url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      url,
      fit: fit,
      // A missing photo must never take the slide down with it. The deck is
      // still perfectly presentable without it, and a broken-image glyph in
      // front of a lecture theatre is worse than no picture at all.
      errorBuilder: (context, error, stack) => const SizedBox.shrink(),
      frameBuilder: (context, child, frame, wasSync) => AnimatedOpacity(
        opacity: frame == null ? 0 : 1,
        duration: const Duration(milliseconds: 180),
        child: child,
      ),
    );
  }
}

/// Draws [child] into its own layer so a blend mode composites it against
/// what is already painted, rather than against transparent black.
///
/// Flutter has no `mix-blend-mode`. `Image(color:, colorBlendMode:)` blends a
/// colour *into* the image, which is the opposite of what the white-background
/// illustration needs.
class _BlendMask extends SingleChildRenderObjectWidget {
  const _BlendMask({required this.blendMode, required Widget super.child});

  final BlendMode blendMode;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderBlendMask(blendMode);

  @override
  void updateRenderObject(BuildContext context, _RenderBlendMask renderObject) {
    renderObject.blendMode = blendMode;
  }
}

class _RenderBlendMask extends RenderProxyBox {
  _RenderBlendMask(this._blendMode);

  BlendMode _blendMode;

  set blendMode(BlendMode value) {
    if (_blendMode == value) return;
    _blendMode = value;
    markNeedsPaint();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    context.canvas.saveLayer(offset & size, Paint()..blendMode = _blendMode);
    super.paint(context, offset);
    context.canvas.restore();
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.slide,
    required this.index,
    required this.total,
    required this.cited,
    required this.treatment,
    required this.u,
    required this.dark,
  });

  final Slide slide;
  final int index;
  final int total;
  final List<Reference> cited;
  final Treatment treatment;
  final double u;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final faint = dark
        ? MedColors.paper.withValues(alpha: 0.55)
        : MedColors.inkFaint;

    return Stack(
      children: [
        if (cited.isNotEmpty)
          Positioned(
            left: 7 * u,
            bottom: 2.6 * u,
            width: 62 * u,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final ref in cited)
                  Padding(
                    padding: EdgeInsets.only(bottom: 0.3 * u),
                    child: Text(
                      '${ref.n}. ${ref.line} PMID ${ref.pmid}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 1.25 * u,
                        height: 1.15,
                        color: faint,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        if (slide.layout != SlideLayout.capa)
          Positioned(
            // With a photo panel on the right, the page number has to stay in
            // the text column — over the photo it is unreadable.
            right: (treatment == Treatment.panel ? 44 : 7) * u,
            bottom: 3.2 * u,
            child: Text(
              '${index + 1} / $total',
              style: TextStyle(
                fontSize: 1.45 * u,
                color: faint,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        // Generated art is labelled on the slide itself. An invented image
        // presented as a photograph to a room of doctors is a different thing
        // from one they can see was made by a model.
        if (slide.isGeneratedImage)
          Positioned(
            left: 7 * u,
            bottom: 0.9 * u,
            child: Text(
              '✦ ${Slide.aiCredit}',
              style: TextStyle(fontSize: 1.05 * u, color: faint),
            ),
          ),
      ],
    );
  }
}
