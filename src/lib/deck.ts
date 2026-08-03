export type SlideLayout =
  | "capa"
  | "secao"
  | "topicos"
  | "destaque"
  | "comparacao"
  | "encerramento"
  | "mecanismo"
  | "fluxo"
  | "cards";

/** A real article, verified against PubMed. Never model-authored. */
export type Reference = {
  n: number;
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  url: string;
};

/**
 * Vancouver-ish one-liner. Trailing periods are stripped from each part first —
 * "et al." plus a joining "." produced "et al..".
 */
export function citationLine(ref: Reference): string {
  const parts = [ref.authors, ref.journal, ref.year]
    .map((part) => (part ?? "").trim().replace(/\.+$/, ""))
    .filter(Boolean);
  return parts.length > 0 ? `${parts.join(". ")}.` : "";
}

/** A box in a diagram layout: heading plus one short explanatory line. */
export type DiagramNode = {
  heading: string;
  body?: string;
};

export type Slide = {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: { heading: string; bullets: string[] };
  right?: { heading: string; bullets: string[] };
  stat?: { value: string; label: string };
  notes?: string;
  /**
   * Free-text citation the model proposed. Kept for older decks but never
   * rendered as a citation — it is unverified.
   */
  source?: string;
  /** English description of the claim on this slide that needs evidence. */
  citationQuery?: string;
  /** 1-based numbers into `Deck.references`, filled in after verification. */
  refs?: number[];
  /**
   * Diagram content. `mecanismo` uses hub + nodes + outcome, `fluxo` and
   * `cards` use nodes alone.
   */
  hub?: string;
  nodes?: DiagramNode[];
  outcome?: string;
  /** Short English search terms for a stock photo, when the slide wants one. */
  imageQuery?: string;
  /** Photo credit, shown small on the slide. */
  imageCredit?: string;
  /** Resolved after generation; the renderer decides how to use it per layout. */
  imageUrl?: string;
};

export type Deck = {
  title: string;
  subtitle: string;
  audience: string;
  slides: Slide[];
  /** Deck-wide numbered bibliography; slides point into it via `refs`. */
  references?: Reference[];
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
  "mecanismo",
  "fluxo",
  "cards",
];

/** Diagram layouts are only renderable with nodes; without them they degrade. */
export const DIAGRAM_LAYOUTS: SlideLayout[] = ["mecanismo", "fluxo", "cards"];

function cleanNodes(value: unknown): DiagramNode[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const nodes = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.heading !== "string" || raw.heading.trim() === "") {
        return null;
      }
      const node: DiagramNode = { heading: raw.heading };
      if (typeof raw.body === "string" && raw.body) node.body = raw.body;
      return node;
    })
    .filter((node): node is DiagramNode => node !== null);
  // More than six boxes stops being a diagram and becomes a table.
  return nodes.length > 0 ? nodes.slice(0, 6) : undefined;
}

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

  const nodes = cleanNodes(raw.nodes);
  if (nodes) slide.nodes = nodes;
  if (typeof raw.hub === "string" && raw.hub) slide.hub = raw.hub;
  if (typeof raw.outcome === "string" && raw.outcome) slide.outcome = raw.outcome;

  // A diagram layout with nothing to draw would render as an empty frame.
  if (DIAGRAM_LAYOUTS.includes(slide.layout) && !slide.nodes) {
    slide.layout = "topicos";
  }

  if (typeof raw.notes === "string" && raw.notes) slide.notes = raw.notes;
  if (typeof raw.source === "string" && raw.source) slide.source = raw.source;
  if (typeof raw.citationQuery === "string" && raw.citationQuery) {
    slide.citationQuery = raw.citationQuery;
  }
  if (Array.isArray(raw.refs)) {
    const refs = raw.refs.filter(
      (n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0,
    );
    if (refs.length > 0) slide.refs = refs;
  }
  if (typeof raw.imageQuery === "string" && raw.imageQuery) {
    slide.imageQuery = raw.imageQuery;
  }
  if (typeof raw.imageCredit === "string" && raw.imageCredit) {
    slide.imageCredit = raw.imageCredit;
  }
  if (typeof raw.imageUrl === "string" && raw.imageUrl) {
    slide.imageUrl = raw.imageUrl;
  }

  return slide;
}

