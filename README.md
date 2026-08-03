# MedSlides

Apresentações de slides para médicos, geradas por IA. Você descreve o tema e o
público; o app devolve a apresentação estruturada — com fotografia editorial e
notas do apresentador em cada slide — e exporta em `.pptx`.

**Ao vivo:** https://medslides.vercel.app

## Arquitetura

Next.js na Vercel + Convex como backend. **Nenhuma chave de IA chega ao
navegador.**

```
navegador ──(mutation decks.start)──▶ Convex
                                       │ agenda a action generate.run
                                       ▼
                            Gemini (stream) ──falhou 429/5xx?──▶ OpenAI
                                       │
                     grava os slides no doc conforme saem do modelo
                                       │
                    Openverse/StockSnap → Convex file storage
                                       ▼
navegador ◀──(useQuery decks.get, reativo)── slides aparecem um a um
```

O streaming não usa SSE: a action vai dando `patch` no documento do deck e o
cliente re-renderiza pela reatividade do Convex. É o que permite ver a
apresentação nascer sem expor chave nenhuma no front.

### Provedores

| Papel | Serviço | Modelo / fonte |
|---|---|---|
| Texto (primário) | Gemini | `gemini-2.5-flash`, com `responseSchema` |
| Texto (fallback) | OpenAI | `gpt-4.1`, JSON mode |
| Imagens | Openverse → StockSnap | fotografia CC0, sem chave e sem custo |

O fallback dispara em 429 e 5xx — mesma regra do backend do Panda
(`getRetryableProviderStatus`). Erros 4xx nossos não caem para o outro provedor.

### Imagens

Fotografia de banco, **não** geração por IA — foi uma escolha explícita para não
criar custo por imagem. Vem do Openverse (sem chave de API) filtrado a
`source=stocksnap`, cujo catálogo é CC0.

Duas restrições deliberadas em `convex/lib/stock.ts`:

- **Só StockSnap.** O Openverse também agrega o rawpixel, que devolve clipart
  vetorial — exatamente o visual que o redesenho combate.
- **Cache obrigatório.** O limite anônimo é 20/min e 200/dia, abaixo do nosso
  teto de decks, então nenhuma busca pode acontecer por slide. Toda busca passa
  pela tabela `imageCache` (TTL de 14 dias) em `convex/images.ts`.

O modelo escreve `imageQuery` — 2 a 4 palavras em inglês, uma **busca**, não um
prompt. A foto é ambiente, nunca informação: um filtro em código barra achado
clínico (raio-X, TC, histologia, lesão) e ignora negações, senão o próprio
"no lesions" do texto bloquearia a busca.

CC0 não exige atribuição, então o crédito fica nas notas do apresentador em vez
de sujar o slide.

### Tratamento visual

A foto tem três usos, e não um fundo único — foi o fundo único que deixava tudo
achatado:

| Layout | Tratamento |
|---|---|
| `capa` | sangria total, gradiente de baixo, título ancorado embaixo |
| `secao`, `destaque` | sangria total, gradiente lateral |
| `topicos`, `encerramento` | painel de foto à direita, texto à esquerda |
| `comparacao` | sem foto — já são duas colunas de texto |

`slidesNeedingImages` distribui as imagens ao longo do deck em vez de gastá-las
todas no começo: capa, seções e destaques sempre têm foto, e o resto do
orçamento é espalhado entre os slides de conteúdo.

## Rodando localmente

```bash
pnpm install
npx convex dev        # um terminal: backend + codegen
pnpm dev              # outro terminal: http://localhost:3000
```

As chaves ficam no Convex, não no `.env`:

```bash
npx convex env set GEMINI_API_KEY  "..."
npx convex env set OPENAI_API_KEY  "..."
# As imagens não precisam de chave.
```

## Deploy

```bash
pnpm ship    # npx convex deploy && vercel deploy --prod
```

**O auto-deploy do Git está desligado de propósito** (`vercel.json`). Um push que
publicasse só o front deixaria a Vercel na frente do Convex — que é exatamente
como se cria um deck quebrado em produção. `pnpm ship` publica os dois na ordem
certa.

Para produção, as duas chaves precisam existir no deployment de prod:

```bash
npx convex env set GEMINI_API_KEY "..." --prod
npx convex env list --prod
```

> ⚠️ `convex env set CHAVE ""` grava a variável **vazia** e ela aparece
> normalmente no `env list`. Foi assim que as imagens sumiram em produção na
> primeira subida. Confira o valor, não só o nome.

Quando uma imagem não aparecer, rode o diagnóstico em vez de adivinhar — falha de
imagem é não-fatal de propósito, então ela é silenciosa:

```bash
npx convex run --prod generate:diagnoseImage '{"query":"hospital corridor"}'
# [ "query: hospital corridor", "segura: true", "resultados: 4", "download: 325290 bytes", ... ]
```

## Estrutura

| Arquivo | Papel |
|---|---|
| `src/lib/deck.ts` | Tipos, `responseSchema` e o **system prompt** — é aqui que se ajusta a qualidade dos slides. |
| `src/lib/partial.ts` | Parser tolerante que extrai slides completos de um JSON ainda incompleto. |
| `src/lib/pptx.ts` | Exportação `.pptx`, espelhando os layouts do renderer. |
| `src/components/SlideView.tsx` | Renderiza um slide; tudo em `cqw`, então serve de miniatura, editor e tela cheia. |
| `convex/generate.ts` | A action de geração + `diagnoseImage`. |
| `convex/lib/ai.ts` | Gemini → OpenAI com fallback. |
| `convex/lib/stock.ts` | Busca no Openverse + filtro de segurança clínica. |
| `convex/images.ts` | Cache das buscas de imagem. |
| `convex/decks.ts` | CRUD, cotas e resolução das URLs de imagem. |

Os seis layouts (`capa`, `secao`, `topicos`, `destaque`, `comparacao`,
`encerramento`) vivem em três lugares: o schema em `deck.ts`, o `SlideView` e o
exportador. Ao adicionar um novo, atualize os três.

## Limites

Produto anônimo, conta nossa — as cotas são o único freio de gasto:
15 apresentações por navegador por dia e 400 no total por dia
(`convex/decks.ts`). O `clientId` é gerado no cliente, então identifica um
navegador, não uma pessoa; o teto global é a proteção real.

## Aviso

Conteúdo gerado por IA, para apoio na montagem de aulas. As fotos são de banco
(CC0), ilustrativas, e nunca registro clínico. Condutas, doses e referências
devem ser conferidas antes de qualquer uso.
