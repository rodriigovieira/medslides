import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../l10n/labels.dart';
import '../models/deck.dart';
import '../theme/med_tokens.dart';

/// Which of the three passes the deck is in.
///
/// Text lands in about thirty seconds, but the deck is not finished for another
/// minute while PubMed and the photo search run. `status: pronto` on its own
/// told people it was done while work was still happening, so the phase is
/// published as it goes — same reasoning as `PhaseBar` on the web.
class PhaseBar extends StatelessWidget {
  const PhaseBar({super.key, required this.phase});

  final DeckPhase? phase;

  static const _order = [DeckPhase.texto, DeckPhase.referencias, DeckPhase.imagens];

  @override
  Widget build(BuildContext context) {
    final current = phase ?? DeckPhase.texto;
    final done = current == DeckPhase.pronto;
    final reached = done ? _order.length : _order.indexOf(current);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < _order.length; i++) ...[
              if (i > 0) const SizedBox(width: 5),
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 400),
                  height: 3,
                  decoration: BoxDecoration(
                    color: i <= reached ? MedColors.clinical : MedColors.rule,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            if (!done)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: Text('✦', style: TextStyle(color: MedColors.clinical, fontSize: 13)),
              ),
            Text(
              AppLocalizations.of(context)!
                  .phase(done ? DeckPhase.pronto : current),
              style: TextStyle(
                fontSize: 13,
                color: done ? MedColors.inkFaint : MedColors.clinical,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