/**
 * Stock photos are free, so the cap exists for pacing rather than cost: a photo
 * on every slide is noise. Cover and section dividers always get one; a few
 * content slides get one to break up the rhythm.
 */
export const MAX_IMAGES_PER_DECK = 7;

export function slidesNeedingImages(slides: Slide[]): number[] {
  const wants = (index: number) =>
    Boolean(slides[index].imageQuery) && !slides[index].imageUrl;
  const is = (index: number, ...layouts: SlideLayout[]) =>
    layouts.includes(slides[index].layout);

  const indexes = slides.map((_, index) => index);

  // Structural slides always carry a photo — they're the ones that set the tone.
  const anchors = indexes.filter(
    (i) => wants(i) && is(i, "capa", "secao", "destaque"),
  );

  // Then spread the remaining budget across content slides rather than letting
  // it pile onto whatever comes first, so the deck alternates image/text
  // instead of front-loading every photo.
  const content = indexes.filter(
    (i) => wants(i) && is(i, "topicos", "encerramento"),
  );
  const budget = Math.max(0, MAX_IMAGES_PER_DECK - anchors.length);
  const stride = budget > 0 ? Math.max(1, Math.round(content.length / budget)) : 1;
  const spread = content.filter((_, position) => position % stride === 0);

  return [...anchors, ...spread.slice(0, budget)].sort((a, b) => a - b);
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
              "mecanismo",
              "fluxo",
              "cards",
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
          hub: { type: "STRING" },
          nodes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                heading: { type: "STRING" },
                body: { type: "STRING" },
              },
              required: ["heading"],
              propertyOrdering: ["heading", "body"],
            },
          },
          outcome: { type: "STRING" },
          notes: { type: "STRING" },
          citationQuery: { type: "STRING" },
          imageQuery: { type: "STRING" },
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
          "hub",
          "nodes",
          "outcome",
          "notes",
          "citationQuery",
          "imageQuery",
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
- Tópicos: no máximo **4** por slide, cada um com no máximo **10 palavras** — e
  cada tópico tem que caber em **uma linha** projetada. Se precisa de mais, ele é
  dois tópicos, ou o slide inteiro deveria ser um diagrama.
