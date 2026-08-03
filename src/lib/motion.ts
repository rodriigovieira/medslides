/**
 * Slide motion, for the screen only.
 *
 * Two effects, both derived from what the deck already declares — a doctor never
 * configures motion:
 *
 * 1. **Build.** The elements of a slide arrive in reading order instead of all
 *    at once, so the room follows the argument rather than scanning the slide.
 * 2. **Move.** When two consecutive slides carry the same thing — the same
 *    photo, the same number, the same heading — it travels between its two
 *    positions instead of cross-fading. This is the "the heart moves left and
 *    shrinks, then the diagram appears on the right" effect.
 *
 * ## Why hand-rolled FLIP and not the View Transitions API
 *
 * The obvious tool for (2) is `document.startViewTransition`, and it was the
 * first thing tried. Three things ruled it out:
 *
 * - It animates *rasterised snapshots*. `destaque` shows its number at 13cqw and
 *   a `mecanismo` hub shows it at 2.1cqw — a 6× scale. Scaling a bitmap across
 *   that range is visibly soft on a projector, where the whole point of the
 *   number is that it is legible from the back of the room. FLIP transforms the
 *   live element, so the glyphs stay sharp at both ends.
 * - Firefox only shipped same-document transitions recently and Safari needs 18+.
 *   A presenter's laptop at a congress is whatever the venue handed them.
 * - Interruption is all-or-nothing: a second `startViewTransition` skips the
 *   first wholesale. Here we want the finished state *immediately* on the next
 *   tap, per element, which `Animation.cancel()` gives us for free.
 *
 * Framer Motion's `layoutId` does the same FLIP, correctly, in ~35 kB. This file
 * is the ~120 lines of it we actually need, and the app has no motion library.
 *
 * ## The rule that makes this safe
 *
 * **Nothing here is load-bearing for content.** Every element is rendered by
 * React at its finished position, with its finished styles; motion only ever
 * applies a temporary `transform`/`opacity` on top via the Web Animations API.
 * If this module never runs — JS fails, `prefers-reduced-motion`, an old browser
 * without `element.animate` — the slide is simply already finished. There is no
 * code path where an animation failing leaves a number hidden from the room.
 *
 * Nothing here touches `compose.ts` or `pptx.ts`: the `.pptx` is a static export
 * and the marks below are `data-` attributes that only exist in the presenter's
 * DOM.
 */

import {
  DEFAULT_PRESET,
  MOTION_PACES,
  MOTION_PRESETS,
  type MotionPace,
  type MotionPreset,
} from "./deck";

export { DEFAULT_PRESET, type MotionPace, type MotionPreset };


/** Entrances: confident, no overshoot. A congress talk, not a product launch. */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/**
 * Travel is eased at both ends instead.
 *
 * The build's curve covers ~85% of the distance in the first quarter of the
 * duration, which is right for something appearing — it is on screen almost at
 * once — and wrong for something moving: measured mid-flight the element had
 * already all but arrived, so the eye reads a jump rather than a path. A moving
 * object has to accelerate away and decelerate in for the audience to follow it
 * from one position to the other, which is the entire point of the effect.
 */
const EASE_MOVE = "cubic-bezier(0.4, 0, 0.2, 1)";

const BUILD_MS = 300;
const STAGGER_MS = 80;
const MOVE_MS = 420;

/**
 * `solene` × `transformar` is 1.8 × 1200 ms = 2160 ms, which is the reference
 * deck's `dur="2000"` morph. Our default is deliberately faster than the
 * reference: that deck is projected at a congress and read from thirty metres,
 * and the same 2 s on a laptop being watched from a metre away feels sluggish.
 * The doctor who wants the congress pacing asks for it by name.
 */
const PACE_FACTOR: Record<MotionPace, number> = {
  rapido: 0.65,
  normal: 1,
  solene: 1.8,
};

type Recipe = {
  /** Multiplies the gap between staged elements. 1 = 80 ms. */
  stagger: number;
  /** Multiplies how long each element takes to arrive. 1 = 300 ms. */
  build: number;
  /** Multiplies shared-element travel. 1 = 420 ms. */
  move: number;
  /** The `mecanismo` hub opening centre-stage. */
  hero: boolean;
  /** Staged elements also grow in slightly, not just rise. */
  grow: boolean;
  /** The big number zooms rather than rises. */
  zoom: boolean;
  /** One pulse on the key element after the build settles. */
  pulse: boolean;
  /** Nothing else starts until the shared-element travel has landed. */
  hold: boolean;
};

