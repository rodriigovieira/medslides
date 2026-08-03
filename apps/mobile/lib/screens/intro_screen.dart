import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../dictation/dictation_service.dart';
import '../l10n/app_localizations.dart';
import '../l10n/labels.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';
import '../widgets/generate_sheet.dart';

/// The one screen a new install sees.
///
/// It exists for two reasons. An empty list and a `+` says nothing about what
/// the app will do with a topic, and — the one that actually matters — the
/// microphone and speech-recognition prompts otherwise arrive as two bare
/// system dialogs the instant someone taps the mic, with no explanation of why
/// a slide tool wants to listen. Asked here, next to the sentence about the
/// audio staying on the device, they are answerable.
///
/// "Começar" opens the topic field directly rather than dropping the user on
/// the empty list to find the button themselves: one tap from here to typing,
/// because the person holding the phone is between patients.
class IntroScreen extends ConsumerStatefulWidget {
  const IntroScreen({super.key});

  @override
  ConsumerState<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends ConsumerState<IntroScreen> {
  final _dictation = DictationService();

  bool _asking = false;
  bool _granted = false;

  /// The failure itself, not its sentence: the wording is looked up at build
  /// time so switching language re-renders it instead of leaving the message
  /// frozen in whichever language it was denied in.
  DictationError? _failure;

  Future<void> _askForMicrophone() async {
    setState(() {
      _asking = true;
      _failure = null;
    });
    final failure = await _dictation.authorize();
    if (!mounted) return;
    setState(() {
      _asking = false;
      _granted = failure == null;
      _failure = failure;
    });
  }

  Future<void> _begin() async {
    // Open the sheet first and mark the intro seen behind it. The other order
    // races: marking it swaps HomeScreen in under this screen, and if that
    // rebuild lands before the push, this State is unmounted, `context` is
    // defunct and the tap does nothing at all — dropping the user on exactly
    // the empty list this screen exists to skip past.
    //
    // The swap still happens, just underneath the open sheet, so closing the
    // sheet lands on the deck list rather than back here.
    final sheet = GenerateSheet.show(context);
    await markIntroSeen(ref);
    await sheet;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            MedSpace.gutter,
            MedSpace.gutter,
            MedSpace.gutter,
            24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              // The cover slide's rule, so the first thing on screen is the
              // same mark the first slide will open with.
              Container(width: 64, height: 5, color: MedColors.clinical),
              const SizedBox(height: 26),
              Text(
                l10n.introTitle,
                style: Theme.of(context).textTheme.displayLarge,
              ),
              const SizedBox(height: 18),
              Text(
                l10n.introBody,
                style: const TextStyle(
                  fontSize: 16,
                  height: 1.5,
                  color: MedColors.inkSoft,
                ),
              ),
              const SizedBox(height: 28),
              _MicrophoneCard(
                asking: _asking,
                granted: _granted,
                failure: _failure,
                onAsk: _askForMicrophone,
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _begin,
                  child: Text(l10n.start),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MicrophoneCard extends StatelessWidget {
  const _MicrophoneCard({
    required this.asking,
    required this.granted,
    required this.failure,
    required this.onAsk,
  });

  final bool asking;
  final bool granted;
  final DictationError? failure;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) {
    // Android has no dictation channel wired up, so offering it there would be
    // a button that can only fail.
    if (!DictationService().isSupported) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context)!;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: MedColors.paperRaised,
        border: Border.all(color: MedColors.rule),
        borderRadius: BorderRadius.circular(MedSpace.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                granted ? Icons.check_circle_outline : Icons.mic_none,
                size: 20,
                color: granted ? MedColors.clinical : MedColors.inkSoft,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.introMicTitle,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: MedColors.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            l10n.introMicBody,
            style: const TextStyle(
              fontSize: 13.5,
              height: 1.45,
              color: MedColors.inkSoft,
            ),
          ),
          if (failure != null) ...[
            const SizedBox(height: 8),
            Text(
              l10n.dictationProblemAtIntro(failure!),
              style: const TextStyle(fontSize: 13, color: MedColors.signal),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: granted || asking ? null : onAsk,
              child: Text(
                granted
                    ? l10n.micGranted
                    : asking
                        ? l10n.micAsking
                        : l10n.micAllow,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
