export type SlideLayout =
  | "capa"
  | "secao"
  | "topicos"
  | "destaque"
  | "comparacao"
  | "encerramento";

export type Slide = {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: { heading: string; bullets: string[] };
  right?: { heading: string; bullets: string[] };
  stat?: { value: string; label: string };
  notes?: string;
  source?: string;
  /** English prompt for the backdrop image, when this slide should have one. */
  imagePrompt?: string;
  /** Resolved after generation; the renderer treats it as a full-bleed backdrop. */
  imageUrl?: string;
};

export type Deck = {
  title: string;
  subtitle: string;
  audience: string;
  slides: Slide[];
};

export type DeckRequest = {
  topic: string;
  audience: string;
  slideCount: number;
  depth: "panorama" | "aprofundado";
};

const LAYOUTS: SlideLayout[] = [
  "capa",
  "secao",
  "topicos",
  "destaque",
  "comparacao",
  "encerramento",
];

function cleanStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
  return out.length > 0 ? out : undefined;
}

function cleanColumn(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const bullets = cleanStrings(raw.bullets);
  if (typeof raw.heading !== "string" || !bullets) return undefined;
  return { heading: raw.heading, bullets };
}

/**
 * The database validator is strict, so anything the model invents — an unknown
 * layout, a stray field, a bullet that came back as a number — has to be
 * dropped here rather than blowing up the whole generation.
 */
export function sanitizeSlide(value: unknown): Slide | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string" || raw.title.trim() === "") return null;

  const layout = LAYOUTS.includes(raw.layout as SlideLayout)
    ? (raw.layout as SlideLayout)
    : "topicos";

  const slide: Slide = { layout, title: raw.title };

  if (typeof raw.subtitle === "string" && raw.subtitle) {
    slide.subtitle = raw.subtitle;
  }
  const bullets = cleanStrings(raw.bullets);
  if (bullets) slide.bullets = bullets;

  const left = cleanColumn(raw.left);
  if (left) slide.left = left;
  const right = cleanColumn(raw.right);
  if (right) slide.right = right;

  if (raw.stat && typeof raw.stat === "object") {
    const stat = raw.stat as Record<string, unknown>;
    if (typeof stat.value === "string" && typeof stat.label === "string") {
      slide.stat = { value: stat.value, label: stat.label };
    }
  }

  if (typeof raw.notes === "string" && raw.notes) slide.notes = raw.notes;
  if (typeof raw.source === "string" && raw.source) slide.source = raw.source;
  if (typeof raw.imagePrompt === "string" && raw.imagePrompt) {
    slide.imagePrompt = raw.imagePrompt;
  }
  if (typeof raw.imageUrl === "string" && raw.imageUrl) {
    slide.imageUrl = raw.imageUrl;
  }

  return slide;
}

/** Slides that get a backdrop image, capped so a deck stays cheap to make. */
export const MAX_IMAGES_PER_DECK = 3;

export function slidesNeedingImages(slides: Slide[]): number[] {
  const eligible = slides
    .map((slide, index) => ({ slide, index }))
    .filter(
      ({ slide }) =>
        slide.imagePrompt &&
        !slide.imageUrl &&
        (slide.layout === "capa" ||
          slide.layout === "secao" ||
          slide.layout === "destaque"),
    );

  // Cover first, then section dividers in order.
  eligible.sort((a, b) => {
    const rank = (l: SlideLayout) => (l === "capa" ? 0 : l === "secao" ? 1 : 2);
    return rank(a.slide.layout) - rank(b.slide.layout) || a.index - b.index;
  });

  return eligible.slice(0, MAX_IMAGES_PER_DECK).map(({ index }) => index);
}

export function sanitizeSlides(values: unknown[]): Slide[] {
  return values
    .map(sanitizeSlide)
    .filter((slide): slide is Slide => slide !== null);
}

export const AUDIENCES = [
  "Residentes e internos",
  "Colegas especialistas (congresso)",
  "Equipe multiprofissional",
  "Pacientes e familiares",
  "Estudantes de medicina",
] as const;

export const EXAMPLES = [
  {
    label: "Aula para residentes",
    topic: "Manejo inicial da sepse e choque séptico no pronto-socorro",
    audience: "Residentes e internos",
  },
  {
    label: "Atualização de congresso",
    topic:
      "Novidades em imunoterapia para câncer de pulmão não pequenas células",
    audience: "Colegas especialistas (congresso)",
  },
  {
    label: "Orientação a pacientes",
    topic: "Cuidados no pós-operatório de artroplastia total de joelho",
    audience: "Pacientes e familiares",
  },
  {
    label: "Treinamento de equipe",
    topic: "Protocolo institucional de prevenção de quedas na enfermaria",
    audience: "Equipe multiprofissional",
  },
];

