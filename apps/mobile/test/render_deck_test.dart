import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medslides_mobile/models/deck.dart';
import 'package:medslides_mobile/slides/slide_view.dart';

/// Renders a real production deck to PNG, one file per slide.
///
/// The nine layouts exist in four places now — `deck.ts`, `SlideView.tsx`,
/// `pptx.ts` and `lib/slides/` — and the phone's copy is the one nobody looks
/// at, because it takes a simulator and a signed build to see it. This makes it
/// look-at-able: run the test, open the PNGs, compare against the browser.
///
///   flutter test test/render_deck_test.dart
///   open build/slides/
void main() {
  testWidgets('renders a production deck to PNG', (tester) async {
    final raw = File('test/fixtures_deck.json').readAsStringSync();
    final deck = Deck.parse(jsonDecode(raw) as Map<String, dynamic>)!;

    final out = Directory('build/slides')..createSync(recursive: true);
    tester.view.devicePixelRatio = 2.0;
    tester.view.physicalSize = const Size(1600, 900);
    addTearDown(tester.view.reset);

    for (var i = 0; i < deck.slides.length; i++) {
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(
            backgroundColor: const Color(0xFFF7F6F2),
            body: Center(
              child: RepaintBoundary(
                key: key,
                child: SizedBox(
                  width: 800,
                  child: SlideView(
                    slide: deck.slides[i],
                    index: i,
                    total: deck.slides.length,
                    deck: deck,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      // Not pumpAndSettle: the slides carry Image.network, whose future never
      // completes under the test harness, so settling waits forever. Photos are
      // absent from these renders by design — this proves the *layout*, and the
      // photo path is exercised on a real device.
      await tester.pump(const Duration(milliseconds: 400));

      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final layout = deck.slides[i].layout.name;
      File('${out.path}/${(i + 1).toString().padLeft(2, '0')}-$layout.png')
          .writeAsBytesSync(bytes!.buffer.asUint8List());

      // A slide that overflows in front of an audience is unrecoverable, so
      // this is an assertion and not just a screenshot run.
      expect(tester.takeException(), isNull, reason: 'slide ${i + 1} ($layout)');
    }

    // ignore: avoid_print
    print('wrote ${deck.slides.length} slides to ${out.path}');
  });
}
