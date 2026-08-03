"use client";

/**
 * Actions for the bullet being edited.
 *
 * In-place editing lets you retype a bullet but never reorder or delete one —
 * this is that missing half. It renders *below* the slide rather than floating
 * over it: at phone size a floating bar covered the very bullets it edits, and
 * swallowed the taps aimed at them. Outside the slide, the targets also keep a
 * finger-sized 36px no matter how small the slide is drawn.
 *
 * Every button suppresses `mousedown`/`touchstart`: the bullet next to it is a
 * focused contentEditable, and letting the press steal focus would commit and
 * unmount the toolbar before the click ever landed.
 */
export function BulletTools({
  canMoveUp,
  canMoveDown,
  canRemove,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAskAi,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAskAi?: () => void;
}) {
  const hold = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-rule bg-paper-raised p-1 shadow-[0_6px_18px_-10px_rgba(14,27,42,.4)]"
      onMouseDown={hold}
      onTouchStart={hold}
    >
      <Tool label="Mover para cima" onClick={onMoveUp} disabled={!canMoveUp}>
        <path d="M10 15V5M10 5l-4 4M10 5l4 4" />
      </Tool>
      <Tool label="Mover para baixo" onClick={onMoveDown} disabled={!canMoveDown}>
        <path d="M10 5v10M10 15l-4-4M10 15l4-4" />
      </Tool>
      <Tool label="Remover tópico" onClick={onRemove} disabled={!canRemove}>
        <path d="M6 6l8 8M14 6l-8 8" />
      </Tool>
      {onAskAi && (
        <button
          onClick={onAskAi}
          aria-label="Reescrever com IA"
          title="Reescrever com IA"
          className="flex h-9 items-center gap-1 rounded-md px-2.5 text-xs text-clinical-deep transition hover:bg-rule/60"
        >
          <span aria-hidden>✦</span> IA
        </button>
      )}
    </div>
  );
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition hover:bg-rule/60 disabled:opacity-25"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </g>
      </svg>
    </button>
  );
}
