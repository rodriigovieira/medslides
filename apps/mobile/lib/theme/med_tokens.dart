import 'package:flutter/material.dart';

/// The design tokens, mirrored by value from the web app's `@theme` block in
/// `src/app/globals.css`.
///
/// By value, and deliberately: there is no shared token pipeline between a
/// Tailwind stylesheet and a Flutter app, so these are transcribed. When a
/// colour changes on the web it has to change here too — the same trade the
/// platform-admin iOS app makes. The alternative (a generator for nine colours)
/// costs more than it saves.
///
/// A slide rendered here has to be recognisably the *same* slide the browser
/// draws, because the two are used interchangeably: build the deck on a laptop,
/// present it from a phone.
abstract final class MedColors {
  static const ink = Color(0xFF0E1B2A);
  static const inkSoft = Color(0xFF3C4A5A);
  static const inkFaint = Color(0xFF7D8896);

  static const paper = Color(0xFFF7F6F2);
  static const paperRaised = Color(0xFFFFFEFB);
  static const rule = Color(0xFFE2DED4);

  static const clinical = Color(0xFF0D7A6F);
  static const clinicalDeep = Color(0xFF085A52);
  static const signal = Color(0xFFC2603A);

  /// Background behind a full-bleed photo, and the scrim it is tinted with.
  /// Matches `bg-[#0a141e]` and the `rgba(8,16,24,…)` stops in `compose.ts`.
  static const inkDeep = Color(0xFF0A141E);
  static const scrim = Color(0xFF081018);

  /// Text over a dark slide. The web uses `text-paper/85` and friends; opacity
  /// is applied at the point of use rather than baked in here.
  static const onDark = paperRaised;
}

abstract final class MedFonts {
  /// Instrument Serif on the web. Titles only — it is the voice of the deck.
  static const display = 'InstrumentSerif';

  /// IBM Plex Sans on the web. Everything else.
  static const sans = 'IBMPlexSans';
}

/// Spacing and radii used by the app chrome (not by slides, which size
/// everything against their own width — see `SlideView`).
abstract final class MedSpace {
  static const gutter = 20.0;
  static const gap = 12.0;
  static const radius = 14.0;
  static const radiusSmall = 10.0;

  /// Anything tappable is at least this tall. A phone held up in a lecture
  /// theatre is being used one-handed and often in a hurry.
  static const tapTarget = 48.0;
}