/**
 * The named presets, and why these eight.
 *
 * They were derived from a real specialist-made deck — ESC Cardio-Oncology
 * 2026, 32 slides — whose animation XML we read. What that deck actually does:
 *
 * - **17 of its 32 slides have no transition at all.** Motion is concentrated on
 *   the slides that carry an argument. That restraint is most of why it reads as
 *   expensive rather than busy, so `nenhuma` is a first-class preset and not an
 *   afterthought — a deck where everything moves is the failure mode.
 * - Builds on 15 slides, effect counts: Zoom entrance ×63, Fly In ×32,
 *   Grow/Shrink ×25, Glide ×22, Fade exit ×13, Fade entrance ×10. Zoom leading
 *   by a factor of two is why `numero` exists as its own preset.
 * - Almost every trigger is "with previous", chained by delay rather than
 *   clicked — measured stagger on its slide 3 was 0/300/500/750/1000 ms, so
 *   ~250 ms apart. That is `progressiva`, and `pace: "solene"` on top of it.
 * - PowerPoint Morph (`byObject`, `spd="slow"`, `dur=2000`) on 8 slides,
 *   including a 14→15→16 chain holding one figure across three slides. That is
 *   `transformar`.
 *
 * Each preset is a *tested motion*, not a parameter surface: the doctor and the
 * model both name it in Portuguese and get exactly one thing. Anything that
 * would need a keyframe list to express is deliberately not expressible.
 */
const MOTION_RECIPES: Record<MotionPreset, Recipe | null> = {
  /**
   * No motion. The slide is simply there — 17 of the reference deck's 32.
   *
   * `null` is not "a recipe with everything off": it is an early return in
   * `playSlideMotion`, so the slide costs no measurement at all and there is no
   * code path that could leave it half-built.
   */
  nenhuma: null,

  /**
   * The default, and what every deck made before this feature existed gets:
   * elements arrive in reading order, and anything repeated from the previous
   * slide travels instead of blinking.
   */
  suave: { stagger: 1, build: 1, move: 1, hero: true, grow: false, zoom: false, pulse: false, hold: false },

  /**
   * The reference deck's own pacing: 80 × 3.1 ≈ 250 ms apart, which is what its
   * slide 3 measured. For a slide whose bullets are the argument.
   */
  progressiva: { stagger: 3.1, build: 1.6, move: 1, hero: true, grow: false, zoom: false, pulse: false, hold: false },

  /**
   * The gesture the feature was asked for — hub centre-stage, then left and
   * smaller while the branches arrive. Identical to `suave` on purpose: the hero
   * is already automatic on `mecanismo`, and this name exists so a doctor can
   * *ask* for it, and so `chat.ts` can refuse it on a layout that has no hub
   * rather than silently doing nothing.
   */
  heroi: { stagger: 1, build: 1, move: 1, hero: true, grow: false, zoom: false, pulse: false, hold: false },

  /**
   * Zoom entrance on the big number — the reference deck's most-used effect, by
   * a factor of two over anything else. Slightly wider stagger so the number is
   * not still growing while its caption lands.
   */
  numero: { stagger: 1.4, build: 1.2, move: 1, hero: true, grow: false, zoom: true, pulse: false, hold: false },

  /**
   * A protocol one step at a time: 80 × 4.4 ≈ 350 ms, slower than the reference
   * deck's bullets because a step is a thing you wait for rather than read, plus
   * the deck's Grow/Shrink on each step as it lands.
   */
  etapas: { stagger: 4.4, build: 1.4, move: 1, hero: true, grow: true, zoom: false, pulse: false, hold: false },

  /**
   * Morph: 420 × 2.86 = 1200 ms of travel, and the rest of the slide holds until
   * it lands. `hero: false` because the two compete — the hub cannot both fly in
   * from the previous slide and open centre-stage, and the flight is the truer
   * story of where the concept came from.
   */
  transformar: { stagger: 1, build: 1, move: 2.86, hero: false, grow: false, zoom: false, pulse: false, hold: true },

  /** A normal build, then one pulse on the key element after it has settled. */
  destacar: { stagger: 1, build: 1, move: 1, hero: true, grow: false, zoom: false, pulse: true, hold: false },
};

