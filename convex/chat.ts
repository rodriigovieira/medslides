"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { type Slide } from "../src/lib/deck";
import { TruncatedJsonError, generateStructured } from "./lib/ai";
import { completeObjectsIn } from "../src/lib/partial";

/**
 * The AI editor returns *operations*, not a rewritten deck.
 *
 * A full rewrite would round-trip every slide through the model and silently
 * drop the things it never sees — attached photos, verified reference numbers,
 * the citation query. Operations touch only what the user asked about, and they
 * are auditable: we can tell them exactly what changed.
 */
const OPS_SCHEMA = {
  type: "OBJECT",
  properties: {
    resposta: { type: "STRING" },
    operacoes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: {
            type: "STRING",
            enum: ["editar", "adicionar", "remover", "imagem"],
          },
          slide: { type: "NUMBER" },
          layout: {
            type: "STRING",
            enum: [
              "capa",
              "secao",
              "topicos",
              "destaque",
              "comparacao",
              "encerramento",
              "mecanismo",
              "fluxo",
              "cards",
            ],
          },
          titulo: { type: "STRING" },
          subtitulo: { type: "STRING" },
          topicos: { type: "ARRAY", items: { type: "STRING" } },
          notas: { type: "STRING" },
          hub: { type: "STRING" },
          outcome: { type: "STRING" },
          nos: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                heading: { type: "STRING" },
                body: { type: "STRING" },
              },
              required: ["heading"],
            },
          },
          imageQuery: { type: "STRING" },
          citationQuery: { type: "STRING" },
        },
        required: ["tipo"],
        propertyOrdering: [
          "tipo",
          "slide",
          "layout",
          "titulo",
          "subtitulo",
          "topicos",
          "hub",
          "nos",
          "outcome",
          "notas",
          "imageQuery",
          "citationQuery",
        ],
      },
    },
  },
  required: ["resposta", "operacoes"],
  propertyOrdering: ["resposta", "operacoes"],
} as const;

const CHAT_SYSTEM = `Você edita uma apresentação médica já existente, a pedido de quem a criou.

Devolva duas coisas: \`resposta\`, uma frase curta em português dizendo o que você
fez, e \`operacoes\`, a lista de mudanças.

Operações:
- \`editar\` — precisa de \`slide\` (número exibido, começando em 1) e só os campos
  que mudam (\`titulo\`, \`subtitulo\`, \`topicos\`, \`hub\`, \`nos\`, \`outcome\`, \`notas\`).
- \`adicionar\` — \`slide\` é a posição onde o novo slide entra. Informe \`layout\`,
  \`titulo\`, o conteúdo daquele layout e, quando couber, \`citationQuery\` e
  \`imageQuery\`. Para vários slides, devolva **uma operação por slide**, em
  posições consecutivas (4 slides depois do 6 → posições 7, 8, 9 e 10).
- \`remover\` — só \`slide\`.
- \`imagem\` — troca a foto de um slide. Precisa de \`slide\` e \`imageQuery\`. Use
  também quando pedirem para *adicionar* foto a um slide que não tem.

\`citationQuery\` e \`imageQuery\` não vão para a tela: são buscas que outros
sistemas executam.

- \`citationQuery\`: 4 a 10 palavras **em inglês** descrevendo a afirmação clínica
  que precisa de evidência; o sistema busca no PubMed e anexa o artigo real.
  Ex.: "Antibiótico na 1ª hora reduz mortalidade" →
  \`early antibiotic administration sepsis mortality\`. Preencha em slides que
  afirmam conduta, dose, corte ou desfecho; deixe vazio em capa, seção e
  encerramento.
- \`imageQuery\`: 2 a 4 palavras **em inglês**, concretas e fotografáveis — é uma
  busca em banco de fotos, não um prompt. Bom: \`hospital corridor\`,
  \`emergency room team\`, \`medication vials\`. Ruim: \`sepsis pathophysiology\`
  (não é fotografável), \`foto realista de...\` (é prompt, e não está em inglês).
  A foto é **ambiente**, nunca informação: nunca busque achado clínico, exame de
  imagem, lesão, ferida ou peça anatômica. Preencha sempre em \`capa\`, \`secao\`
  e \`destaque\`, e na maioria dos \`topicos\`. Deixe vazio em \`comparacao\` e nos
  diagramas — esses já têm peso visual próprio.

Regras:
- No máximo **6 slides novos** por pedido. Se pedirem mais, faça 6 e diga na
  \`resposta\` que dá para pedir o resto em seguida.
- \`notas\` é opcional aqui: escreva no máximo 2 frases, ou omita.
- Mexa **apenas** no que foi pedido. Se pedirem para encurtar o slide 4, não
  reescreva o 5.
- Se o pedido não for claro, não invente: devolva \`operacoes\` vazio e use a
  \`resposta\` para perguntar o que a pessoa quer.
- Mantenha o padrão do deck: título que afirma, no máximo 4 tópicos de até 10
  palavras, sem parágrafo na tela.
- Nunca escreva referência, autor, ano ou DOI **no texto do slide**. As
  referências vêm do PubMed pela \`citationQuery\`.
- Você não gera imagens e não descreve fotos no slide; só preenche \`imageQuery\`.`;

