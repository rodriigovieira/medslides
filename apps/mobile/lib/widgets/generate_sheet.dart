import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../dictation/dictation_button.dart';
import '../l10n/app_localizations.dart';
import '../l10n/labels.dart';
import '../screens/deck_screen.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';

/// Asking for a deck.
///
/// A sheet rather than a screen because it is one decision, and because the
/// keyboard and the microphone both want to be near the thumb. The topic field
/// is the only required answer — everything else has a sane default, and a
/// doctor with an idea in a corridor should be able to describe it and walk
/// away.
class GenerateSheet extends ConsumerStatefulWidget {
  const GenerateSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => const GenerateSheet(),
      );

  @override
  ConsumerState<GenerateSheet> createState() => _GenerateSheetState();
}

class _GenerateSheetState extends ConsumerState<GenerateSheet> {
  final _controller = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      ref.read(generationRequestProvider.notifier).update(
            (request) => request.copyWith(topic: _controller.text),
          );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final request = ref.read(generationRequestProvider);
    if (!request.isValid || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final api = await ref.read(deckApiProvider.future);
      final clientId = await ref.read(clientIdProvider.future);
      final deckId = await api.start(
        topic: request.topic.trim(),
        audience: request.audience,
        slideCount: request.slideCount,
        depth: request.depth,
        clientId: clientId,
      );
      if (!mounted) return;
      // Straight into the deck, which is already filling in. Watching it write
      // itself is the moment the product earns its keep; a spinner on this
      // sheet would hide exactly that.
      Navigator.of(context).pop();
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DeckScreen(deckId: deckId)),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _readable(error);
      });
    }
  }

  /// Convex wraps a thrown Error with its own framing; the sentence the backend
  /// wrote is the only part worth showing.
  String _readable(Object error) {
    final text = error.toString();
    final match = RegExp(r'Uncaught Error:\s*(.+)').firstMatch(text);
    return (match?.group(1) ?? text).split('\n').first.trim();
  }

  @override
  Widget build(BuildContext context) {
    final request = ref.watch(generationRequestProvider);
    final partial = ref.watch(dictationPartialProvider);

    // A dictation partial is a guess that gets replaced wholesale, so it is
    // shown next to the field rather than written into it — otherwise it fights
    // whatever the user is typing.
    final insets = MediaQuery.viewInsetsOf(context);
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MedSpace.gutter, 12, MedSpace.gutter, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: MedColors.rule,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                l10n.newDeck,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: true,
                      minLines: 3,
                      maxLines: 6,
                      maxLength: 600,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: l10n.topicHint,
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: DictationButton(controller: _controller),
                  ),
                ],
              ),
              if (partial.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    partial,
                    style: const TextStyle(
                      color: MedColors.inkFaint,
                      fontStyle: FontStyle.italic,
                      fontSize: 13,
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _Field(
                label: l10n.audienceLabel,
                child: DropdownButtonFormField<String>(
                  initialValue: request.audience,
                  isExpanded: true,
                  items: [
                    for (final audience in audiences)
                      DropdownMenuItem(
                        value: audience,
                        child: Text(l10n.audience(audience)),
                      ),
                  ],
                  onChanged: (value) => value == null
                      ? null
                      : ref
                          .read(generationRequestProvider.notifier)
                          .update((r) => r.copyWith(audience: value)),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _Field(
                      label: l10n.slidesLabel,
                      child: DropdownButtonFormField<int>(
                        initialValue: request.slideCount,
                        items: [
                          for (final n in const [6, 8, 10, 12, 15, 20])
                            DropdownMenuItem(value: n, child: Text('$n')),
                        ],
                        onChanged: (value) => value == null
                            ? null
                            : ref
                                .read(generationRequestProvider.notifier)
                                .update((r) => r.copyWith(slideCount: value)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _Field(
                      label: l10n.depthLabel,
                      child: DropdownButtonFormField<String>(
                        initialValue: request.depth,
                        items: [
                          DropdownMenuItem(
                            value: 'panorama',
                            child: Text(l10n.depthOverview),
                          ),
                          DropdownMenuItem(
                            value: 'aprofundado',
                            child: Text(l10n.depthDeep),
                          ),
                        ],
                        onChanged: (value) => value == null
                            ? null
                            : ref
                                .read(generationRequestProvider.notifier)
                                .update((r) => r.copyWith(depth: value)),
                      ),
                    ),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: MedColors.signal, fontSize: 13),
                ),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: request.isValid && !_busy ? _submit : null,
                  child: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: MedColors.paperRaised,
                          ),
                        )
                      : Text(l10n.generateDeck),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            color: MedColors.inkFaint,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
