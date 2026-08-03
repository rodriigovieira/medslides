"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  buildMark,
  heroMark,
  heroStageMark,
  imageKey,
  textKey,
  type Marks,
} from "@/lib/motion";

/**
 * Whether the slide being rendered is the one on stage.
 *
 * `SlideView` serves the thumbnail rail, the editor and the presenter from the
 * same component, and only the presenter animates: a thumbnail that faded its
 * bullets in every time Convex pushed a new deck object would be a nuisance, and
 * an element mid-transform in the editor would be un-clickable. Off by default,
 * so every surface except `Presenter` renders exactly the DOM it did before —
 * no `data-` attributes, no animations, nothing for the exporter to see.
 */
const OnStage = createContext(false);

export function SlideStage({ children }: { children: ReactNode }) {
  return <OnStage.Provider value={true}>{children}</OnStage.Provider>;
}

const NONE: Marks = {};

export type SlideMarks = {
  /** Fades this element in after `delayMs`. See `stage()` for the ordering. */
  build: (delayMs: number) => Marks;
  /** Offers this text as a match for the same text on the next slide. */
  shared: (text: string | undefined | null) => Marks;
  /** Offers this photo as a match, keyed on its exact URL. */
  sharedImage: (url: string | undefined) => Marks;
  /** The one element that opens centre-stage before taking its place. */
  hero: Marks;
  /** The box the hero is centred in. */
  heroStage: Marks;
};

export function useSlideMarks(): SlideMarks {
  const on = useContext(OnStage);
  return useMemo(
    () => ({
      build: (delayMs: number) => (on ? buildMark(delayMs) : NONE),
      shared: (text: string | undefined | null) => (on ? textKey(text) : NONE),
      sharedImage: (url: string | undefined) => (on ? imageKey(url) : NONE),
      hero: on ? heroMark : NONE,
      heroStage: on ? heroStageMark : NONE,
    }),
    [on],
  );
}
