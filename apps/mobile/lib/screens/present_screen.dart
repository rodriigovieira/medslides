import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../slides/slide_view.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';

/// Presenting.
///
/// Landscape, full-bleed, chrome hidden until asked for. Three rules earn their
/// keep here, all of them about the fact that someone is standing in front of a
/// room and cannot debug anything:
///
///  - the screen must not sleep;
///  - a tap on the right half advances, the left half goes back, because
///    reaching for a small control while talking is a stumble;
///  - notes are one tap away and never on screen by accident.
class PresentScreen extends ConsumerStatefulWidget {
  const PresentScreen({super.key, required this.deckId});

  final String deckId;

  @override
  ConsumerState<PresentScreen> createState() => _PresentScreenState();
}

class _PresentScreenState extends ConsumerState<PresentScreen> {
  late PageController _controller;
  bool _chrome = true;

  @override
  void initState() {
    super.initState();
    _controller = PageController(
      initialPage: ref.read(currentSlideProvider(widget.deckId)),
    );
    WakelockPlus.enable();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    // The chrome introduces itself and then gets out of the way, so the first
    // thing on screen is the slide rather than a row of buttons.
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (mounted) setState(() => _chrome = false);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    WakelockPlus.disable();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deck = ref.watch(deckProvider(widget.deckId)).valueOrNull;
    if (deck == null || deck.slides.isEmpty) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final index = ref
        .watch(currentSlideProvider(widget.deckId))
        .clamp(0, deck.slides.length - 1);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: deck.slides.length,
            onPageChanged: (i) => ref
                .read(currentSlideProvider(widget.deckId).notifier)
                .state = i,
            itemBuilder: (context, i) => Center(
              child: SlideView(
                slide: deck.slides[i],
                index: i,
                total: deck.slides.length,
                deck: deck,
              ),
            ),
          ),

          // Tap zones sit above the page view so a tap advances instead of
          // being swallowed, but they are deliberately *behind* the chrome so
          // the visible controls still win when they are showing.
          Positioned.fill(
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () => _move(-1, deck.slides.length),
                    onLongPress: () => setState(() => _chrome = !_chrome),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () => _move(1, deck.slides.length),
                    onLongPress: () => setState(() => _chrome = !_chrome),
                  ),
                ),
              ],
            ),
          ),

          AnimatedOpacity(
            opacity: _chrome ? 1 : 0,
            duration: const Duration(milliseconds: 220),
            child: IgnorePointer(
              ignoring: !_chrome,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _Chip(
                            icon: Icons.close,
                            onTap: () => Navigator.of(context).pop(),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.55),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '${index + 1} / ${deck.slides.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ),
                          const Spacer(),
                          _Chip(
                            icon: Icons.sticky_note_2_outlined,
                            onTap: () => _showNotes(
                              context,
                              deck.slides[index].notes,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      const Text(
                        'Toque nas laterais para avançar · segure para os controles',
                        style: TextStyle(color: Colors.white54, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _move(int delta, int total) {
    final next = (_controller.page ?? 0).round() + delta;
    if (next < 0 || next >= total) return;
    _controller.animateToPage(
      next,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _showNotes(BuildContext context, String? notes) {
    showModalBottomSheet(
      context: context,
      backgroundColor: MedColors.paperRaised,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(MedSpace.gutter),
        child: SingleChildScrollView(
          child: Text(
            notes ?? 'Sem notas neste slide.',
            style: const TextStyle(
              height: 1.55,
              fontSize: 16,
              color: MedColors.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.55),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: MedSpace.tapTarget,
          height: MedSpace.tapTarget,
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}
