import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../dictation/dictation_button.dart';
import '../l10n/app_localizations.dart';
import '../models/deck.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';

/// Which slides an instruction is allowed to touch.
enum EditScope { slide, deck }

/// Editing by asking, at one of two scopes.
///
/// Both live in one sheet with one composer rather than two entry points on
/// the deck screen, because the distinction is about *reach*, not about a
/// different feature — and putting it on a segmented control says "only this
/// slide changes" far more plainly than a second button would. It also means
/// the dictation button is shared: whichever scope you are in, you can talk.
///
/// The two scopes are genuinely different calls. Deck-wide (`chat:send`)
/// appends to the conversation stored on the deck document, so it is the same
/// history the web shows and it survives closing the sheet. Slide-scoped
/// (`chat:editOne`) is a one-shot that returns a reply and writes nothing —
/// so its exchange is held here, and it is gone when the sheet closes.
///
/// In both cases the slide changes arrive through the deck subscription
/// rather than as a reply: by the time the assistant's sentence appears, the
/// slides behind the sheet have already changed.
class ChatSheet extends ConsumerStatefulWidget {
  const ChatSheet({
    super.key,
    required this.deckId,
    required this.slideIndex,
  });

  final String deckId;

  /// The slide the deck screen is showing — what "this slide" means.
  final int slideIndex;

  static Future<void> show(
    BuildContext context, {
    required String deckId,
    required int slideIndex,
  }) =>
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => ChatSheet(deckId: deckId, slideIndex: slideIndex),
      );

  @override
  ConsumerState<ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends ConsumerState<ChatSheet> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  EditScope _scope = EditScope.slide;
  bool _busy = false;
  String? _error;

  /// The slide-scoped exchange. Deck-wide messages come from the deck
  /// document instead — `chat:editOne` deliberately stores nothing, so
  /// without this the user's own instruction would vanish as they sent it.
  final _slideMessages = <ChatMessage>[];

  /// A message that exists only in this sheet. `at` is a real timestamp so it
  /// sorts alongside anything else, even though nothing persists it.
  ChatMessage _local(String text, String role) => ChatMessage(
        role: role,
        text: text,
        at: DateTime.now().millisecondsSinceEpoch,
      );

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    final message = text.trim();
    if (message.isEmpty || _busy) return;

    final slideScoped = _scope == EditScope.slide;
    setState(() {
      _busy = true;
      _error = null;
      if (slideScoped) {
        _slideMessages.add(_local(message, 'user'));
      }
    });
    _controller.clear();

    try {
      final api = await ref.read(deckApiProvider.future);
      final clientId = await ref.read(clientIdProvider.future);
      if (slideScoped) {
        final reply = await api.editSlide(
          deckId: widget.deckId,
          clientId: clientId,
          slideIndex: widget.slideIndex,
          instruction: message,
        );
        if (mounted) {
          setState(() => _slideMessages.add(_local(reply, 'assistant')));
        }
      } else {
        await api.chat(
          deckId: widget.deckId,
          clientId: clientId,
          message: message,
        );
      }
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
    final l10n = AppLocalizations.of(context)!;
    final deck = ref.watch(deckProvider(widget.deckId)).valueOrNull;
    final slideScoped = _scope == EditScope.slide;
    final messages =
        slideScoped ? _slideMessages : (deck?.chat ?? const <ChatMessage>[]);
    final insets = MediaQuery.viewInsetsOf(context);
    final slideNumber = widget.slideIndex + 1;

    final suggestions = slideScoped
        ? [
            l10n.suggestSlideOne,
            l10n.suggestSlideTwo,
            l10n.suggestSlideThree,
            l10n.suggestSlideFour,
          ]
        : [
            l10n.suggestDeckOne,
            l10n.suggestDeckTwo,
            l10n.suggestDeckThree,
            l10n.suggestDeckFour,
          ];

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
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MedSpace.gutter,
                14,
                MedSpace.gutter,
                10,
              ),
              child: Row(
                children: [
                  const Text('✦ ', style: TextStyle(color: MedColors.clinical)),
                  Text(
                    l10n.editWithAi,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: MedColors.ink,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MedSpace.gutter,
                0,
                MedSpace.gutter,
                12,
              ),
              child: SizedBox(
                width: double.infinity,
                child: SegmentedButton<EditScope>(
                  segments: [
                    ButtonSegment(
                      value: EditScope.slide,
                      label: Text(l10n.scopeSlideNumbered(slideNumber)),
                    ),
                    ButtonSegment(
                      value: EditScope.deck,
                      label: Text(l10n.scopeDeck),
                    ),
                  ],
                  selected: {_scope},
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    textStyle: const TextStyle(fontSize: 13),
                    selectedBackgroundColor: MedColors.ink,
                    selectedForegroundColor: MedColors.paperRaised,
                    side: const BorderSide(color: MedColors.rule),
                  ),
                  // Locked while a request is in flight: the reply is routed
                  // by scope, so switching mid-call would file the answer
                  // under the wrong conversation.
                  onSelectionChanged: _busy
                      ? null
                      : (next) => setState(() => _scope = next.first),
                ),
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
                    _Bubble(
                      text: slideScoped
                          ? l10n.adjustingSlide
                          : l10n.adjustingSlides,
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
                        for (final suggestion in suggestions)
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
                    Text(
                      slideScoped
                          ? l10n.chatSlideBody(slideNumber)
                          : l10n.chatDeckBody,
                      style: const TextStyle(
                        color: MedColors.inkSoft,
                        height: 1.5,
                      ),
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
                      decoration: InputDecoration(
                        hintText: slideScoped
                            ? l10n.chatSlideHint
                            : l10n.chatDeckHint,
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
