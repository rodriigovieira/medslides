import 'package:flutter/foundation.dart';

/// Mirrors `Slide` / `Deck` in `src/lib/deck.ts`.
///
/// Hand-written rather than generated: the shapes come out of Convex as plain
/// JSON, and a generator for four classes would be another thing to keep in
/// step. Every field here is optional in the same places the TypeScript type
/// has it optional, and parsing is total — an unknown layout degrades to
/// `topicos` exactly as `sanitizeSlide` does on the server, so a deck written
/// by a newer web build still renders on an older phone build.
enum SlideLayout {
  capa,
  secao,
  topicos,
  destaque,
  comparacao,
  encerramento,
  mecanismo,
  fluxo,
  cards;

  static SlideLayout parse(Object? raw) {
    for (final value in SlideLayout.values) {
      if (value.name == raw) return value;
    }
    return SlideLayout.topicos;
  }

  bool get isDiagram =>
      this == SlideLayout.mecanismo ||
      this == SlideLayout.fluxo ||
      this == SlideLayout.cards;

  /// Layouts whose content covers the whole canvas, so a directional scrim
  /// would lighten an end that has text on it. Mirrors `coversCanvas`.
  bool get coversCanvas => isDiagram || this == SlideLayout.comparacao;
}

/// How a slide uses its picture. Mirrors `treatmentFor` in `src/lib/compose.ts`.
enum Treatment { full, panel, none }

@immutable
class DiagramNode {
  const DiagramNode({required this.heading, this.body});

  final String heading;
  final String? body;

  static DiagramNode? parse(Object? raw) {
    if (raw is! Map) return null;
    final heading = _string(raw['heading']);
    if (heading == null) return null;
    return DiagramNode(heading: heading, body: _string(raw['body']));
  }
}

@immutable
class SlideColumn {
  const SlideColumn({required this.heading, required this.bullets});

  final String heading;
  final List<String> bullets;

  static SlideColumn? parse(Object? raw) {
    if (raw is! Map) return null;
    final heading = _string(raw['heading']);
    if (heading == null) return null;
    return SlideColumn(heading: heading, bullets: _strings(raw['bullets']));
  }
}

@immutable
class Stat {
  const Stat({required this.value, required this.label});

  final String value;
  final String label;

  static Stat? parse(Object? raw) {
    if (raw is! Map) return null;
    final value = _string(raw['value']);
    final label = _string(raw['label']);
    if (value == null || label == null) return null;
    return Stat(value: value, label: label);
  }
}

/// A real article, verified against PubMed. Never model-authored — the whole
/// trust story of the product rests on that, so nothing here is ever synthesised
/// on the client either.
@immutable
class Reference {
  const Reference({
    required this.n,
    required this.pmid,
    required this.title,
    required this.authors,
    required this.journal,
    required this.year,
    required this.url,
  });

  final int n;
  final String pmid;
  final String title;
  final String authors;
  final String journal;
  final String year;
  final String url;

  static Reference? parse(Object? raw) {
    if (raw is! Map) return null;
    final n = raw['n'];
    if (n is! num) return null;
    return Reference(
      n: n.toInt(),
      pmid: _string(raw['pmid']) ?? '',
      title: _string(raw['title']) ?? '',
      authors: _string(raw['authors']) ?? '',
      journal: _string(raw['journal']) ?? '',
      year: _string(raw['year']) ?? '',
      url: _string(raw['url']) ?? '',
    );
  }

  /// Vancouver-ish one-liner. Trailing periods are stripped from each part
  /// first — "et al." plus a joining "." produced "et al..". Mirrors
  /// `citationLine`.
  String get line {
    final parts = [authors, journal, year]
        .map((part) => part.trim().replaceAll(RegExp(r'\.+$'), ''))
        .where((part) => part.isNotEmpty)
        .toList();
    return parts.isEmpty ? '' : '${parts.join('. ')}.';
  }
}

