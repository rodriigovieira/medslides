import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/deck.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';
import '../widgets/generate_sheet.dart';
import 'deck_screen.dart';

/// Everything the user has made, newest first, with one way in.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final decks = ref.watch(myDecksProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MedSlides'),
        titleSpacing: MedSpace.gutter,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => GenerateSheet.show(context),
        backgroundColor: MedColors.ink,
        foregroundColor: MedColors.paperRaised,
        icon: const Icon(Icons.add),
        label: const Text('Nova apresentação'),
      ),
      body: decks.when(
        loading: () => const _Centered(child: CircularProgressIndicator()),
        // A connection failure is worth naming: the decks are on the server, so
        // an empty list and an unreachable server look identical otherwise, and
        // "you have no decks" is a frightening thing to tell someone falsely.
        error: (error, _) => _Centered(
          child: Padding(
            padding: const EdgeInsets.all(MedSpace.gutter),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Não consegui falar com o servidor.',
                  style: TextStyle(fontSize: 16, color: MedColors.ink),
                ),
                const SizedBox(height: 6),
                Text(
                  '$error',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: MedColors.inkFaint, fontSize: 13),
                ),
                const SizedBox(height: 14),
                OutlinedButton(
                  onPressed: () => ref.invalidate(myDecksProvider),
                  child: const Text('Tentar de novo'),
                ),
              ],
            ),
          ),
        ),
        data: (list) => list.isEmpty
            ? const _Empty()
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  MedSpace.gutter,
                  8,
                  MedSpace.gutter,
                  120,
                ),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: MedSpace.gap),
                itemBuilder: (context, i) => _DeckCard(deck: list[i]),
              ),
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Center(child: child);
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Sua primeira apresentação',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            const Text(
              'Descreva o tema — por escrito ou falando — e eu monto os slides, '
              'com referências buscadas no PubMed.',
              textAlign: TextAlign.center,
              style: TextStyle(color: MedColors.inkSoft, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.deck});

  final DeckSummary deck;

  @override
  Widget build(BuildContext context) {
    final generating = deck.status == DeckStatus.gerando;

    return Material(
      color: MedColors.paperRaised,
      borderRadius: BorderRadius.circular(MedSpace.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(MedSpace.radius),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => DeckScreen(deckId: deck.id)),
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: MedColors.rule),
            borderRadius: BorderRadius.circular(MedSpace.radius),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      // A deck that is still being written has no title yet;
                      // the topic the user typed is the honest stand-in.
                      deck.title.isEmpty ? deck.topic : deck.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: MedFonts.display,
                        fontSize: 19,
                        height: 1.15,
                        color: MedColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        if (generating) ...[
                          const _Sparkle(),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            generating
                                ? 'Gerando…'
                                : '${deck.slideCount} slides · ${deck.audience}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: generating
                                  ? MedColors.clinical
                                  : MedColors.inkFaint,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: MedColors.inkFaint,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The ✦ the web uses to mean "the model is working on this". Same mark, same
/// meaning, so the two surfaces read as one product.
class _Sparkle extends StatefulWidget {
  const _Sparkle();

  @override
  State<_Sparkle> createState() => _SparkleState();
}

class _SparkleState extends State<_Sparkle>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 1).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      ),
      child: const Text(
        '✦',
        style: TextStyle(color: MedColors.clinical, fontSize: 13),
      ),
    );
  }
}
