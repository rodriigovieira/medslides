"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Tap-to-edit text that keeps its place in the slide.
 *
 * The text is rendered through `dangerouslySetInnerHTML` rather than as a React
 * child, and the html string is *frozen* while the field has focus. Both halves
 * matter:
 *
 * - As a child, React owns the text node. An earlier version set `textContent`
 *   from an effect instead, leaving the element childless in the VDOM — so the
 *   next re-render blanked it. Convex pushes a new deck object every time a
 *   reference or image lands, so that happened constantly and the slide title
 *   simply vanished.
 * - Frozen while focused, the html React wants to write never changes mid-edit,
 *   so it never touches the DOM under the caret and the cursor stays put.
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
  const [frozen, setFrozen] = useState<string | null>(null);

  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const shown = frozen ?? value;

  const commit = () => {
    const node = ref.current;
    setFrozen(null);
    if (!node) return;
    const next = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    // Empty is treated as "no change" — an emptied title would leave a blank
    // slide with no way back.
    if (next && next !== value) onCommit(next);
    else node.textContent = value;
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
      dangerouslySetInnerHTML={{ __html: escapeHtml(shown) }}
      onFocus={() => setFrozen(value)}
      onBlur={commit}
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
        // Keep the deck's own keyboard shortcuts out of the way while typing.
        e.stopPropagation();
      }}
      onPaste={(e) => {
        // Paste as plain text; pasted markup would drag in foreign styling.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
    />
  );
}

/** Shape of an inline edit, shared by the slide renderer and the workspace. */
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
  return <p className="mt-2 text-xs text-ink-faint">{children}</p>;
}
