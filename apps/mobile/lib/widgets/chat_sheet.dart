import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../dictation/dictation_button.dart';
import '../models/deck.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';

/// Editing the deck by asking.
///
/// The conversation lives on the deck document, not in this widget, so it is
/// the same history the web shows and it survives closing the sheet. Slide
/// changes arrive through the deck subscription rather than as a reply — by the
/// time the assistant's sentence appears, the slides behind the sheet have
/// already changed.
class ChatSheet extends ConsumerStatefulWidget {
  const ChatSheet({super.key, required this.deckId});

  final String deckId;

  static Future<void> show(BuildContext context, {required String deckId}) =>
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => ChatSheet(deckId: deckId),
      );

  @override
  ConsumerState<ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends ConsumerState<ChatSheet> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  bool _busy = false;
  String? _error;

  static const _suggestions = [
    'Adicione 3 slides sobre contraindicações',
    'No slide 4, enfatize a dose',
    'Troque a imagem do slide 2',
    'Gere uma ilustração para o slide 3',
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    final message = text.trim();
    if (message.isEmpty || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    _controller.clear();

    try {
      final api = await ref.read(deckApiProvider.future);
      final clientId = await ref.read(clientIdProvider.future);
      await api.chat(
        deckId: widget.deckId,
        clientId: clientId,
        message: message,
      );
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString().split('\n').first);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final deck = ref.watch(deckProvider(widget.deckId)).valueOrNull;
    final messages = deck?.chat ?? const <ChatMessage>[];
    final insets = MediaQuery.viewInsetsOf(context);

    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: MedColors.rule,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(MedSpace.gutter, 14, MedSpace.gutter, 10),
              child: Row(
                children: [
                  Text('✦ ', style: TextStyle(color: MedColors.clinical)),
                  Text(
                    'Editar com IA',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: MedColors.ink,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: _scroll,
                reverse: true,
                padding: const EdgeInsets.all(MedSpace.gutter),
                children: [
                  if (_busy)
                    const _Bubble(
                      text: 'Ajustando os slides…',
                      fromUser: false,
                      faded: true,
                    ),
                  for (final message in messages.reversed)
                    _Bubble(text: message.text, fromUser: message.isUser),
                  if (messages.isEmpty) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final suggestion in _suggestions)
                          OutlinedButton(
                            onPressed: () => _send(suggestion),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 36),
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              textStyle: const TextStyle(fontSize: 12.5),
                              shape: const StadiumBorder(),
                            ),
                            child: Text(suggestion),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Diga o que quer mudar e eu ajusto os slides — um slide, '
                      'vários, ou a imagem de um deles. Só mexo no que você pedir.',
                      style: TextStyle(color: MedColors.inkSoft, height: 1.5),
                    ),
                  ],
                ],
              ),
            ),
            if (_error != null)
              Container(
                width: double.infinity,
                color: MedColors.signal.withValues(alpha: 0.1),
                padding: const EdgeInsets.all(12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: MedColors.signal, fontSize: 12.5),
                ),
              ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 600,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Ex.: deixe o slide 4 mais curto',
                        counterText: '',
                      ),
                      onSubmitted: _send,
                    ),
                  ),
                  const SizedBox(width: 8),
                  DictationButton(controller: _controller),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: MedSpace.tapTarget,
                    height: MedSpace.tapTarget,
                    child: IconButton.filled(
                      onPressed: _busy ? null : () => _send(_controller.text),
                      style: IconButton.styleFrom(
                        backgroundColor: MedColors.ink,
                        foregroundColor: MedColors.paperRaised,
                      ),
                      icon: const Icon(Icons.arrow_upward, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.text,
    required this.fromUser,
    this.faded = false,
  });

  final String text;
  final bool fromUser;
  final bool faded;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: fromUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        decoration: BoxDecoration(
          color: fromUser ? MedColors.ink : MedColors.paper,
          border: fromUser ? null : Border.all(color: MedColors.rule),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          text,
          style: TextStyle(
            height: 1.45,
            fontSize: 14.5,
            color: fromUser
                ? MedColors.paperRaised
                : (faded ? MedColors.inkFaint : MedColors.inkSoft),
          ),
        ),
      ),
    );
  }
}
