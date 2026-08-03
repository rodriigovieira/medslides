import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/home_screen.dart';
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
      home: const HomeScreen(),
    );
  }
}