/** What `playSlideMotion` is handed: a resolved preset plus its tempo. */
export type MotionPlan = { preset: MotionPreset; pace: MotionPace };

export function isPreset(value: unknown): value is MotionPreset {
  return MOTION_PRESETS.includes(value as MotionPreset);
}

export function isPace(value: unknown): value is MotionPace {
  return MOTION_PACES.includes(value as MotionPace);
}

/**
 * An unknown preset falls back to the default rather than to no motion.
 *
 * A deck saved by a newer build carries preset names this build has never heard
 * of. Treating those as `nenhuma` would make the presenter silently stop
 * animating; treating them as `suave` gives the same slide the same content and
 * roughly the right feel. Nothing here can fail closed onto missing content —
 * the slide is fully rendered either way.
 */
export function resolvePlan(animation: unknown): MotionPlan {
  const raw = (animation ?? {}) as { preset?: unknown; pace?: unknown };
  return {
    preset: isPreset(raw.preset) ? raw.preset : DEFAULT_PRESET,
    pace: isPace(raw.pace) ? raw.pace : "normal",
  };
}

/**
 * The hero opening on `mecanismo`: the hub lands centre-stage, holds long enough
 * to be read on its own, then moves to its resting place on the left while the
 * branches arrive on the right.
 */
const HERO_MS = 900;
const HERO_SCALE = 1.7;
/** Fractions of `HERO_MS`: fade in, hold, then move. */
const HERO_ARRIVED = 0.24;
const HERO_DEPARTS = 0.46;
/**
 * When the branches start. Deliberately *before* the hub finishes its move —
 * overlapping the two reads as one gesture, where waiting for the hub to land
 * reads as two separate animations and costs the presenter another 200ms.
 */
export const HERO_HANDOFF_MS = 700;

/**
 * A slide with more staged elements than this stops feeling deliberate and
 * starts feeling slow, so the tail arrives together.
 */
const MAX_STAGE = 6;

export type Marks = Record<string, string>;

const NONE: Marks = {};

/**
 * A staged element records its *ordinal*, not a delay in milliseconds.
 *
 * The delay is only knowable once the preset is: `progressiva` spaces elements
 * 250 ms apart where `suave` uses 80. Baking a number in at render time meant
 * the components would each have to know the preset, and the hand-off base
 * (`HERO_HANDOFF_MS`, a duration) would get scaled by the stagger multiplier
 * along with it, which drifts the branches away from the hub they are supposed
 * to overlap. So the mark is `base:index` and `motion.ts` scales the two parts
 * by different factors.
 */
export function buildMark(index: number, baseMs = 0): Marks {
  const i = Math.max(0, Math.round(index));
  const base = Math.max(0, Math.round(baseMs));
  return { "data-build": `${base}:${i}` };
}

function buildDelay(el: HTMLElement, recipe: Recipe, pace: number): number {
  const [base, index] = (el.dataset.build ?? "0:0").split(":").map(Number);
  const step = Math.min(index || 0, MAX_STAGE) * STAGGER_MS * recipe.stagger;
  return ((base || 0) + step) * pace;
}

/**
 * Normalises text into a key two slides can match on: accents folded, case
 * dropped, punctuation collapsed. `%`, `<`, `>`, `≥` and `≤` survive because in
 * this material they are the content ("PD-L1 ≥ 50%"), not punctuation.
 *
 * Deliberately conservative. A wrong match makes an unrelated word fly across
 * the slide and looks broken; a missed match just cross-fades, which is the
 * behaviour we had before this file existed. Anything under three characters is
 * dropped — "IV", "T4" and "n" collide across slides that have nothing to do
 * with each other.
 */
export function textKey(text: string | undefined | null): Marks {
  if (!text) return NONE;
  const key = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%<>≥≤]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (key.length < 3) return NONE;
  return { "data-shared": `t:${key}` };
}

/** Photos match on the exact storage URL — no heuristic can be wrong here. */
export function imageKey(url: string | undefined): Marks {
  return url ? { "data-shared": `i:${url}` } : NONE;
}

export const heroMark: Marks = { "data-hero": "" };
export const heroStageMark: Marks = { "data-hero-stage": "" };

/**
 * Semantic marks: they say *what an element is*, never how it moves.
 *
 * Presets choose behaviour from these, which is what keeps the components free
 * of preset names — `SlideView` says "this is the big number", and `numero`
 * decides that the big number zooms. Adding a preset touches this file only.
 */
