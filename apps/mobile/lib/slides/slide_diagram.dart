import 'package:flutter/material.dart';

import '../models/deck.dart';
import '../theme/med_tokens.dart';
import 'slide_view.dart';

/// Ported from `src/components/Diagram.tsx`.
///
/// Diagrams are laid out deterministically from the model's nodes — no image
/// generation, no cost, and the same geometry drives the PowerPoint export.
/// A diagram that disagrees between the phone and the .pptx is a bug in
/// whichever one drifted.
class SlideDiagram extends StatelessWidget {
  const SlideDiagram({super.key, required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    if (slide.nodes.isEmpty) return const SizedBox.shrink();

    final diagram = switch (slide.layout) {
      SlideLayout.mecanismo => _Mechanism(slide: slide),
      SlideLayout.fluxo => _Flow(nodes: slide.nodes),
      _ => _Cards(nodes: slide.nodes),
    };

    // Lay the diagram out at its natural height for the width it has been
    // given, then scale the whole thing down if that is taller than the slide.
    //
    // A diagram cannot reflow its way out of trouble the way a paragraph can:
    // four branches plus an outcome need the height they need. On the web CSS
    // flex quietly compresses them; here the same content overflowed the box by
    // 25px, which is a red-and-yellow stripe across a slide in front of an
    // audience. Scaling keeps every node whole and legible.
    return LayoutBuilder(
      builder: (context, constraints) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.topCenter,
        child: SizedBox(width: constraints.maxWidth, child: diagram),
      ),
    );
  }
}

class _Palette {
  const _Palette(this.dark);

  final bool dark;

  Color get boxFill =>
      dark ? MedColors.paper.withValues(alpha: 0.06) : MedColors.paper;
  Color get boxLine =>
      dark ? MedColors.paper.withValues(alpha: 0.25) : MedColors.rule;
  Color get heading => dark ? MedColors.paperRaised : MedColors.clinicalDeep;
  Color get body => dark
      ? MedColors.paper.withValues(alpha: 0.75)
      : MedColors.inkSoft;
  Color get accent => dark ? MedColors.paper : MedColors.clinical;
  Color get onAccent => dark ? MedColors.ink : MedColors.paperRaised;
  Color get line => dark
      ? MedColors.paper.withValues(alpha: 0.35)
      : MedColors.clinical.withValues(alpha: 0.4);
  Color get connector => dark
      ? const Color(0xFFF7F6F2).withValues(alpha: 0.55)
      : const Color(0xFF0D7A6F).withValues(alpha: 0.65);
}

class _NodeBox extends StatelessWidget {
  const _NodeBox({required this.node});

  final DiagramNode node;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final c = _Palette(m.dark);

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 1.9 * m.u, vertical: 1.5 * m.u),
      decoration: BoxDecoration(
        color: c.boxFill,
        border: Border.all(color: c.boxLine, width: 1),
        borderRadius: BorderRadius.circular(0.9 * m.u),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            node.heading,
            style: TextStyle(
              fontSize: 1.85 * m.u,
              height: 1.15,
              fontWeight: FontWeight.w600,
              color: c.heading,
            ),
          ),
          if (node.body != null) ...[
            SizedBox(height: 0.7 * m.u),
            Text(
              node.body!,
              style: TextStyle(
                fontSize: 1.5 * m.u,
                height: 1.35,
                color: c.body,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Connector with a visible head — the arrow is what makes it read as a flow.
class _Arrow extends StatelessWidget {
  const _Arrow({required this.down});

  final bool down;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final color = _Palette(m.dark).connector;
    return SizedBox(
      width: down ? 1.2 * m.u : 2.6 * m.u,
      height: down ? 2.6 * m.u : 1.2 * m.u,
      child: CustomPaint(painter: _ArrowPainter(down: down, color: color)),
    );
  }
}

class _ArrowPainter extends CustomPainter {
  const _ArrowPainter({required this.down, required this.color});

  final bool down;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..strokeWidth = size.shortestSide * 0.15
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final fill = Paint()..color = color;

    if (down) {
      final x = size.width / 2;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height * 0.65), stroke);
      final head = Path()
        ..moveTo(x, size.height)
        ..lineTo(x - size.width * 0.75, size.height * 0.65)
        ..lineTo(x + size.width * 0.75, size.height * 0.65)
        ..close();
      canvas.drawPath(head, fill);
    } else {
      final y = size.height / 2;
      canvas.drawLine(Offset(0, y), Offset(size.width * 0.65, y), stroke);
      final head = Path()
        ..moveTo(size.width, y)
        ..lineTo(size.width * 0.65, y - size.height * 0.75)
        ..lineTo(size.width * 0.65, y + size.height * 0.75)
        ..close();
      canvas.drawPath(head, fill);
    }
  }

  @override
  bool shouldRepaint(_ArrowPainter old) =>
      old.down != down || old.color != color;
}

