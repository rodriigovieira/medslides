# MedSlides

Apresentações de slides para médicos, geradas por IA. Você descreve o tema e o
público; o app devolve a apresentação estruturada — com notas do apresentador em
cada slide — e exporta em `.pptx`.

**Ao vivo:** https://rodriigovieira.github.io/medslides/

## Como funciona

O app é 100% estático (Next.js `output: "export"`, hospedado no GitHub Pages).
Não há backend: o navegador fala direto com a API do Gemini usando uma chave que
o próprio usuário cola uma vez e que fica salva apenas no `localStorage` dele.

```
navegador → generativelanguage.googleapis.com (SSE, responseSchema)
         → parser incremental → slides aparecem um a um
         → pptxgenjs → download do .pptx
```

### Por que bring-your-own-key

GitHub Pages serve arquivos estáticos, então não existe lugar seguro para
guardar uma chave de API — qualquer chave embutida no bundle é pública. Duas
saídas:

1. **Hoje:** cada usuário usa a própria chave (gratuita no Google AI Studio).
   Zero infra, zero custo, zero chave exposta.
2. **Quando quiser esconder a chave:** suba um proxy (Convex HTTP action, uma
   função na Vercel, o que for) que receba o `DeckRequest` e repasse para o
   Gemini com a chave do servidor. Depois é só definir a variável de repositório
   `GENERATE_PROXY_URL` — o front-end passa a mandar tudo para lá e nem pede
   chave ao usuário. O código já suporta os dois modos (`src/lib/generate.ts`).

## Rodando localmente

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Abra o app, clique em **Configurar chave** e cole uma chave do
[Google AI Studio](https://aistudio.google.com/apikey).

## Build

```bash
pnpm build                # gera ./out (estático)
BASE_PATH="" pnpm build   # para domínio próprio / raiz do site
```

## Deploy

Push na `main` dispara `.github/workflows/deploy.yml`, que builda e publica no
GitHub Pages.

Variáveis de repositório opcionais (Settings → Secrets and variables → Actions →
Variables):

| Variável | Efeito |
|---|---|
| `BASE_PATH` | Subcaminho do site. Padrão `/medslides`; use `""` para domínio próprio. |
| `GENERATE_PROXY_URL` | Se definida, o app usa esse proxy em vez de pedir a chave ao usuário. |

## Estrutura

| Arquivo | Papel |
|---|---|
| `src/lib/deck.ts` | Tipos, `responseSchema` do Gemini e o system prompt (é aqui que se ajusta a qualidade dos slides). |
| `src/lib/generate.ts` | Cliente de streaming — modo direto ou via proxy. |
| `src/lib/partial.ts` | Parser tolerante que extrai slides completos do JSON ainda incompleto. |
| `src/lib/pptx.ts` | Exportação `.pptx` (pptxgenjs), espelhando os layouts do renderer. |
| `src/components/SlideView.tsx` | Renderiza um slide; tudo dimensionado em `cqw` para servir de miniatura, editor e tela cheia. |

Os seis layouts (`capa`, `secao`, `topicos`, `destaque`, `comparacao`,
`encerramento`) existem em três lugares: no schema, no `SlideView` e no
exportador. Ao adicionar um novo, atualize os três.

## Aviso

Conteúdo gerado por IA, para apoio na montagem de aulas. Não é fonte clínica —
condutas, doses e referências devem ser conferidas antes de qualquer uso.