function describeDeck(slides: Slide[]): string {
  return slides
    .map((s, i) => {
      const parts = [`#${i + 1} [${s.layout}] ${s.title}`];
      if (s.subtitle) parts.push(`   sub: ${s.subtitle}`);
      for (const b of s.bullets ?? []) parts.push(`   - ${b}`);
      if (s.hub) parts.push(`   hub: ${s.hub}`);
      for (const n of s.nodes ?? []) {
        parts.push(`   no: ${n.heading}${n.body ? ` — ${n.body}` : ""}`);
      }
      if (s.outcome) parts.push(`   desfecho: ${s.outcome}`);
      if (s.stat) parts.push(`   numero: ${s.stat.value} — ${s.stat.label}`);
      return parts.join("\n");
    })
    .join("\n");
}

type Op = {
  tipo?: string;
  slide?: number;
  layout?: string;
  titulo?: string;
  subtitulo?: string;
  topicos?: string[];
  notas?: string;
  hub?: string;
  outcome?: string;
  nos?: Array<{ heading?: string; body?: string }>;
};

/** What the deck is still fetching, so the reply doesn't claim it's finished. */
function describePending({
  refSlides,
  imageSlides,
}: {
  refSlides: number[];
  imageSlides: number[];
}): string {
  const parts: string[] = [];
  if (imageSlides.length > 0) {
    parts.push(imageSlides.length === 1 ? "a imagem" : "as imagens");
  }
  if (refSlides.length > 0) parts.push("as referências no PubMed");
  return parts.join(" e ");
}

export const send = action({
  args: {
    deckId: v.id("decks"),
    clientId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { deckId, clientId, message }): Promise<string> => {
    const text = message.trim();
    if (text.length < 2) throw new Error("Escreva o que você quer mudar.");
    if (text.length > 600) throw new Error("Mensagem longa demais.");

    const deck = await ctx.runQuery(internal.decks.loadForEdit, {
      deckId,
      clientId,
    });

    await ctx.runMutation(internal.chatOps.appendMessage, {
      deckId,
      role: "user",
      text,
    });

    let reply = "Não consegui aplicar essa mudança.";
    try {
      const prompt = `Apresentação atual (${deck.slides.length} slides):\n\n${describeDeck(
        deck.slides as Slide[],
      )}\n\nPedido: ${text}`;

      let ops: Op[];
      let reported: string | undefined;
      try {
        const result = (await generateStructured(
          CHAT_SYSTEM,
          prompt,
          OPS_SCHEMA,
        )) as { resposta?: string; operacoes?: Op[] };
        ops = Array.isArray(result.operacoes) ? result.operacoes : [];
        reported = result.resposta;
      } catch (error) {
        // Asking for four slides at once can outrun the output limit, and the
        // JSON then ends mid-string. The operations that closed are intact, so
        // apply those instead of losing the whole request — the alternative is
        // a user who asked for four slides getting an error and none.
        if (!(error instanceof TruncatedJsonError)) throw error;
        ops = completeObjectsIn<Op>(error.raw, "operacoes");
        if (ops.length === 0) throw error;
        console.warn(`Resposta cortada; ${ops.length} operações salvas.`);
      }

      reply = reported?.trim() || "Pronto.";

      if (ops.length > 0) {
        const result = await ctx.runMutation(internal.chatOps.applyOps, {
          deckId,
          ops: JSON.stringify(ops),
        });
        if (result.applied === 0) {
          reply = `${reply} (nenhuma mudança pôde ser aplicada)`;
        } else if (
          result.refSlides.length > 0 ||
          result.imageSlides.length > 0
        ) {
          // Scheduled, not awaited: PubMed and the photo search together take
          // longer than anyone will watch a chat spinner, and the edited slides
          // are already on screen. They fill in through the same live query.
          await ctx.scheduler.runAfter(0, internal.generate.enrich, {
            deckId,
            slideIndexes: result.refSlides,
            imageIndexes: result.imageSlides,
          });
          reply = `${reply} Buscando ${describePending(result)}…`;
        }
      }
    } catch (error) {
      reply =
        error instanceof Error
          ? `Falhou: ${error.message}`
          : "Falhou ao editar a apresentação.";
    }

    await ctx.runMutation(internal.chatOps.appendMessage, {
      deckId,
      role: "assistant",
      text: reply,
    });
    return reply;
  },
});

