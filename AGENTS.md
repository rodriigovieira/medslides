<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MedSlides

Next.js on Vercel + Convex, plus a Flutter phone app in `apps/mobile`.

## The two rules that are not style preferences

1. **A citation is never model-authored.** The model emits `citationQuery`; a
   separate system searches PubMed and attaches only articles that came back
   with a real PMID. No hit means no reference. A plausible fabricated citation
   is what gets a medical tool banned from a hospital.
2. **A generated image is labelled as one**, on the slide and in the `.pptx` —
   not only in the speaker notes. Exams, lesions, anatomical specimens and
   chemical structures are refused outright: invented, they are read as data,
   and a wrong structural formula looks exactly as convincing as the right one.

## Web

`pnpm dev`, `pnpm lint`, `pnpm build`. Deploy with `pnpm ship` (Convex first,
then Vercel — a push that shipped only the frontend would put it ahead of the
backend). Vercel git auto-deploy is off in `vercel.json` on purpose.

Slide *quality* lives in `SYSTEM_PROMPT` in `src/lib/deck.ts`. The nine layouts
are duplicated in three places — that file, `SlideView.tsx`, and `pptx.ts` —
and now a fourth, `apps/mobile/lib/slides/`. Adding one means touching all four.

`treatmentFor` / `scrimFor` in `src/lib/compose.ts` are the single source of
truth for how a slide uses its picture. The renderer, the exporter and the
fitter all read them; a slide that looks one way on screen and another in the
`.pptx` is a bug in whichever one drifted.

## Mobile (`apps/mobile`)

Flutter, managed outside the pnpm workspace:

```sh
cd apps/mobile
flutter pub get && flutter analyze && flutter test
```

- **Convex is a live subscription, not polling.** A generation writes itself
  into the deck document slide by slide and the phone watches it happen. The
  client is a vendored patched fork in `packages/convex_flutter` — do not swap
  it for the published pub package.
- **`SlideMetrics.u` is the web's `cqw`**: one hundredth of the slide's width.
  Every size in `lib/slides/` is the same number as the stylesheet's. Read them
  side by side.
- **iOS 17 is the floor** because dictation trains an on-device custom language
  model (`SFSpeechLanguageModel`), which does not exist before it.
- Signing lives in gitignored `ios/Flutter/Signing.xcconfig` (copy the
  `.example`). `scripts/testflight.sh --upload` is the only thing that ships the
  app — there is no CI for it, so a tag is never evidence of a build.
- **`flutter test` never touches a network.** The end-to-end run is
  `integration_test/smoke_test.dart`, driven by hand against a simulator, and
  it generates a **real deck on production** — the only deployment the phone
  knows. Run it before shipping; it is what caught the deck screen's action row
  overflowing and the render test hanging.

  ```sh
  flutter drive --driver=test_driver/integration_test.dart \
    --target=integration_test/smoke_test.dart -d SIMULATOR_UDID
  ```

  Wait with `pump` loops, never `pumpAndSettle`: the list's ✦ and the waiting
  screen's skeleton animate forever, so nothing this test visits ever settles.
- The `.pptx` is still exported by the browser. The phone opens the web page
  rather than carrying a second exporter that would have to be kept in step
  with the first — and the first is the one that already survived the
  iOS/WhatsApp transparency trap.

## 🚫 Never

- 🚫 Never reintroduce `transparency:` in pptx options. PowerPoint honours
  `<a:alpha>`; iOS Quick Look and the WhatsApp preview ignore it and paint the
  shape solid, burying the photo. Photo and scrim are flattened into pixels in
  `compose.ts`; assert the generated file contains zero `<a:alpha>`.
- 🚫 Never let a capability change land in the code without the prompts. Twice
  now a feature shipped while `CHAT_SYSTEM` still refused it, quoting a rule the
  product no longer had.