export const statMark: Marks = { "data-stat": "" };
export const keyMark: Marks = { "data-key": "" };

function reduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type SlideRects = Map<string, DOMRect>;

/**
 * Where every shared element sits *right now*, before React swaps the slide.
 *
 * A key that appears twice on one slide is dropped rather than guessed at: with
 * two candidates there is no way to know which one the next slide means, and
 * picking the first would fly the wrong one.
 */
export function snapshotSlide(root: HTMLElement | null): SlideRects | null {
  if (!root || reduced()) return null;
  const rects: SlideRects = new Map();
  const ambiguous = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-shared]")) {
    const key = el.dataset.shared;
    if (!key) continue;
    if (rects.has(key)) ambiguous.add(key);
    else rects.set(key, contentRect(el));
  }
  for (const key of ambiguous) rects.delete(key);
  return rects;
}

/**
 * The box of what you can actually *see* inside the element, not the element.
 *
 * The two are wildly different for text. A `secao` title is a block capped at
 * 72cqw holding the left-aligned word "Prevenção"; the `topicos` title it morphs
 * into is a full-width block holding the same word, also left-aligned. Their
 * element boxes have centres 14cqw apart with no glyph anywhere near either
 * centre, so matching element centres flew "Prevenção" off the left edge of the
 * slide on its way to a position it was almost already at. Caught on
 * `transformar`, where 1200 ms makes it impossible to miss; it was wrong at
 * 420 ms too, just quick enough to read as a flicker.
 *
 * A Range over the contents gives the glyph box, which is the thing the eye is
 * tracking. Images keep the element box: the wrapper *is* the visible thing, and
 * `cropFrames` needs its exact edges to close the crop.
 */
function contentRect(el: HTMLElement): DOMRect {
  if (el.querySelector("img")) return el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  return rect.width && rect.height ? rect : el.getBoundingClientRect();
}

/**
 * Snaps everything in flight to its finished state.
 *
 * Called before every advance, which is what makes tapping through fast feel
 * instant: `cancel()` drops the animation's effect, and because every element is
 * already rendered at its finished position by React, dropping the effect *is*
 * the finished slide. Nothing queues, and the rects we measure next are settled
 * ones rather than a frame from halfway through the last transition.
 */
export function stopSlideMotion(root: HTMLElement | null): void {
  if (!root) return;
  for (const animation of root.getAnimations({ subtree: true })) {
    animation.cancel();
  }
}

/**
 * Runs the transition into the slide now in the DOM. `before` is the snapshot
 * taken from the outgoing slide, or null on first paint (build only).
 *
 * Must be called from a layout effect: it measures the new positions and starts
 * the animations in the same frame React committed them, so nothing is ever
 * painted at the wrong place first.
 */
export function playSlideMotion(
  root: HTMLElement | null,
  before: SlideRects | null,
  plan: MotionPlan = { preset: DEFAULT_PRESET, pace: "normal" },
): void {
  if (!root || reduced()) return;
  stopSlideMotion(root);
  const recipe = MOTION_RECIPES[plan.preset];
  // `nenhuma`, or a preset this build doesn't know. Either way the slide is
  // already fully rendered by React, so returning here *is* the finished slide.
  if (!recipe) return;
  const pace = PACE_FACTOR[plan.pace] ?? 1;

  const moveMs = MOVE_MS * recipe.move * pace;
  const moved = moveShared(root, before, moveMs);
  // `transformar` is the one preset where the rest of the slide waits: the point
  // is to watch one figure being transformed, and a build running underneath it
  // is the second thing on screen that stops you seeing the first.
  const hold = recipe.hold && moved.length > 0 ? moveMs : 0;
  if (recipe.hero) playHero(root, moved, pace);
  playBuild(root, moved, recipe, pace, hold);
  if (recipe.pulse) playPulse(root, moved, recipe, pace, hold, moveMs);
}

/**
 * The slide's key element, for the presets that single one out.
 *
 * Ordered by how much of the slide the element *is*: a `destaque` is its number,
 * a `mecanismo` is its hub, and everything else falls back to the title.
 */
function keyElement(root: HTMLElement): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>("[data-stat]") ??
    root.querySelector<HTMLElement>("[data-hero]") ??
    root.querySelector<HTMLElement>("[data-key]")
  );
}

