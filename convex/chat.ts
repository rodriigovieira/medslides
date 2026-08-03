"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { sanitizeSlide, type Slide } from "../src/lib/deck";
import { generateStructured } from "./lib/ai";

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
            enum: ["editar", "adicionar", "remover"],
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
  \`titulo\` e o conteúdo daquele layout.
- \`remover\` — só \`slide\`.

Regras:
- Mexa **apenas** no que foi pedido. Se pedirem para encurtar o slide 4, não
  reescreva o 5.
- Se o pedido não for claro, não invente: devolva \`operacoes\` vazio e use a
  \`resposta\` para perguntar o que a pessoa quer.
- Mantenha o padrão do deck: título que afirma, no máximo 4 tópicos de até 10
  palavras, sem parágrafo na tela.
- Nunca escreva referência, autor, ano ou DOI. As referências são buscadas no
  PubMed por outro sistema.
- Nunca peça imagem nem descreva foto.`;

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
      const result = (await generateStructured(
        CHAT_SYSTEM,
        `Apresentação atual (${deck.slides.length} slides):\n\n${describeDeck(
          deck.slides as Slide[],
        )}\n\nPedido: ${text}`,
        OPS_SCHEMA,
      )) as { resposta?: string; operacoes?: Op[] };

      const ops = Array.isArray(result.operacoes) ? result.operacoes : [];
      reply = result.resposta?.trim() || "Pronto.";

      if (ops.length > 0) {
        const applied = await ctx.runMutation(internal.chatOps.applyOps, {
          deckId,
          ops: JSON.stringify(ops),
        });
        if (applied === 0) reply = `${reply} (nenhuma mudança pôde ser aplicada)`;
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
