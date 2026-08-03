import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/deck.dart';
import '../slides/slide_view.dart';
import '../state/providers.dart';
import '../theme/med_tokens.dart';
import '../widgets/chat_sheet.dart';
import '../widgets/phase_bar.dart';
import 'present_screen.dart';

/// One deck: the slide you are on, the film strip, the speaker notes, and the
/// four things you can do to it.
class DeckScreen extends ConsumerWidget {
  const DeckScreen({super.key, required this.deckId});

  final String deckId;

  /// Where a deck lives on the web. The phone shares this rather than a file:
  /// a link stays live as the deck is edited, and it is what the recipient can
  /// actually open on a laptop.
  static String webUrl(String deckId) => 'https://medslides.vercel.app/d/$deckId';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(deckProvider(deckId));

    return Scaffold(
      appBar: AppBar(
        title: async.maybeWhen(
          data: (deck) => Text(
            deck == null || deck.title.isEmpty ? 'Apresentação' : deck.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          orElse: () => const Text('Apresentação'),
        ),
        actions: [
          IconButton(
            tooltip: 'Compartilhar',
            onPressed: () => Share.shareUri(Uri.parse(webUrl(deckId))),
            icon: const Icon(Icons.ios_share, size: 20),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(MedSpace.gutter),
            child: Text('$error', textAlign: TextAlign.center),
          ),
        ),
        data: (deck) {
          if (deck == null) {
            return const Center(child: Text('Apresentação não encontrada.'));
          }
          if (deck.slides.isEmpty) {
            return _Waiting(deck: deck);
          }
          return _DeckBody(deck: deck);
        },
      ),
    );
  }
}

/// The gap between asking and the first slide landing. Naming the phase is the
/// difference between "it's working" and "it's broken".
class _Waiting extends StatelessWidget {
  const _Waiting({required this.deck});

  final Deck deck;

  @override
  Widget build(BuildContext context) {
    if (deck.status == DeckStatus.erro) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(MedSpace.gutter),
          child: Text(
            deck.error ?? 'Não consegui gerar esta apresentação.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: MedColors.signal),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(MedSpace.gutter),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          PhaseBar(phase: deck.phase),
          const SizedBox(height: 22),
          const _SlideSkeleton(),
        ],
      ),
    );
  }
}

class _SlideSkeleton extends StatefulWidget {
  const _SlideSkeleton();

  @override
  State<_SlideSkeleton> createState() => _SlideSkeletonState();
}

class _SlideSkeletonState extends State<_SlideSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.4, end: 0.85).animate(_controller),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          decoration: BoxDecoration(
            color: MedColors.paperRaised,
            border: Border.all(color: MedColors.rule),
            borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
          ),
        ),
      ),
    );
  }
}

class _DeckBody extends ConsumerWidget {
  const _DeckBody({required this.deck});

  final Deck deck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref
        .watch(currentSlideProvider(deck.id))
        .clamp(0, deck.slides.length - 1);
    final slide = deck.slides[index];

    return Column(
      children: [
        if (deck.isWorking)
          Padding(
            padding: const EdgeInsets.fromLTRB(MedSpace.gutter, 8, MedSpace.gutter, 0),
            child: PhaseBar(phase: deck.phase),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              MedSpace.gutter,
              12,
              MedSpace.gutter,
              32,
            ),
            children: [
              // The slide is a page-view so a swipe moves through the deck,
              // which is the gesture people already expect from a deck on a
              // phone. The film strip below follows it, not the other way
              // round.
              SizedBox(
                height: MediaQuery.sizeOf(context).width * 9 / 16 -
                    MedSpace.gutter,
                child: PageView.builder(
                  controller: PageController(initialPage: index),
                  itemCount: deck.slides.length,
                  onPageChanged: (i) =>
                      ref.read(currentSlideProvider(deck.id).notifier).state = i,
                  itemBuilder: (context, i) => ClipRRect(
                    borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
                    child: SlideView(
                      slide: deck.slides[i],
                      index: i,
                      total: deck.slides.length,
                      deck: deck,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '${index + 1} de ${deck.slides.length}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12.5, color: MedColors.inkFaint),
              ),
              const SizedBox(height: 14),
              _Actions(deck: deck),
              if (slide.notes != null) ...[
                const SizedBox(height: 22),
                const _SectionLabel('Notas do apresentador'),
                const SizedBox(height: 8),
                Text(
                  slide.notes!,
                  style: const TextStyle(
                    height: 1.55,
                    color: MedColors.inkSoft,
                    fontSize: 15,
                  ),
                ),
              ],
              if (deck.citedOn(slide).isNotEmpty) ...[
                const SizedBox(height: 22),
                const _SectionLabel('Referências deste slide'),
                const SizedBox(height: 8),
                for (final ref in deck.citedOn(slide))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReferenceTile(reference: ref),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Actions extends ConsumerWidget {
  const _Actions({required this.deck});

  final Deck deck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Two rows, not three buttons across one. On an iPhone 16 Pro the three-up
    // row left 147pt per button and "Editar com IA" needs about 170pt with its
    // ✦ and the M3 padding, so the label wrapped to two lines and the button
    // grew a second row of text inside itself. Narrower phones only make that
    // worse, and shortening the label to fit would cost the one word that says
    // what the button does.
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: deck.slides.isEmpty
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PresentScreen(deckId: deck.id),
                      ),
                    ),
            icon: const Icon(Icons.play_arrow_rounded, size: 20),
            label: const Text('Apresentar'),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: deck.isWorking
                    ? null
                    : () => ChatSheet.show(context, deckId: deck.id),
                icon: const Text('✦', style: TextStyle(fontSize: 15)),
                label: const Text('Editar com IA'),
              ),
            ),
            const SizedBox(width: 10),
            // The .pptx is built in the browser — pptxgenjs plus a canvas pass
            // that flattens each photo and its scrim into one image. Rebuilding
            // that in Dart would be a second exporter to keep in step with the
            // first, and the first is the one that has already been through the
            // iOS/WhatsApp transparency trap. So the phone hands off to the
            // page that owns it.
            SizedBox(
              width: MedSpace.tapTarget,
              child: OutlinedButton(
                onPressed: () => launchUrl(
                  Uri.parse(DeckScreen.webUrl(deck.id)),
                  mode: LaunchMode.externalApplication,
                ),
                style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
                child: const Icon(Icons.download, size: 20),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11.5,
        letterSpacing: 1.1,
        fontWeight: FontWeight.w600,
        color: MedColors.inkFaint,
      ),
    );
  }
}

class _ReferenceTile extends StatelessWidget {
  const _ReferenceTile({required this.reference});

  final Reference reference;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
      onTap: () => launchUrl(
        Uri.parse(reference.url),
        mode: LaunchMode.externalApplication,
      ),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: MedColors.paperRaised,
          border: Border.all(color: MedColors.rule),
          borderRadius: BorderRadius.circular(MedSpace.radiusSmall),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              reference.title,
              style: const TextStyle(
                fontSize: 14,
                height: 1.35,
                color: MedColors.ink,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              '${reference.line} PMID ${reference.pmid}',
              style: const TextStyle(fontSize: 12.5, color: MedColors.inkFaint),
            ),
          ],
        ),
      ),
    );
  }
}
