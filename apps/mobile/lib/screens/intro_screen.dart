import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../dictation/dictation_service.dart';
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
  String? _denied;

  Future<void> _askForMicrophone() async {
    setState(() {
      _asking = true;
      _denied = null;
    });
    final failure = await _dictation.authorize();
    if (!mounted) return;
    setState(() {
      _asking = false;
      _granted = failure == null;
      _denied = switch (failure) {
        null => null,
        DictationError.speechDenied =>
          'Sem reconhecimento de fala. Dá para liberar nos Ajustes depois.',
        DictationError.microphoneDenied =>
          'Sem microfone. Dá para liberar nos Ajustes depois.',
        DictationError.unavailable =>
          'Este aparelho não faz ditado. Digitar funciona igual.',
        DictationError.failed => 'Não consegui pedir agora. Tente depois.',
      };
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
                'Descreva o tema.\nEu monto os slides.',
                style: Theme.of(context).textTheme.displayLarge,
              ),
              const SizedBox(height: 18),
              const Text(
                'Escrevo os slides e as notas do apresentador, e busco as '
                'referências no PubMed. Nenhuma citação é inventada: sem artigo '
                'real, sem referência.',
                style: TextStyle(
                  fontSize: 16,
                  height: 1.5,
                  color: MedColors.inkSoft,
                ),
              ),
              const SizedBox(height: 28),
              _MicrophoneCard(
                asking: _asking,
                granted: _granted,
                denied: _denied,
                onAsk: _askForMicrophone,
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _begin,
                  child: const Text('Começar'),
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
    required this.denied,
    required this.onAsk,
  });

  final bool asking;
  final bool granted;
  final String? denied;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) {
    // Android has no dictation channel wired up, so offering it there would be
    // a button that can only fail.
    if (!DictationService().isSupported) return const SizedBox.shrink();

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
              const Expanded(
                child: Text(
                  'Falar em vez de digitar',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: MedColors.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'A transcrição acontece no próprio aparelho — o áudio não sai '
            'daqui, nem quando a frase cita um paciente.',
            style: TextStyle(fontSize: 13.5, height: 1.45, color: MedColors.inkSoft),
          ),
          if (denied != null) ...[
            const SizedBox(height: 8),
            Text(
              denied!,
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
                    ? 'Microfone liberado'
                    : asking
                        ? 'Aguardando…'
                        : 'Permitir microfone',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