- **Prefira mostrar a listar.** Um slide que só enfileira tópicos é o formato mais
  fraco que existe: a estrutura afirmação-evidência (título que afirma + evidência
  visual) é consistentemente melhor para compreensão e memória em conteúdo
  técnico. Antes de escrever \`topicos\`, pergunte se aquilo não é um
  \`mecanismo\`, um \`fluxo\`, um \`cards\`, um \`destaque\` com um número, ou uma
  \`comparacao\`. Num deck de 10+ slides, no máximo metade deve ser \`topicos\`.
- Nunca invente autor, ano, revista, DOI ou número de artigo em lugar nenhum do
  slide — nem no título, nem nos tópicos, nem nas notas. Se uma afirmação
  precisa de fonte, descreva-a em \`citationQuery\` e deixe o sistema achar.
- Números concretos sempre que existirem: doses, cortes, prazos, percentuais. "Antibiótico precoce" é vago; "antibiótico na 1ª hora" é acionável.
- Nada de "Introdução", "Objetivos", "Agenda", "Conclusão" como títulos genéricos — vá direto ao conteúdo.
- \`notes\`: 2 a 4 frases do que o apresentador fala naquele slide. É aqui que mora a nuance, a ressalva e o contexto que não cabe na tela.
- \`citationQuery\`: **não escreva referência.** Escreva, em inglês, 4 a 10
  palavras descrevendo a afirmação clínica do slide que precisa de evidência.
  Um sistema separado busca no PubMed e anexa o artigo real; você nunca cita
  nada diretamente, e nenhuma referência sua vai para o slide.
  Ex.: título "Antibiótico na 1ª hora reduz mortalidade" →
  \`citationQuery\`: \`early antibiotic administration sepsis mortality\`.
  Preencha nos slides que afirmam conduta, dose, corte ou desfecho. Deixe vazio
  em capa, seção, encerramento e em slides puramente descritivos.

## Estrutura

- O primeiro slide é \`capa\` (título + subtítulo, sem tópicos).
- O último é \`encerramento\`: 3 a 5 mensagens que a plateia leva embora.
- Use \`secao\` para virar de assunto em apresentações mais longas.
- Use \`destaque\` (com \`stat\`) quando um número sozinho carrega o argumento — epidemiologia, mortalidade, NNT.
- Use \`comparacao\` (com \`left\` e \`right\`) para antes/depois, opção A vs B, indicações vs contraindicações.
- \`topicos\` é o resto.

### Diagramas

Três layouts desenham um esquema em vez de listar texto. **Use-os** — um
diagrama bem feito vale mais que três slides de tópicos, e é o que separa uma
aula de um amontoado de bullets. Numa apresentação de 10+ slides, use pelo menos
um.

- \`mecanismo\` — um conceito central (\`hub\`) que se abre em 3 a 4 vias
  (\`nodes\`) e converge para um resultado (\`outcome\`). É o layout de
  fisiopatologia e de mecanismo de ação.
  Ex.: hub \`Agonista de GLP-1\`; nodes \`Natriurese e diurese\`,
  \`Vasodilatação\`, \`Inibição do SRAA\`; outcome \`Redução da pressão arterial\`.
- \`fluxo\` — 3 a 5 etapas em sequência (\`nodes\`), na ordem em que acontecem.
  É o layout de protocolo, algoritmo e conduta passo a passo.
  Ex.: \`Triagem\` → \`Lactato e culturas\` → \`Antibiótico na 1ª hora\` →
  \`Reavaliar perfusão\`.
- \`cards\` — 3 a 6 blocos paralelos sem ordem entre si (\`nodes\`). É o layout de
  critérios, pilares, classes terapêuticas.

Em todos, cada \`node\` tem \`heading\` (2 a 5 palavras) e \`body\` (uma linha, até
14 palavras). Não escreva parágrafo dentro de um nó — o texto longo vai para
\`notes\`. Um diagrama não usa \`bullets\`.

## Imagens (\`imageQuery\`)

Preencha \`imageQuery\` em **todo** slide que se beneficie de uma foto: sempre na
capa e nos slides de \`secao\`, e na maioria dos \`topicos\` e \`destaque\`. Deixe
vazio em \`comparacao\` e nos diagramas (\`mecanismo\`, \`fluxo\`, \`cards\`) — esses
já têm peso visual próprio, e uma foto atrás deles só atrapalha a leitura.

\`imageQuery\` **não** é um prompt — é uma busca em banco de fotos. Escreva
**2 a 4 palavras em inglês**, concretas e fotografáveis.

- Bom: \`hospital corridor\`, \`emergency room team\`, \`stethoscope desk\`,
  \`nurse night shift\`, \`operating room lights\`, \`medication vials\`
- Ruim: \`sepsis pathophysiology\` (não é fotografável), \`a cinematic shot of...\`
  (é prompt, não busca), \`fisiopatologia\` (não está em inglês)

Regras, porque isto é material médico:

- A foto é **ambiente**, nunca informação. Nunca busque achado clínico, exame de
  imagem, lesão, ferida, lâmina ou peça anatômica — uma foto dessas ao lado de um
  texto clínico é lida como evidência do caso, e não é.
- Prefira o genérico e digno: equipe, ambiente, instrumental, luz de enfermaria.
- Se o assunto do slide não tiver uma imagem óbvia e honesta, use o ambiente onde
  aquilo acontece (\`intensive care unit\`, \`ambulance night\`) em vez de forçar.

## Segurança clínica

Você está escrevendo material que orienta conduta médica. Onde a recomendação depende de contexto (função renal, gestação, pediatria, disponibilidade local), diga isso no slide ou nas notas. Prefira o que é consolidado em diretriz ao que é preliminar. Se o tema for controverso, apresente a controvérsia em vez de escolher um lado em silêncio.

Adapte o vocabulário ao público: com pacientes, sem jargão e sem dose; com especialistas, sem explicar o básico.`;
