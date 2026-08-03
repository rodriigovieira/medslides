"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Tap-to-edit text that keeps its place in the slide.
 *
 * Uncontrolled on purpose: the text lives in the DOM while you type, and the
 * incoming `value` is only written back when the field is *not* focused. A
 * controlled contentEditable fights React on every keystroke — Convex pushes a
 * new deck object on each patch, and re-rendering the node under the caret
 * sends it to the start of the line.
 */
export function Editable({
  value,
  onCommit,
  editable,
  className = "",
  style,
  multiline = false,
  as: Tag = "span",
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  editable: boolean;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  as?: "span" | "div";
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || focused.current) return;
    if (node.textContent !== value) node.textContent = value;
  }, [value]);

  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const commit = () => {
    const node = ref.current;
    if (!node) return;
    const next = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (next && next !== value) onCommit(next);
    // Empty is treated as "no change" — restore rather than blank the slide.
    else if (node.textContent !== value) node.textContent = value;
  };

  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={placeholder}
      spellCheck={false}
      className={`cursor-text rounded-[0.3em] outline-none transition focus:bg-clinical/[0.07] focus:ring-2 focus:ring-clinical/30 hover:bg-clinical/[0.05] ${className}`}
      style={style}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.textContent = value;
          (e.target as HTMLElement).blur();
        }
        // Let the slide's own key handlers stay out of the way while typing.
        e.stopPropagation();
      }}
      onPaste={(e) => {
        // Paste as plain text; pasted markup would inherit foreign styling.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
    />
  );
}

/** Wraps a slide so its editable regions share one commit handler. */
export type EditHandler = (patch: {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  hub?: string;
  outcome?: string;
  stat?: { value: string; label: string };
  nodes?: Array<{ heading: string; body?: string }>;
  left?: { heading: string; bullets: string[] };
  right?: { heading: string; bullets: string[] };
}) => void;

export function EditHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-xs text-ink-faint">
      {children}
    </p>
  );
}
