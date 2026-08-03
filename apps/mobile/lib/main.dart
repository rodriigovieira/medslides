import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/home_screen.dart';
import 'screens/intro_screen.dart';
import 'state/providers.dart';
import 'theme/med_theme.dart';
import 'theme/med_tokens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );
  runApp(const ProviderScope(child: MedSlidesApp()));
}

class MedSlidesApp extends StatelessWidget {
  const MedSlidesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MedSlides',
      debugShowCheckedModeBanner: false,
      theme: buildMedTheme(),
      color: MedColors.paper,
      home: const _Entry(),
    );
  }
}

/// Intro on a fresh install, the deck list on every launch after.
class _Entry extends ConsumerWidget {
  const _Entry();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(introSeenProvider).when(
          // A keychain read is fast but not instant, and a spinner here would
          // flash on every cold start. Paper is what both branches sit on, so
          // an empty page is invisible rather than a flicker.
          loading: () => const Scaffold(),
          error: (_, __) => const HomeScreen(),
          data: (seen) => seen ? const HomeScreen() : const IntroScreen(),
        );
  }
}
