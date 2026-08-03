import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medslides_mobile/models/deck.dart';
import 'package:medslides_mobile/slides/slide_view.dart';

void main() {
  // The renderer is the part most likely to break silently: a slide that
  // throws in front of an audience is unrecoverable, so every layout is at
  // least proven to build, including the shapes the parser can produce but the
  // model rarely does (a diagram with no nodes, a stat slide with no stat).
  testWidgets('every layout renders without throwing', (tester) async {
    for (final layout in SlideLayout.values) {
      final slide = Slide(
        layout: layout,
        title: 'Antibiótico na primeira hora reduz mortalidade',
        subtitle: 'Sepse na emergência',
        bullets: const ['Lactato e culturas', 'Antibiótico na 1ª hora'],
        stat: const Stat(value: '39%', label: 'redução do risco'),
        hub: 'Inibição de PD-1',
        nodes: const [
          DiagramNode(heading: 'Tumor expressa PD-L1', body: 'Escape imune'),
          DiagramNode(heading: 'Linfócito T'),
        ],
        outcome: 'Resposta antitumoral',
        left: const SlideColumn(heading: 'A favor', bullets: ['Rápido']),
        right: const SlideColumn(heading: 'Contra', bullets: ['Caro']),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SlideView(slide: slide, index: 0, total: 9),
          ),
        ),
      );
      expect(tester.takeException(), isNull, reason: 'layout ${layout.name}');
    }
  });

  test('an unknown layout degrades instead of throwing', () {
    // A deck written by a newer web build must still open on an older phone.
    final slide = Slide.parse({'layout': 'holograma', 'title': 'Futuro'});
    expect(slide.layout, SlideLayout.topicos);
  });

  test('an illustration never takes the full-bleed scrim', () {
    // Under the dark scrim a white-background illustration is a black
    // rectangle with a ghost in it.
    final slide = Slide.parse({
      'layout': 'capa',
      'title': 'Capa',
      'imageUrl': 'https://example.test/a.jpg',
      'imageStyle': 'ilustracao',
    });
    expect(slide.treatment, Treatment.panel);
  });
}
