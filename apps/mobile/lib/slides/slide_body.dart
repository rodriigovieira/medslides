import 'package:flutter/material.dart';

import '../models/deck.dart';
import '../theme/med_tokens.dart';
import 'slide_diagram.dart';
import 'slide_view.dart';

/// The nine layouts, ported from the `switch` in `SlideView.tsx`'s `Body`.
/// Every size is the stylesheet's `cqw` number times `u`.
class SlideBody extends StatelessWidget {
  const SlideBody({super.key, required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);

    if (slide.layout.isDiagram) {
      // Deliberately not wrapped in [_Fitted]. A diagram is sized by its own
      // geometry rather than by how much text flowed, so it takes the real
      // height and fills it — `fit.ts` makes the same call, returning scale 1
      // for any slide with nodes. Wrapping it also breaks outright: FittedBox
      // hands its child unbounded height, and `Expanded` cannot live there.
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(slide: slide),
          SizedBox(height: 3 * m.u),
          Expanded(child: SlideDiagram(slide: slide)),
        ],
      );
    }

    return switch (slide.layout) {
      SlideLayout.capa => _Capa(slide: slide),
      SlideLayout.secao => _Secao(slide: slide),
      SlideLayout.destaque => _Destaque(slide: slide),
      SlideLayout.comparacao => _Comparacao(slide: slide),
      SlideLayout.encerramento => _Bullets(slide: slide, numbered: true),
      _ => _Bullets(slide: slide, numbered: false),
    };
  }
}

