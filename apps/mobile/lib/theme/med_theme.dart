import 'package:flutter/material.dart';

import 'med_tokens.dart';

/// The app chrome's theme. Slides do **not** read from this — they carry their
/// own colours so a slide looks identical wherever it is drawn, including
/// inside a dark presentation view where the surrounding chrome is inverted.
ThemeData buildMedTheme() {
  const scheme = ColorScheme.light(
    primary: MedColors.clinical,
    onPrimary: MedColors.paperRaised,
    secondary: MedColors.clinicalDeep,
    onSecondary: MedColors.paperRaised,
    surface: MedColors.paperRaised,
    onSurface: MedColors.ink,
    error: MedColors.signal,
    onError: MedColors.paperRaised,
    outline: MedColors.rule,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: MedColors.paper,
    fontFamily: MedFonts.sans,
    splashFactory: InkSparkle.splashFactory,
  );

  return base.copyWith(
    textTheme: base.textTheme.copyWith(
      // The display face is reserved for slide titles and page headings; using
      // it for body text is what made the first pass read like a magazine
      // instead of a tool.
      displayLarge: const TextStyle(
        fontFamily: MedFonts.display,
        fontSize: 34,
        height: 1.08,
        color: MedColors.ink,
      ),
      headlineSmall: const TextStyle(
        fontFamily: MedFonts.display,
        fontSize: 24,
        height: 1.12,
        color: MedColors.ink,
      ),
      bodyLarge: const TextStyle(fontSize: 16, height: 1.45, color: MedColors.ink),
      bodyMedium: const TextStyle(fontSize: 14, height: 1.45, color: MedColors.inkSoft),
      bodySmall: const TextStyle(fontSize: 12.5, height: 1.4, color: MedColors.inkFaint),
      labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: MedColors.paper,
      foregroundColor: MedColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: MedFonts.display,
        fontSize: 21,
        color: MedColors.ink,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: MedColors.rule,
      thickness: 1,
      space: 1,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: MedColors.ink,
        foregroundColor: MedColors.paperRaised,
        minimumSize: const Size(0, MedSpace.tapTarget),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        textStyle: const TextStyle(
          fontFamily: MedFonts.sans,
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: MedColors.inkSoft,
        minimumSize: const Size(0, MedSpace.tapTarget),
        side: const BorderSide(color: MedColors.rule),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: MedColors.paperRaised,
      hintStyle: const TextStyle(color: MedColors.inkFaint),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        borderSide: const BorderSide(color: MedColors.rule),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        borderSide: const BorderSide(color: MedColors.rule),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        borderSide: const BorderSide(color: MedColors.clinical, width: 1.5),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: MedColors.paperRaised,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: MedColors.ink,
      contentTextStyle: const TextStyle(color: MedColors.paperRaised, fontSize: 14),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
      ),
    ),
  );
}