const COLUMN_SCHEMA = {
  type: "OBJECT",
  properties: {
    heading: { type: "STRING" },
    bullets: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["heading", "bullets"],
} as const;

/**
 * Gemini's responseSchema is an OpenAPI 3.0 subset — uppercase type names, no
 * `additionalProperties`. `propertyOrdering` matters here: the model emits keys
 * in this order, so putting `layout` and `title` first means the streaming
 * parser can show a slide's shape as soon as it starts arriving.
 *
 * The layout vocabulary is small on purpose: the model picks a shape, and both
 * the renderer and the .pptx exporter know how to draw every one of them.
 */
export const DECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    subtitle: { type: "STRING" },
    audience: { type: "STRING" },
    slides: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          layout: {
            type: "STRING",
            enum: [
              "capa",
              "secao",
              "topicos",
              "destaque",
              "comparacao",
              "encerramento",
            ],
          },
          title: { type: "STRING" },
          subtitle: { type: "STRING" },
          bullets: { type: "ARRAY", items: { type: "STRING" } },
          left: COLUMN_SCHEMA,
          right: COLUMN_SCHEMA,
          stat: {
            type: "OBJECT",
            properties: {
              value: { type: "STRING" },
              label: { type: "STRING" },
            },
            required: ["value", "label"],
          },
          notes: { type: "STRING" },
          source: { type: "STRING" },
          imagePrompt: { type: "STRING" },
        },
        required: ["layout", "title", "notes"],
        propertyOrdering: [
          "layout",
          "title",
          "subtitle",
          "stat",
          "bullets",
          "left",
          "right",
          "notes",
          "source",
          "imagePrompt",
        ],
      },
    },
  },
  required: ["title", "subtitle", "audience", "slides"],
  propertyOrdering: ["title", "subtitle", "audience", "slides"],
} as const;

export function buildPrompt(req: DeckRequest): string {
  return [
    `Monte uma apresentação de slides sobre: "${req.topic}".`,
    ``,
    `Público: ${req.audience}.`,
    `Número de slides: exatamente ${req.slideCount} (contando capa e encerramento).`,
    `Profundidade: ${
      req.depth === "aprofundado"
        ? "aprofundada — assuma domínio técnico, entre em condutas, doses, critérios e evidência."
        : "panorâmica — priorize os conceitos estruturantes e a visão geral."
    }`,
  ].join("\n");
}

export const SYSTEM_PROMPT = `Você monta apresentações de slides para médicos, em português do Brasil.

Quem lê seus slides está numa sala, à distância, com pouco tempo. O slide é o apoio visual — não o texto da fala. A fala vai nas notas do apresentador.

## Como escrever cada slide

- Título: uma afirmação, não um rótulo. "Lactato > 2 mmol/L define choque" ensina; "Lactato" não.
- Tópicos: no máximo 5 por slide, cada um com no máximo 12 palavras. Sem frases completas, sem ponto final. Se um tópico precisa de mais que isso, ele é dois tópicos ou é um slide.
- Números concretos sempre que existirem: doses, cortes, prazos, percentuais. "Antibiótico precoce" é vago; "antibiótico na 1ª hora" é acionável.
- Nada de "Introdução", "Objetivos", "Agenda", "Conclusão" como títulos genéricos — vá direto ao conteúdo.
- \`notes\`: 2 a 4 frases do que o apresentador fala naquele slide. É aqui que mora a nuance, a ressalva e o contexto que não cabe na tela.
- \`source\`: preencha apenas quando você tem confiança real na referência (diretriz, sociedade, ensaio marcante). Cite como "Surviving Sepsis Campaign 2021" ou "SBC, Diretriz de IC 2022". Nunca invente número de artigo, DOI, ano ou autor — na dúvida, deixe vazio.

## Estrutura

- O primeiro slide é \`capa\` (título + subtítulo, sem tópicos).
- O último é \`encerramento\`: 3 a 5 mensagens que a plateia leva embora.
- Use \`secao\` para virar de assunto em apresentações mais longas.
- Use \`destaque\` (com \`stat\`) quando um número sozinho carrega o argumento — epidemiologia, mortalidade, NNT.
- Use \`comparacao\` (com \`left\` e \`right\`) para antes/depois, opção A vs B, indicações vs contraindicações.
- \`topicos\` é o resto.

## Imagens (\`imagePrompt\`)

Preencha \`imagePrompt\` na **capa** e em cada slide de \`secao\` — são os slides que
ganham uma imagem de fundo. Nos demais, deixe vazio.

O prompt vai para um gerador de imagens, então escreva **em inglês**, descrevendo
uma fotografia editorial de ambiente. A imagem é atmosfera, não informação.

Regras rígidas, porque isto é material médico:

- **Nunca** peça imagem de achado clínico, exame de imagem, lesão, lâmina,
  peça anatômica, gráfico ou diagrama. Uma imagem gerada que pareça um raio-X,
  uma TC ou uma histologia é desinformação — não importa quão bonita seja.
- **Nunca** peça rostos reconhecíveis de pacientes ou pessoas em situação de
  vulnerabilidade.
- Sempre termine o prompt com: \`no text, no words, no letters, no charts\`.
- Prefira ambientes e objetos: corredor de emergência à noite, equipe de
  plantão desfocada ao fundo, instrumental sobre campo estéril, luz de janela em
  enfermaria vazia, detalhe de estetoscópio, monitor fora de foco.

Exemplo bom: \`empty hospital emergency corridor at night, cool blue light, shallow depth of field, editorial photography, cinematic, no text, no words, no letters, no charts\`

## Segurança clínica

Você está escrevendo material que orienta conduta médica. Onde a recomendação depende de contexto (função renal, gestação, pediatria, disponibilidade local), diga isso no slide ou nas notas. Prefira o que é consolidado em diretriz ao que é preliminar. Se o tema for controverso, apresente a controvérsia em vez de escolher um lado em silêncio.

Adapte o vocabulário ao público: com pacientes, sem jargão e sem dose; com especialistas, sem explicar o básico.`;