/// Shrinks the body until it fits.
///
/// The web has to *estimate* this — `fit.ts` predicts line counts, because CSS
/// cannot measure before it paints — and then stops at a 0.74 floor and lets
/// anything past that clip. Flutter measures for real, so there is no estimate
/// to be wrong and no need for the floor: the content always fits exactly.
/// Deliberately different from the web, and better; a slide that shrank a
/// little is recoverable, a slide with its last bullet cut off is not.
class _Fitted extends StatelessWidget {
  const _Fitted({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.topLeft,
      child: LayoutBuilder(
        builder: (context, constraints) => ConstrainedBox(
          // Give the child the slide's own width to lay out against, then let
          // FittedBox scale the result down. Without a bounded width the text
          // would lay out on one infinite line and scale to nothing.
          constraints: BoxConstraints(
            maxWidth: constraints.maxWidth.isFinite
                ? constraints.maxWidth
                : SlideMetrics.of(context).u * 100,
            minHeight: 0,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          slide.title,
          style: TextStyle(
            fontFamily: MedFonts.display,
            fontSize: 4.2 * m.u,
            height: 1.12,
            letterSpacing: -0.01 * 4.2 * m.u,
            color: m.dark ? MedColors.paperRaised : MedColors.ink,
          ),
        ),
        if (slide.subtitle != null) ...[
          SizedBox(height: 1.3 * m.u),
          Text(
            slide.subtitle!,
            style: TextStyle(
              fontSize: 2 * m.u,
              height: 1.35,
              color: m.dark
                  ? MedColors.paper.withValues(alpha: 0.7)
                  : MedColors.inkFaint,
            ),
          ),
        ],
      ],
    );
  }
}

class _Capa extends StatelessWidget {
  const _Capa({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: 2 * m.u),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Container(
            width: 11 * m.u,
            height: 0.9 * m.u,
            margin: EdgeInsets.only(bottom: 3.2 * m.u),
            color: m.dark ? MedColors.paper : MedColors.clinical,
          ),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: 80 * m.u),
            child: Text(
              slide.title,
              style: TextStyle(
                fontFamily: MedFonts.display,
                fontSize: 6.8 * m.u,
                height: 1.02,
                letterSpacing: -0.015 * 6.8 * m.u,
                color: m.dark ? MedColors.paperRaised : MedColors.ink,
              ),
            ),
          ),
          if (slide.subtitle != null) ...[
            SizedBox(height: 2.6 * m.u),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 62 * m.u),
              child: Text(
                slide.subtitle!,
                style: TextStyle(
                  fontSize: 2.5 * m.u,
                  height: 1.35,
                  color: m.dark
                      ? MedColors.paper.withValues(alpha: 0.85)
                      : MedColors.inkSoft,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Secao extends StatelessWidget {
  const _Secao({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 72 * m.u),
          child: Text(
            slide.title,
            style: TextStyle(
              fontFamily: MedFonts.display,
              fontSize: 5.8 * m.u,
              height: 1.06,
              letterSpacing: -0.015 * 5.8 * m.u,
              color: m.dark ? MedColors.paperRaised : MedColors.ink,
            ),
          ),
        ),
        if (slide.subtitle != null) ...[
          SizedBox(height: 2.4 * m.u),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: 60 * m.u),
            child: Text(
              slide.subtitle!,
              style: TextStyle(
                fontSize: 2.3 * m.u,
                height: 1.35,
                color: m.dark
                    ? MedColors.paper.withValues(alpha: 0.85)
                    : MedColors.inkSoft,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Destaque extends StatelessWidget {
  const _Destaque({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final muted = m.dark
        ? MedColors.paper.withValues(alpha: 0.85)
        : MedColors.inkSoft;
    final faint = m.dark
        ? MedColors.paper.withValues(alpha: 0.65)
        : MedColors.inkFaint;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 62 * m.u),
          child: Text(
            slide.title.toUpperCase(),
            style: TextStyle(
              fontSize: 2.1 * m.u,
              height: 1.35,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.16 * 2.1 * m.u,
              color: faint,
            ),
          ),
        ),
        if (slide.stat != null) ...[
          SizedBox(height: 1.6 * m.u),
          Text(
            slide.stat!.value,
            style: TextStyle(
              fontFamily: MedFonts.display,
              fontSize: 13 * m.u,
              height: 0.92,
              letterSpacing: -0.02 * 13 * m.u,
              color: m.dark ? MedColors.paperRaised : MedColors.ink,
            ),
          ),
          SizedBox(height: 1.8 * m.u),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: 58 * m.u),
            child: Text(
              slide.stat!.label,
              style: TextStyle(fontSize: 2.7 * m.u, height: 1.35, color: muted),
            ),
          ),
        ],
        if (slide.bullets.isNotEmpty) ...[
          SizedBox(height: 2.8 * m.u),
          for (final bullet in slide.bullets)
            Padding(
              padding: EdgeInsets.only(bottom: 1.1 * m.u),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 58 * m.u),
                child: Text(
                  bullet,
                  style: TextStyle(
                    fontSize: 2 * m.u,
                    height: 1.35,
                    color: muted,
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _Comparacao extends StatelessWidget {
  const _Comparacao({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);

    return _Fitted(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(slide: slide),
          SizedBox(height: 3.6 * m.u),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _ComparisonColumn(column: slide.left)),
                SizedBox(width: 4.5 * m.u),
                Expanded(child: _ComparisonColumn(column: slide.right)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ComparisonColumn extends StatelessWidget {
  const _ComparisonColumn({required this.column});

  final SlideColumn? column;

  @override
  Widget build(BuildContext context) {
    final col = column;
    if (col == null) return const SizedBox.shrink();
    final m = SlideMetrics.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          height: 0.4 * m.u,
          width: double.infinity,
          color: m.dark ? MedColors.paper : MedColors.clinical,
        ),
        SizedBox(height: 1.6 * m.u),
        Text(
          col.heading,
          style: TextStyle(
            fontSize: 2.3 * m.u,
            height: 1.35,
            fontWeight: FontWeight.w600,
            color: m.dark ? MedColors.paperRaised : MedColors.clinicalDeep,
          ),
        ),
        SizedBox(height: 1.8 * m.u),
        for (final bullet in col.bullets)
          Padding(
            padding: EdgeInsets.only(bottom: 1.3 * m.u),
            child: Text(
              bullet,
              style: TextStyle(
                fontSize: 1.95 * m.u,
                height: 1.35,
                color: m.dark
                    ? MedColors.paper.withValues(alpha: 0.85)
                    : MedColors.inkSoft,
              ),
            ),
          ),
      ],
    );
  }
}

/// `topicos` and `encerramento`. The only difference is the marker: a dot, or
/// a serif ordinal in the signal colour.
class _Bullets extends StatelessWidget {
  const _Bullets({required this.slide, required this.numbered});

  final Slide slide;
  final bool numbered;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final gap = numbered ? 2.0 : 1.9;
    final size = 2.3 * m.u;

    return _Fitted(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(slide: slide),
          SizedBox(height: 3.4 * m.u),
          for (var i = 0; i < slide.bullets.length; i++)
            Padding(
              padding: EdgeInsets.only(
                bottom: i == slide.bullets.length - 1 ? 0 : gap * m.u,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (numbered)
                    Padding(
                      padding: EdgeInsets.only(top: 0.5 * m.u),
                      child: Text(
                        (i + 1).toString().padLeft(2, '0'),
                        style: TextStyle(
                          fontFamily: MedFonts.display,
                          fontSize: 2.4 * m.u,
                          height: 1,
                          color: MedColors.signal,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    )
                  else
                    Container(
                      margin: EdgeInsets.only(top: 1.1 * m.u),
                      width: 0.7 * m.u,
                      height: 0.7 * m.u,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: m.dark
                            ? MedColors.paper.withValues(alpha: 0.8)
                            : MedColors.clinical,
                      ),
                    ),
                  SizedBox(width: 1.8 * m.u),
                  Flexible(
                    child: Text(
                      slide.bullets[i],
                      style: TextStyle(
                        fontSize: size,
                        height: 1.35,
                        color: numbered
                            ? (m.dark ? MedColors.paperRaised : MedColors.ink)
                            : (m.dark
                                ? MedColors.paper.withValues(alpha: 0.85)
                                : MedColors.inkSoft),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