/** Schema for editing exactly one slide. Narrower than the deck-wide ops. */
const ONE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resposta: { type: "STRING" },
    layout: {
      type: "STRING",
      enum: [
        "topicos",
        "destaque",
        "comparacao",
        "encerramento",
        "mecanismo",
        "fluxo",
        "cards",
      ],
    },
    titulo: { type: "STRING" },
    subtitulo: { type: "STRING" },
    topicos: { type: "ARRAY", items: { type: "STRING" } },
    hub: { type: "STRING" },
    outcome: { type: "STRING" },
    nos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { heading: { type: "STRING" }, body: { type: "STRING" } },
        required: ["heading"],
      },
    },
    notas: { type: "STRING" },
    imageQuery: { type: "STRING" },
    removerImagem: { type: "BOOLEAN" },
  },
  required: ["resposta"],
  propertyOrdering: [
    "resposta",
    "layout",
    "titulo",
    "subtitulo",
    "topicos",
    "hub",
    "nos",
    "outcome",
    "notas",
    "imageQuery",
    "removerImagem",
  ],
} as const;

const ONE_SYSTEM = `Você reescreve **um único slide** de uma apresentação médica.

Devolva \`resposta\` (uma frase curta em português dizendo o que mudou) e só os
campos que mudam. Campo omitido = campo preservado.

- Mantenha o padrão: título que afirma, no máximo 4 tópicos de até 10 palavras.
- Só mude \`layout\` se o pedido for de virar diagrama. Aí escolha:
  \`mecanismo\` (um conceito central que abre em vias e converge num desfecho —
  informe \`hub\`, \`nos\` e \`outcome\`), \`fluxo\` (etapas em ordem — \`nos\`) ou
  \`cards\` (blocos paralelos sem ordem — \`nos\`). Ao virar diagrama, devolva
  \`nos\` e **não** devolva \`topicos\`.
- Nunca escreva referência, autor, ano ou DOI.
- Imagem: para trocar, colocar ou pedir outra foto, devolva \`imageQuery\` com
  2 a 4 palavras **em inglês**, concretas e fotografáveis — é uma busca em banco
  de fotos, não um prompt. Bom: \`hospital corridor\`, \`emergency room team\`,
  \`medication vials\`. A foto é ambiente, nunca informação: nunca busque achado
  clínico, exame de imagem, lesão ou peça anatômica. **Qualquer layout aceita
  foto**, inclusive diagramas e comparação. Para tirar a foto, devolva
  \`removerImagem: true\`.
- Se o pedido não fizer sentido para este slide, não invente: devolva só
  \`resposta\` explicando.`;

/** Slide-scoped edit, used by the popover anchored to the slide. */
export const editOne = action({
  args: {
    deckId: v.id("decks"),
    clientId: v.string(),
    slideIndex: v.number(),
    instruction: v.string(),
  },
  handler: async (
    ctx,
    { deckId, clientId, slideIndex, instruction },
  ): Promise<string> => {
    const text = instruction.trim();
    if (text.length < 2) throw new Error("Diga o que mudar neste slide.");
    if (text.length > 400) throw new Error("Pedido longo demais.");

    const deck = await ctx.runQuery(internal.decks.loadForEdit, {
      deckId,
      clientId,
    });
    const slide = (deck.slides as Slide[])[slideIndex];
    if (!slide) throw new Error("Slide inexistente.");

    const result = (await generateStructured(
      ONE_SYSTEM,
      `Slide atual (#${slideIndex + 1}):\n\n${describeDeck([slide])}\n\nPedido: ${text}`,
      ONE_SCHEMA,
    )) as Record<string, unknown>;

    const reply =
      typeof result.resposta === "string" && result.resposta.trim()
        ? result.resposta.trim()
        : "Pronto.";

    const { resposta: _ignored, ...patch } = result;
    const applied = await ctx.runMutation(internal.chatOps.applySlidePatch, {
      deckId,
      slideIndex,
      patch: JSON.stringify(patch),
    });
    if (!applied.changed) return `${reply} (nada mudou)`;

    if (applied.needsPhoto) {
      await ctx.scheduler.runAfter(0, internal.generate.enrich, {
        deckId,
        slideIndexes: [],
        imageIndexes: [slideIndex],
      });
      return `${reply} Buscando a imagem…`;
    }
    return reply;
  },
});
