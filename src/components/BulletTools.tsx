"use client";

/**
 * Floating actions for the bullet being edited.
 *
 * In-place editing lets you retype a bullet but never reorder or delete one —
 * this is that missing half. It sits outside the slide's own scale so the
 * targets stay finger-sized no matter how small the slide is rendered.
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
      className="absolute -top-4 right-0 z-10 flex items-center gap-0.5 rounded-lg bg-ink p-1 shadow-[0_10px_28px_-12px_rgba(0,0,0,.55)]"
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
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-paper/85 transition hover:bg-paper/15"
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
      className="flex h-8 w-8 items-center justify-center rounded-md text-paper/85 transition hover:bg-paper/15 disabled:opacity-25"
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
