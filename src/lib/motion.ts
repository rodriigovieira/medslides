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

/** Delay for the nth element of a build, in ms. */
export function stage(index: number, base = 0): number {
  return base + Math.min(index, MAX_STAGE) * STAGGER_MS;
}

export type Marks = Record<string, string>;

const NONE: Marks = {};

export function buildMark(delayMs: number): Marks {
  return { "data-build": String(Math.max(0, Math.round(delayMs))) };
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
    else rects.set(key, el.getBoundingClientRect());
  }
  for (const key of ambiguous) rects.delete(key);
  return rects;
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
): void {
  if (!root || reduced()) return;
  stopSlideMotion(root);
  const moved = moveShared(root, before);
  playHero(root, moved);
  playBuild(root, moved);
}

/** An element is left alone if it, or anything it wraps, is already moving. */
function isBusy(el: HTMLElement, moved: HTMLElement[]): boolean {
  return moved.some((m) => m === el || m.contains(el) || el.contains(m));
}

function moveShared(
  root: HTMLElement,
  before: SlideRects | null,
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
    const to = el.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) continue;

    // It matched, so it must not also fade in — even if it turns out not to
    // move, re-fading a title that stayed put is the flicker this replaces.
    moved.push(el);

    const crop = Boolean(el.querySelector("img"));
    const keyframes = crop
      ? cropFrames(from, to)
      : textFrames(from, to);
    if (!keyframes) continue;

    el.animate(keyframes, { duration: MOVE_MS, easing: EASE_MOVE });

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
        { duration: MOVE_MS, easing: EASE_MOVE },
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
function textFrames(from: DOMRect, to: DOMRect): Keyframe[] | null {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.height / to.height;
  if (isStill(dx, dy, s, s)) return null;
  return [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      transformOrigin: "50% 50%",
    },
    { transform: "translate(0px, 0px) scale(1)", transformOrigin: "50% 50%" },
  ];
}

function playHero(root: HTMLElement, moved: HTMLElement[]): void {
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
    { duration: HERO_MS, fill: "backwards" },
  );
}

function playBuild(root: HTMLElement, moved: HTMLElement[]): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-build]")) {
    if (isBusy(el, moved)) continue;
    const delay = Number(el.dataset.build) || 0;
    el.animate(
      [
        // `em` rather than px so the rise is proportional to the type — the same
        // build has to look right on a phone and on a 4 m projection.
        { opacity: 0, transform: "translateY(0.35em)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: BUILD_MS, delay, easing: EASE, fill: "backwards" },
    );
  }
}
