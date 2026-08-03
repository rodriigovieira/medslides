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
            enum: [
              "editar",
              "adicionar",
              "remover",
              "imagem",
              "mover",
              "gerarImagem",
            ],
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
          para: { type: "NUMBER" },
          imagePrompt: { type: "STRING" },
          estilo: { type: "STRING", enum: ["foto", "ilustracao"] },
          altaQualidade: { type: "BOOLEAN" },
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
          "para",
          "imagePrompt",
          "estilo",
          "altaQualidade",
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
  Se pedirem o slide **com imagem gerada por IA**, mande \`imagePrompt\` (e
  \`estilo\`) na própria operação \`adicionar\` — o slide nasce com a imagem.
- \`remover\` — só \`slide\`.
- \`mover\` — muda a ordem. \`slide\` é a posição atual e \`para\` é a posição
  final, ambas na numeração exibida.
- \`imagem\` — troca a foto de um slide por outra do **banco de fotos reais**.
  Precisa de \`slide\` e \`imageQuery\`. É o padrão: é grátis e é uma foto de
  verdade. Use também quando pedirem para *adicionar* foto a um slide que não
  tem.
- \`gerarImagem\` — **cria** uma imagem com IA para um slide que já existe.
  Precisa de \`slide\` e \`imagePrompt\`.
  **"nano banana", "nanobanana", "banana", "Gemini" e "gerar com IA" são todos
  o mesmo pedido: gerar a imagem.** É o apelido do modelo de imagem do Google
  que usamos; nunca pergunte o que significa nem o que tem a ver com o tema.
  Use **só** quando a pessoa pedir imagem gerada/criada por IA,
  ou descrever uma cena específica que uma busca em banco de fotos não acharia
  ("um médico idoso explicando um exame para a família numa enfermaria vazia").
  Na dúvida entre as duas, use \`imagem\`. \`estilo\` escolhe entre \`foto\`
  (padrão) e \`ilustracao\` (esquema científico em fundo branco — anticorpo,
  coração, receptor, célula). **\`ilustracao\` só em \`capa\`, \`secao\`,
  \`topicos\`, \`destaque\` e \`encerramento\`** — ela ocupa um painel lateral, e
  diagrama e \`comparacao\` usam a largura toda; nesses, use \`foto\`.
  \`altaQualidade: true\` só se pedirem qualidade máxima — é mais caro e mais
  lento.
  \`imagePrompt\` é uma descrição **em inglês**, uma ou duas frases, do que
  aparece na cena. Escolha o registro em \`estilo\`:
  - \`foto\` (padrão) — fotografia de ambiente: sujeito, cenário, luz,
    enquadramento. Ex.: \`an empty intensive care unit at dawn, cool light\`.
  - \`ilustracao\` — esquema científico limpo, um único objeto centralizado em
    fundo branco, no estilo dos congressos: um anticorpo monoclonal, um coração,
    um receptor de membrana, uma célula. Ex.: \`a Y-shaped monoclonal antibody
    with small payload spheres attached to its arms by short linkers\`.
    Descreva **a forma**, não rótulos. A paleta é aplicada automaticamente.
  Nunca peça texto, rótulo, logotipo ou gráfico com números — o modelo desenha
  letra falsa. Nunca peça exame, lesão, peça anatômica nem estrutura química:
  uma fórmula inventada parece tão convincente quanto a certa.

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
  imagem, lesão, ferida ou peça anatômica. **Qualquer layout aceita foto** —
  inclusive \`comparacao\` e os diagramas, que a exibem no fundo. Ao criar um
  slide, preencha sempre em \`capa\`, \`secao\` e \`destaque\`, e na maioria dos
  \`topicos\`; nos diagramas, só quando pedirem. Quando pedirem imagem para um
  slide, **nunca recuse por causa do layout**.

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
- Nunca descreva a foto no texto do slide. A imagem entra por \`imageQuery\`
  (banco de fotos, padrão) ou por \`gerarImagem\` (criada por IA, sob pedido).`;

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
  imagePrompt?: string;
  estilo?: string;
  altaQualidade?: boolean;
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

      // Same repair the slide-scoped editor does: a node that lost its support
      // line renders lopsided next to its siblings, whichever path built it.
      for (const op of ops) {
        if (Array.isArray(op.nos) && op.nos.length > 0) {
          op.nos = await completeNodeBodies(op.titulo ?? "", op.nos);
        }
      }

      // Illustration onto a diagram: dropped before it is paid for, and said
      // out loud, rather than applied into a slide it cannot fit.
      let refused = false;
      for (const op of ops) {
        if (op.estilo !== "ilustracao" || !op.imagePrompt?.trim()) continue;
        // For a new slide the layout is the one being created; for an existing
        // one it's the layout already on the deck.
        const layout =
          op.tipo === "adicionar"
            ? (op.layout ?? "topicos")
            : (deck.slides as Slide[])[(op.slide ?? 0) - 1]?.layout;
        if (layout && !illustrationFits(layout)) {
          // Drop only the art. A slide asked for with an illustration is still a
          // slide the user wants — it just arrives without the picture.
          delete op.imagePrompt;
          refused = true;
        }
      }
      if (refused) reply = `${reply} ${DIAGRAM_ART_REFUSAL}`;

      if (ops.length > 0) {
        const result = await ctx.runMutation(internal.chatOps.applyOps, {
          deckId,
          ops: JSON.stringify(ops),
        });
        if (result.applied === 0) {
          reply = `${reply} (nenhuma mudança pôde ser aplicada)`;
        }

        // Generated art, one budget reservation per image, before any call is
        // made. A user who runs out mid-request gets the ones that fit and is
        // told plainly — not a silent partial result.
        let generated = 0;
        let blocked = "";
        for (const request of result.aiImages) {
          try {
            await ctx.runMutation(internal.decks.reserveAiImage, { clientId });
          } catch (error) {
            blocked =
              error instanceof Error
                ? error.message
                : "Limite de imagens geradas atingido.";
            break;
          }
          await ctx.scheduler.runAfter(0, internal.aiImage.run, {
            deckId,
            slideIndex: request.slideIndex,
            prompt: request.prompt,
            quality: request.alta ? "alta" : "rapida",
            style: request.estilo === "ilustracao" ? "ilustracao" : "foto",
          });
          generated++;
        }
        if (generated > 0) {
          reply = `${reply} Gerando ${generated === 1 ? "a imagem" : `${generated} imagens`} com IA — leva alguns segundos.`;
        }
        if (blocked) reply = `${reply} ${blocked}`;

        if (
          result.applied > 0 &&
          (result.refSlides.length > 0 || result.imageSlides.length > 0)
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
    imagePrompt: { type: "STRING" },
    estilo: { type: "STRING", enum: ["foto", "ilustracao"] },
    altaQualidade: { type: "BOOLEAN" },
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
    "imagePrompt",
    "estilo",
    "altaQualidade",
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
  Cada nó tem \`heading\` (2 a 5 palavras) **e** \`body\` (uma linha, até 14
  palavras). Os dois, em **todos** os nós — um nó sem \`body\` ao lado de outros
  que têm sai torto no slide.
- Nunca escreva referência, autor, ano ou DOI.
- Imagem: para trocar, colocar ou pedir outra foto, devolva \`imageQuery\` com
  2 a 4 palavras **em inglês**, concretas e fotografáveis — é uma busca em banco
  de fotos, não um prompt. Bom: \`hospital corridor\`, \`emergency room team\`,
  \`medication vials\`. A foto é ambiente, nunca informação: nunca busque achado
  clínico, exame de imagem, lesão ou peça anatômica. **Qualquer layout aceita
  foto**, inclusive diagramas e comparação. Para tirar a foto, devolva
  \`removerImagem: true\`.
- Imagem **gerada por IA**: quando pedirem para *criar/gerar* uma imagem, ou
  descreverem uma cena específica que uma busca em banco de fotos não acharia,
  devolva \`imagePrompt\` em vez de \`imageQuery\` — uma ou duas frases **em
  inglês** descrevendo sujeito, ambiente, luz e enquadramento. Na dúvida entre as
  duas, prefira \`imageQuery\` (foto real, sem custo). \`altaQualidade: true\` só
  se pedirem qualidade máxima.
- Se o pedido não fizer sentido para este slide, não invente: devolva só
  \`resposta\` explicando.`;

/**
 * An illustration takes the side panel, and a diagram needs the whole slide.
 *
 * Asked for an antibody on a `mecanismo` slide, the art came out perfectly and
 * the diagram collapsed into the remaining third — boxes off the bottom edge,
 * over the citations. Refused here rather than in the renderer, because the
 * refusal has to happen before the image is paid for, and because "your slide is
 * already a diagram" is a better answer than a squeezed slide.
 */
function illustrationFits(layout: string): boolean {
  return !["mecanismo", "fluxo", "cards", "comparacao"].includes(layout);
}

const DIAGRAM_ART_REFUSAL =
  "Este slide já é um diagrama e ocupa a largura toda — uma ilustração ao lado não caberia. Posso gerar uma foto de ambiente para o fundo dele, ou você converte o slide para tópicos antes.";

const BODIES_SCHEMA = {
  type: "OBJECT",
  properties: {
    nos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { heading: { type: "STRING" }, body: { type: "STRING" } },
        required: ["heading", "body"],
      },
    },
  },
  required: ["nos"],
  propertyOrdering: ["nos"],
} as const;

