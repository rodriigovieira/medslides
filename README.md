# MedSlides

Apresentações de slides para médicos, geradas por IA. Você descreve o tema e o
público; o app devolve a apresentação estruturada — com imagem de capa e notas
do apresentador em cada slide — e exporta em `.pptx`.

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
                            fal.ai (FLUX) → Convex file storage
                                       ▼
navegador ◀──(useQuery decks.get, reativo)── slides aparecem um a um
```

O streaming não usa SSE: a action vai dando `patch` no documento do deck e o
cliente re-renderiza pela reatividade do Convex. É o que permite ver a
apresentação nascer sem expor chave nenhuma no front.

### Provedores

| Papel | Serviço | Modelo |
|---|---|---|
| Texto (primário) | Gemini | `gemini-2.5-flash`, com `responseSchema` |
| Texto (fallback) | OpenAI | `gpt-4.1`, JSON mode |
| Imagens | fal.ai | `flux/schnell`, 16:9 |

O fallback dispara em 429 e 5xx — mesma regra do backend do Panda
(`getRetryableProviderStatus`). Erros 4xx nossos não caem para o outro provedor.

### Imagens

Capa e slides de seção ganham uma imagem de fundo (máx. 3 por deck, para o custo
não escalar). O modelo escreve o `imagePrompt` em inglês; a imagem é **atmosfera,
nunca informação**.

Isso é material médico, então há duas barreiras contra imagem que pareça achado
clínico: a instrução no system prompt e um filtro em código
(`convex/lib/images.ts`). O filtro cobre raio-X, TC, RM, histologia, lesão,
biópsia e afins — e ignora negações, senão o próprio "no lesions" do prompt
bloquearia o prompt.

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
npx convex env set FAL_KEY         "..."
```

## Deploy

```bash
pnpm ship    # npx convex deploy && vercel deploy --prod
```

**O auto-deploy do Git está desligado de propósito** (`vercel.json`). Um push que
publicasse só o front deixaria a Vercel na frente do Convex — que é exatamente
como se cria um deck quebrado em produção. `pnpm ship` publica os dois na ordem
certa.

Para produção, as mesmas três chaves precisam existir no deployment de prod:

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
npx convex run --prod generate:diagnoseImage '{}'
# [ "FAL_KEY presente: true", "prompt seguro: true", "imagem gerada: 360080 bytes", ... ]
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
| `convex/lib/images.ts` | fal.ai + filtro de segurança clínica. |
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

Conteúdo e imagens gerados por IA, para apoio na montagem de aulas. As imagens
são ilustrativas e nunca registro clínico. Condutas, doses e referências devem
ser conferidas antes de qualquer uso.