@immutable
class Slide {
  const Slide({
    required this.layout,
    required this.title,
    this.subtitle,
    this.bullets = const [],
    this.left,
    this.right,
    this.stat,
    this.hub,
    this.nodes = const [],
    this.outcome,
    this.notes,
    this.refs = const [],
    this.imageUrl,
    this.imageCredit,
    this.imageStyle,
  });

  final SlideLayout layout;
  final String title;
  final String? subtitle;
  final List<String> bullets;
  final SlideColumn? left;
  final SlideColumn? right;
  final Stat? stat;
  final String? hub;
  final List<DiagramNode> nodes;
  final String? outcome;
  final String? notes;
  final List<int> refs;
  final String? imageUrl;
  final String? imageCredit;
  final String? imageStyle;

  bool get isIllustration => imageStyle == 'ilustracao';

  /// Credit line written on any slide whose picture was generated rather than
  /// photographed. Mirrors `AI_CREDIT`.
  static const aiCredit = 'Imagem gerada por IA';

  bool get isGeneratedImage => imageCredit == aiCredit;

  /// Mirrors `treatmentFor`. An illustration is drawn on white and is the point
  /// of its own frame; under the full-bleed scrim it would be a dark rectangle
  /// with a ghost in it, so it always takes the panel.
  Treatment get treatment {
    if (imageUrl == null) return Treatment.none;
    if (isIllustration) return Treatment.panel;
    if (layout == SlideLayout.topicos || layout == SlideLayout.encerramento) {
      return Treatment.panel;
    }
    return Treatment.full;
  }

  /// True when the slide draws light-on-dark. A photo under the full-bleed
  /// scrim forces it; `secao` and `destaque` are dark by design even bare.
  bool get isDark =>
      treatment == Treatment.full ||
      layout == SlideLayout.secao ||
      layout == SlideLayout.destaque;

  static Slide parse(Object? raw) {
    if (raw is! Map) {
      return const Slide(layout: SlideLayout.topicos, title: '');
    }
    return Slide(
      layout: SlideLayout.parse(raw['layout']),
      title: _string(raw['title']) ?? '',
      subtitle: _string(raw['subtitle']),
      bullets: _strings(raw['bullets']),
      left: SlideColumn.parse(raw['left']),
      right: SlideColumn.parse(raw['right']),
      stat: Stat.parse(raw['stat']),
      hub: _string(raw['hub']),
      nodes: raw['nodes'] is List
          ? (raw['nodes'] as List)
              .map(DiagramNode.parse)
              .whereType<DiagramNode>()
              .toList()
          : const [],
      outcome: _string(raw['outcome']),
      notes: _string(raw['notes']),
      refs: raw['refs'] is List
          ? (raw['refs'] as List).whereType<num>().map((n) => n.toInt()).toList()
          : const [],
      imageUrl: _string(raw['imageUrl']),
      imageCredit: _string(raw['imageCredit']),
      imageStyle: _string(raw['imageStyle']),
    );
  }
}

/// Progress within a generation. Text lands long before the deck is done —
/// references and images follow — so `status: pronto` alone told the user it
/// was finished while work was still running.
enum DeckPhase {
  texto,
  referencias,
  imagens,
  pronto;

  static DeckPhase? parse(Object? raw) {
    for (final value in DeckPhase.values) {
      if (value.name == raw) return value;
    }
    return null;
  }

  String get label => switch (this) {
        DeckPhase.texto => 'Escrevendo os slides',
        DeckPhase.referencias => 'Buscando referências no PubMed',
        DeckPhase.imagens => 'Escolhendo as imagens',
        DeckPhase.pronto => 'Pronta',
      };
}

enum DeckStatus { gerando, pronto, erro }

@immutable
class ChatMessage {
  const ChatMessage({required this.role, required this.text, required this.at});

  final String role;
  final String text;
  final int at;