/** An element is left alone if it, or anything it wraps, is already moving. */
function isBusy(el: HTMLElement, moved: HTMLElement[]): boolean {
  return moved.some((m) => m === el || m.contains(el) || el.contains(m));
}

function moveShared(
  root: HTMLElement,
  before: SlideRects | null,
  moveMs: number,
): HTMLElement[] {
  if (!before || before.size === 0) return [];

  const candidates = new Map<string, HTMLElement | null>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-shared]")) {
    const key = el.dataset.shared;
    if (!key) continue;
    // Same ambiguity rule as the snapshot, on the arriving side.
    candidates.set(key, candidates.has(key) ? null : el);
  }

  const moved: HTMLElement[] = [];
  for (const [key, el] of candidates) {
    const from = el && before.get(key);
    if (!el || !from) continue;
    const to = contentRect(el);
    if (!from.width || !from.height || !to.width || !to.height) continue;

    // It matched, so it must not also fade in — even if it turns out not to
    // move, re-fading a title that stayed put is the flicker this replaces.
    moved.push(el);

    const crop = Boolean(el.querySelector("img"));
    const keyframes = crop
      ? cropFrames(from, to)
      : textFrames(from, to, el.getBoundingClientRect());
    if (!keyframes) continue;

    el.animate(keyframes, { duration: moveMs, easing: EASE_MOVE });

    if (crop) {
      // The wrapper is being scaled non-uniformly (full-bleed 100cqw → a 41cqw
      // panel), which would squash the photograph. Scaling the <img> by the
      // inverse keeps its pixels at their natural aspect inside the shrinking
      // frame, so the move reads as a crop closing in rather than a stretch.
      // The wrapper is `overflow-hidden` for exactly this.
      const img = el.querySelector("img");
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      img?.animate(
        [
          { transform: `scale(${1 / sx}, ${1 / sy})`, transformOrigin: "0 0" },
          { transform: "scale(1, 1)", transformOrigin: "0 0" },
        ],
        { duration: moveMs, easing: EASE_MOVE },
      );
    }
  }
  return moved;
}

/** Under a pixel and a percent, moving it is a 420ms no-op. */
function isStill(dx: number, dy: number, sx: number, sy: number): boolean {
  return (
    Math.abs(dx) < 1 &&
    Math.abs(dy) < 1 &&
    Math.abs(sx - 1) < 0.01 &&
    Math.abs(sy - 1) < 0.01
  );
}

function cropFrames(from: DOMRect, to: DOMRect): Keyframe[] | null {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  if (isStill(dx, dy, sx, sy)) return null;
  return [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      transformOrigin: "0 0",
    },
    { transform: "translate(0px, 0px) scale(1, 1)", transformOrigin: "0 0" },
  ];
}

/**
 * Text moves centre-to-centre at a *uniform* scale taken from the height ratio.
 *
 * Its box aspect changes between layouts (a stat sits in a wide short box, a hub
 * in a narrow tall one), and matching the box exactly would stretch the glyphs
 * horizontally for the whole flight. Height is the honest proxy for font size,
 * which is the thing the eye is actually tracking.
 */
function textFrames(
  from: DOMRect,
  to: DOMRect,
  box: DOMRect,
): Keyframe[] | null {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.height / to.height;
  if (isStill(dx, dy, s, s)) return null;
  // The transform is applied to the element, but the thing that has to land in
  // the right place is the *text*. Pinning the origin to the glyph box's centre,
  // expressed in the element's own coordinates, makes the scale happen around
  // the text rather than around the middle of whatever block contains it — so
  // the translation above is the only thing that moves it.
  const origin = `${to.left + to.width / 2 - box.left}px ${
    to.top + to.height / 2 - box.top
  }px`;
  return [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      transformOrigin: origin,
    },
    { transform: "translate(0px, 0px) scale(1)", transformOrigin: origin },
  ];
}