type Node = { heading?: string; body?: string };

/**
 * Fills in the support line of any node that came back without one.
 *
 * A conversion returned four cards where three had a body and the first didn't —
 * the model dropped it mid-generation. The lopsided card is what the user sees,
 * and there's nothing honest to put there locally: the missing line is clinical
 * content, so it has to come from the model, not from a placeholder. Only the
 * gaps are re-asked, and only when some nodes have a body and others don't —
 * a diagram where *no* node has one is a legitimate shape.
 */
async function completeNodeBodies(
  slideTitle: string,
  nodes: Node[],
): Promise<Node[]> {
  const missing = nodes.filter((n) => n.heading && !n.body?.trim());
  if (missing.length === 0 || missing.length === nodes.length) return nodes;

  try {
    const result = (await generateStructured(
      `Você completa a linha de apoio de itens de um diagrama médico.
Para cada \`heading\` recebido, devolva um \`body\`: **uma linha, até 14 palavras**,
em português, no mesmo registro clínico dos outros itens do slide.
Nunca escreva referência, autor, ano ou DOI. Devolva todos os itens pedidos.`,
      `Slide: ${slideTitle}\n\nItens já completos:\n${nodes
        .filter((n) => n.body?.trim())
        .map((n) => `- ${n.heading}: ${n.body}`)
        .join("\n")}\n\nCompletar:\n${missing
        .map((n) => `- ${n.heading}`)
        .join("\n")}`,
      BODIES_SCHEMA,
    )) as { nos?: Node[] };

    const filled = new Map(
      (result.nos ?? [])
        .filter((n): n is Required<Node> => Boolean(n.heading && n.body))
        .map((n) => [n.heading.trim(), n.body.trim()]),
    );
    return nodes.map((n) =>
      n.body?.trim() || !n.heading
        ? n
        : { ...n, body: filled.get(n.heading.trim()) },
    );
  } catch (error) {
    // Best-effort: a card with no support line still beats a failed edit.
    console.warn(`Completar nós falhou: ${String(error)}`);
    return nodes;
  }
}

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
    if (Array.isArray(patch.nos) && patch.nos.length > 0) {
      patch.nos = await completeNodeBodies(
        typeof patch.titulo === "string" ? patch.titulo : slide.title,
        patch.nos as Node[],
      );
    }
    const aiPrompt =
      typeof patch.imagePrompt === "string" ? patch.imagePrompt.trim() : "";
    const aiStyle = patch.estilo === "ilustracao" ? "ilustracao" : "foto";
    if (aiPrompt && aiStyle === "ilustracao" && !illustrationFits(slide.layout)) {
      return DIAGRAM_ART_REFUSAL;
    }
    if (aiPrompt) {
      // Reserve before generating, and let the failure surface here rather than
      // as a promise the scheduled job quietly never keeps.
      try {
        await ctx.runMutation(internal.decks.reserveAiImage, { clientId });
      } catch (error) {
        return error instanceof Error
          ? error.message
          : "Limite de imagens geradas atingido.";
      }
    }

    const applied = await ctx.runMutation(internal.chatOps.applySlidePatch, {
      deckId,
      slideIndex,
      patch: JSON.stringify(patch),
    });
    if (!applied.changed) return `${reply} (nada mudou)`;

    if (aiPrompt) {
      await ctx.scheduler.runAfter(0, internal.aiImage.run, {
        deckId,
        slideIndex,
        prompt: aiPrompt,
        quality: patch.altaQualidade === true ? "alta" : "rapida",
        style: aiStyle,
      });
      return `${reply} Gerando a imagem com IA — leva alguns segundos.`;
    }

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
