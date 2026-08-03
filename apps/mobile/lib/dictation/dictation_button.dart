import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../theme/med_tokens.dart';
import 'dictation_service.dart';

/// Tap to talk.
///
/// The reason this is a primary input and not a convenience: describing a talk
/// out loud is how a doctor already thinks about it. Typing "sepse na
/// emergência — reconhecimento e primeira hora" on a phone keyboard between
/// patients is a chore; saying it is not.
///
/// Transcription is on-device (`SFSpeechRecognizer`, see
/// `ios/Runner/Dictation.swift`) — the audio never leaves the phone, which
/// matters when the sentence someone speaks might name a patient.
class DictationButton extends ConsumerStatefulWidget {
  const DictationButton({super.key, required this.controller});

  /// Committed text is written here; partials go to
  /// [dictationPartialProvider] so they never fight the user's own edits.
  final TextEditingController controller;

  @override
  ConsumerState<DictationButton> createState() => _DictationButtonState();
}

class _DictationButtonState extends ConsumerState<DictationButton> {
  final _service = DictationService();
  StreamSubscription<DictationResult>? _subscription;
  bool _listening = false;

  /// What the field held when dictation started. Each partial is a fresh guess
  /// at the *whole* utterance, so it replaces the last rather than appending —
  /// without this baseline the text multiplies as you speak.
  String _baseline = '';

  @override
  void initState() {
    super.initState();
    unawaited(_service.prepare());
  }

  @override
  void dispose() {
    _subscription?.cancel();
    unawaited(_service.cancel());
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_listening) {
      await _stop();
      return;
    }

    final failure = await _service.authorize();
    if (failure != null) {
      if (mounted) _complain(failure);
      return;
    }

    _baseline = widget.controller.text.trimRight();
    setState(() => _listening = true);

    _subscription = _service.start().listen(
      (result) {
        final joined =
            _baseline.isEmpty ? result.text : '$_baseline ${result.text}';
        if (result.isFinal) {
          ref.read(dictationPartialProvider.notifier).state = '';
          _write(joined);
          _baseline = joined;
        } else {
          ref.read(dictationPartialProvider.notifier).state = result.text;
        }
      },
      onError: (Object error) {
        if (!mounted) return;
        setState(() => _listening = false);
        _complain(DictationError.failed);
      },
      onDone: () {
        if (mounted) setState(() => _listening = false);
      },
    );
  }

  Future<void> _stop() async {
    await _service.stop();
    await _subscription?.cancel();
    _subscription = null;

    // The recogniser sometimes ends without promoting its last partial. Keep
    // it: the user said those words, and dropping them at the moment they tap
    // stop reads as the button having eaten their sentence.
    final partial = ref.read(dictationPartialProvider);
    if (partial.isNotEmpty) {
      _write(_baseline.isEmpty ? partial : '$_baseline $partial');
      ref.read(dictationPartialProvider.notifier).state = '';
    }
    if (mounted) setState(() => _listening = false);
  }

  void _write(String text) {
    widget.controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  void _complain(DictationError error) {
    final message = switch (error) {
      DictationError.speechDenied =>
        'Autorize o reconhecimento de fala nos Ajustes para ditar.',
      DictationError.microphoneDenied =>
        'Autorize o microfone nos Ajustes para ditar.',
      DictationError.unavailable => 'Ditado não está disponível neste aparelho.',
      DictationError.failed => 'Não consegui ouvir. Tente de novo.',
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Android has no equivalent wired up yet, so the button removes itself
    // rather than offering something that cannot work.
    if (!_service.isSupported) return const SizedBox.shrink();

    return SizedBox(
      width: MedSpace.tapTarget,
      height: MedSpace.tapTarget,
      child: IconButton.filled(
        onPressed: _toggle,
        tooltip: _listening ? 'Parar' : 'Ditar',
        style: IconButton.styleFrom(
          backgroundColor: _listening ? MedColors.signal : MedColors.clinical,
          foregroundColor: MedColors.paperRaised,
        ),
        icon: Icon(_listening ? Icons.stop_rounded : Icons.mic_none, size: 22),
      ),
    );
  }
}