function playHero(root: HTMLElement, moved: HTMLElement[], pace: number): void {
  const el = root.querySelector<HTMLElement>("[data-hero]");
  const stageEl = el?.closest<HTMLElement>("[data-hero-stage]");
  if (!el || !stageEl) return;
  // If the hub already matched something on the previous slide, that move is
  // the truer one — it says where this concept came from. Don't do both.
  if (isBusy(el, moved)) return;

  const from = el.getBoundingClientRect();
  const box = stageEl.getBoundingClientRect();
  if (!from.width || !box.width) return;

  const dx = box.left + box.width / 2 - (from.left + from.width / 2);
  const dy = box.top + box.height / 2 - (from.top + from.height / 2);
  const centred = `translate(${dx}px, ${dy}px) scale(${HERO_SCALE})`;
  const resting = "translate(0px, 0px) scale(1)";

  el.animate(
    [
      { offset: 0, opacity: 0, transform: centred, easing: EASE },
      { offset: HERO_ARRIVED, opacity: 1, transform: centred, easing: "linear" },
      { offset: HERO_DEPARTS, opacity: 1, transform: centred, easing: EASE_MOVE },
      { offset: 1, opacity: 1, transform: resting },
    ],
    // The hand-off constant the branches key off is a *duration*, so it scales
    // with the pace and not with the stagger — otherwise `progressiva` would
    // push the branches 3× later while the hub still landed at the old moment.
    { duration: HERO_MS * pace, fill: "backwards" },
  );
}

function playBuild(
  root: HTMLElement,
  moved: HTMLElement[],
  recipe: Recipe,
  pace: number,
  hold: number,
): void {
  const stat = recipe.zoom ? root.querySelector<HTMLElement>("[data-stat]") : null;

  for (const el of root.querySelectorAll<HTMLElement>("[data-build]")) {
    if (isBusy(el, moved)) continue;
    const delay = hold + buildDelay(el, recipe, pace);
    const duration = BUILD_MS * recipe.build * pace;

    // The number *is* the slide, so under `numero` it arrives by growing into
    // place from the middle of its own box rather than sliding up a third of a
    // line. Scale only — the reference deck's Zoom entrance, which it uses twice
    // as often as anything else.
    if (stat && (el === stat || el.contains(stat))) {
      el.animate(
        [
          { opacity: 0, transform: "scale(0.62)", transformOrigin: "50% 50%" },
          { opacity: 1, transform: "scale(1)", transformOrigin: "50% 50%" },
        ],
        { duration: duration * 1.5, delay, easing: EASE, fill: "backwards" },
      );
      continue;
    }

    el.animate(
      [
        // `em` rather than px so the rise is proportional to the type — the same
        // build has to look right on a phone and on a 4 m projection.
        {
          opacity: 0,
          transform: recipe.grow
            ? "translateY(0.35em) scale(0.94)"
            : "translateY(0.35em)",
        },
        {
          opacity: 1,
          transform: recipe.grow ? "translateY(0) scale(1)" : "translateY(0)",
        },
      ],
      { duration, delay, easing: EASE, fill: "backwards" },
    );
  }
}

/**
 * One pulse on the key element, *after* the slide has settled.
 *
 * Scale only, and small: 6% is enough to catch the eye on a projection and
 * small enough that a heading sitting next to other text doesn't visibly
 * collide with it. It never runs while the element is still arriving — an
 * emphasis that overlaps the entrance reads as a wobble, not as emphasis.
 */
function playPulse(
  root: HTMLElement,
  moved: HTMLElement[],
  recipe: Recipe,
  pace: number,
  hold: number,
  moveMs: number,
): void {
  const el = keyElement(root);
  if (!el) return;

  // Whichever way this element got here, the pulse starts after it has landed.
  // Getting this wrong is not a subtle bug: two WAAPI animations writing
  // `transform` on one element means the later one wins outright, so a pulse
  // that overlapped the entrance would cancel the entrance's own transform and
  // the element would jump into place.
  const own = el.closest<HTMLElement>("[data-build]");
  let arrival = own
    ? buildDelay(own, recipe, pace) + BUILD_MS * recipe.build * pace
    : 0;
  if (isBusy(el, moved)) arrival = Math.max(arrival, moveMs);
  if (recipe.hero && el.matches("[data-hero]")) {
    arrival = Math.max(arrival, HERO_MS * pace);
  }
  const delay = hold + arrival + 260 * pace;

  el.animate(
    [
      { transform: "scale(1)", transformOrigin: "50% 50%", offset: 0 },
      { transform: "scale(1.06)", transformOrigin: "50% 50%", offset: 0.45 },
      { transform: "scale(1)", transformOrigin: "50% 50%", offset: 1 },
    ],
    { duration: 520 * pace, delay, easing: "ease-in-out" },
  );
}