  bool get isUser => role == 'user';

  static ChatMessage? parse(Object? raw) {
    if (raw is! Map) return null;
    final text = _string(raw['text']);
    if (text == null) return null;
    final at = raw['at'];
    return ChatMessage(
      role: _string(raw['role']) ?? 'assistant',
      text: text,
      at: at is num ? at.toInt() : 0,
    );
  }
}

@immutable
class Deck {
  const Deck({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.topic,
    required this.audience,
    required this.slides,
    required this.status,
    this.phase,
    this.error,
    this.references = const [],
    this.chat = const [],
  });

  final String id;
  final String title;
  final String subtitle;
  final String topic;
  final String audience;
  final List<Slide> slides;
  final DeckStatus status;
  final DeckPhase? phase;
  final String? error;
  final List<Reference> references;
  final List<ChatMessage> chat;

  /// True while anything is still arriving — text, references or images. The
  /// UI keeps the ✦ indicator up for all of it, not just the text pass.
  bool get isWorking =>
      status == DeckStatus.gerando ||
      (phase != null && phase != DeckPhase.pronto);

  Reference? reference(int n) {
    for (final ref in references) {
      if (ref.n == n) return ref;
    }
    return null;
  }

  /// Only references that were actually verified reach a slide.
  List<Reference> citedOn(Slide slide) =>
      slide.refs.map(reference).whereType<Reference>().take(2).toList();

  static Deck? parse(Object? raw) {
    if (raw is! Map) return null;
    final id = _string(raw['_id']);
    if (id == null) return null;
    return Deck(
      id: id,
      title: _string(raw['title']) ?? '',
      subtitle: _string(raw['subtitle']) ?? '',
      topic: _string(raw['topic']) ?? '',
      audience: _string(raw['audience']) ?? '',
      slides: raw['slides'] is List
          ? (raw['slides'] as List).map(Slide.parse).toList()
          : const [],
      status: switch (raw['status']) {
        'gerando' => DeckStatus.gerando,
        'erro' => DeckStatus.erro,
        _ => DeckStatus.pronto,
      },
      phase: DeckPhase.parse(raw['phase']),
      error: _string(raw['error']),
      references: raw['references'] is List
          ? (raw['references'] as List)
              .map(Reference.parse)
              .whereType<Reference>()
              .toList()
          : const [],
      chat: raw['chat'] is List
          ? (raw['chat'] as List)
              .map(ChatMessage.parse)
              .whereType<ChatMessage>()
              .toList()
          : const [],
    );
  }
}

/// A row in the deck list. `decks.listMine` deliberately omits slide bodies.
@immutable
class DeckSummary {
  const DeckSummary({
    required this.id,
    required this.title,
    required this.topic,
    required this.audience,
    required this.status,
    required this.slideCount,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String topic;
  final String audience;
  final DeckStatus status;
  final int slideCount;
  final int createdAt;

  static DeckSummary? parse(Object? raw) {
    if (raw is! Map) return null;
    final id = _string(raw['_id']);
    if (id == null) return null;
    final count = raw['slideCount'];
    final created = raw['createdAt'];
    return DeckSummary(
      id: id,
      title: _string(raw['title']) ?? '',
      topic: _string(raw['topic']) ?? '',
      audience: _string(raw['audience']) ?? '',
      status: switch (raw['status']) {
        'gerando' => DeckStatus.gerando,
        'erro' => DeckStatus.erro,
        _ => DeckStatus.pronto,
      },
      slideCount: count is num ? count.toInt() : 0,
      createdAt: created is num ? created.toInt() : 0,
    );
  }
}

String? _string(Object? raw) {
  if (raw is! String) return null;
  final text = raw.trim();
  return text.isEmpty ? null : raw;
}

List<String> _strings(Object? raw) => raw is List
    ? raw.whereType<String>().where((s) => s.trim().isNotEmpty).toList()
    : const [];