/// Hub on the left, branches on the right, converging to an outcome.
class _Mechanism extends StatelessWidget {
  const _Mechanism({required this.slide});

  final Slide slide;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final c = _Palette(m.dark);
    final branches = slide.nodes.take(4).toList();

    // IntrinsicHeight because the row stretches its children to a common
    // height, and it is no longer given one — the diagram now lays out at its
    // natural size and is scaled to fit by its parent.
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (slide.hub != null) ...[
            SizedBox(
              width: 24 * m.u,
              child: Center(
                child: Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(
                    horizontal: 2 * m.u,
                    vertical: 2.2 * m.u,
                  ),
                  decoration: BoxDecoration(
                    color: m.dark
                        ? MedColors.paper.withValues(alpha: 0.10)
                        : MedColors.clinical.withValues(alpha: 0.07),
                    border: Border.all(
                      color: m.dark
                          ? MedColors.paper.withValues(alpha: 0.5)
                          : MedColors.clinical,
                      width: 0.25 * m.u,
                    ),
                    borderRadius: BorderRadius.circular(1.1 * m.u),
                  ),
                  child: Text(
                    slide.hub!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 2.1 * m.u,
                      height: 1.15,
                      fontWeight: FontWeight.w600,
                      color: c.heading,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(width: 1.4 * m.u),
            const Center(child: _Arrow(down: false)),
            SizedBox(width: 1.4 * m.u),
          ],
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Three branches in a two-column grid leave a hole; stack them.
                if (branches.length >= 4)
                  _Grid(
                    columns: 2,
                    gap: 1.3 * m.u,
                    children: [for (final node in branches) _NodeBox(node: node)],
                  )
                else
                  for (var i = 0; i < branches.length; i++)
                    Padding(
                      padding: EdgeInsets.only(
                        bottom: i == branches.length - 1 ? 0 : 1.3 * m.u,
                      ),
                      child: _NodeBox(node: branches[i]),
                    ),
                if (slide.outcome != null) ...[
                  SizedBox(height: 1.3 * m.u),
                  const Center(child: _Arrow(down: true)),
                  SizedBox(height: 1.3 * m.u),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: 2 * m.u,
                      vertical: 1.2 * m.u,
                    ),
                    decoration: BoxDecoration(
                      color: c.accent,
                      borderRadius: BorderRadius.circular(0.9 * m.u),
                    ),
                    child: Text(
                      slide.outcome!.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 1.95 * m.u,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.08 * 1.95 * m.u,
                        color: c.onAccent,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Ordered steps, left to right, with numbered chips and connectors.
class _Flow extends StatelessWidget {
  const _Flow({required this.nodes});

  final List<DiagramNode> nodes;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final c = _Palette(m.dark);
    final steps = nodes.take(5).toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 3.4 * m.u,
                  height: 3.4 * m.u,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: c.accent,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '${i + 1}',
                    style: TextStyle(
                      fontSize: 1.7 * m.u,
                      fontWeight: FontWeight.w600,
                      color: c.onAccent,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                SizedBox(height: 1.1 * m.u),
                _NodeBox(node: steps[i]),
              ],
            ),
          ),
          if (i < steps.length - 1) ...[
            SizedBox(width: 1 * m.u),
            Container(width: 2.2 * m.u, height: 0.22 * m.u, color: c.line),
            SizedBox(width: 1 * m.u),
          ],
        ],
      ],
    );
  }
}

/// Unordered parallel blocks.
class _Cards extends StatelessWidget {
  const _Cards({required this.nodes});

  final List<DiagramNode> nodes;

  @override
  Widget build(BuildContext context) {
    final m = SlideMetrics.of(context);
    final cards = nodes.take(6).toList();
    return Center(
      child: _Grid(
        columns: cards.length <= 4 ? 2 : 3,
        gap: 1.5 * m.u,
        children: [for (final node in cards) _NodeBox(node: node)],
      ),
    );
  }
}

/// A fixed-column grid whose rows size to their tallest cell.
///
/// `GridView` wants a fixed aspect ratio and `Wrap` will not stretch a row's
/// cells to a common height, which leaves cards of different text lengths
/// looking ragged — the thing the web's CSS grid gives for free.
class _Grid extends StatelessWidget {
  const _Grid({
    required this.columns,
    required this.gap,
    required this.children,
  });

  final int columns;
  final double gap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      final row = children.skip(start).take(columns).toList();
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < columns; i++) ...[
                if (i > 0) SizedBox(width: gap),
                Expanded(child: i < row.length ? row[i] : const SizedBox()),
              ],
            ],
          ),
        ),
      );
      if (start + columns < children.length) {
        rows.add(SizedBox(height: gap));
      }
    }
    return Column(mainAxisSize: MainAxisSize.min, children: rows);
  }
}
