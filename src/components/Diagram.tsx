import type { DiagramNode, Slide } from "@/lib/deck";
import { HERO_HANDOFF_MS } from "@/lib/motion";
import { useSlideMarks } from "./Motion";

/**
 * Diagrams are laid out deterministically from the model's nodes — no image
 * generation, no cost, and the same geometry drives the PowerPoint export.
 * Everything is in `cqw` so it scales from thumbnail to projector.
 */
export function Diagram({ slide, dark }: { slide: Slide; dark: boolean }) {
  const nodes = slide.nodes ?? [];
  if (nodes.length === 0) return null;

  switch (slide.layout) {
    case "mecanismo":
      return <Mechanism slide={slide} nodes={nodes} dark={dark} />;
    case "fluxo":
      return <Flow nodes={nodes} dark={dark} />;
    default:
      return <Cards nodes={nodes} dark={dark} />;
  }
}

/** Connector with a visible head — the arrow is what makes it read as a flow. */
function Arrow({
  direction,
  dark,
  marks,
}: {
  direction: "right" | "down";
  dark: boolean;
  marks?: Record<string, string>;
}) {
  const stroke = dark ? "rgba(247,246,242,0.55)" : "rgba(13,122,111,0.65)";
  if (direction === "down") {
    return (
      <div className="flex justify-center" {...marks}>
        <svg viewBox="0 0 12 26" className="h-[2.6cqw] w-[1.2cqw]" aria-hidden>
          <path
            d="M6 0v17"
            fill="none"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M6 25l-4.5-8h9z" fill={stroke} />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center" {...marks}>
      <svg viewBox="0 0 26 12" className="h-[1.2cqw] w-[2.6cqw]" aria-hidden>
        <path
          d="M0 6h17"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M25 6l-8 4.5v-9z" fill={stroke} />
      </svg>
    </div>
  );
}

function palette(dark: boolean) {
  return {
    box: dark ? "border-paper/25 bg-paper/[0.06]" : "border-rule bg-paper",
    heading: dark ? "text-paper" : "text-clinical-deep",
    body: dark ? "text-paper/75" : "text-ink-soft",
    accent: dark ? "bg-paper" : "bg-clinical",
    line: dark ? "bg-paper/35" : "bg-clinical/40",
  };
}

function NodeBox({
  node,
  dark,
  className = "",
  marks,
}: {
  node: DiagramNode;
  dark: boolean;
  className?: string;
  marks?: Record<string, string>;
}) {
  const c = palette(dark);
  return (
    <div
      className={`flex min-w-0 flex-col rounded-[0.9cqw] border ${c.box} px-[1.9cqw] py-[1.5cqw] ${className}`}
      {...marks}
    >
      <span
        className={`text-[1.85cqw] font-semibold leading-tight ${c.heading}`}
      >
        {node.heading}
      </span>
      {node.body && (
        <span className={`mt-[0.7cqw] text-[1.5cqw] leading-snug ${c.body}`}>
          {node.body}
        </span>
      )}
    </div>
  );
}

/** Hub in the centre-left, branches on the right, converging to an outcome. */
function Mechanism({
  slide,
  nodes,
  dark,
}: {
  slide: Slide;
  nodes: DiagramNode[];
  dark: boolean;
}) {
  const c = palette(dark);
  const marks = useSlideMarks();
  const branches = nodes.slice(0, 4);

  // The hub opens centre-stage, then moves left and shrinks while the branches
  // arrive on the right — the gesture the whole feature was asked for. Without a
  // hub there is nothing to hand off from, so the branches lead instead.
  //
  // `base` is a wall-clock hand-off (it has to line up with the hub's flight,
  // which is a duration) while `first` is an ordinal (it scales with whatever
  // stagger the preset asks for). Keeping them separate is why `buildMark` takes
  // two arguments.
  const base = slide.hub ? HERO_HANDOFF_MS : 0;
  const first = slide.hub ? 0 : 1;

  return (
    <div className="flex flex-1 items-stretch gap-[1.4cqw]" {...marks.heroStage}>
      {slide.hub && (
        <div className="flex w-[24cqw] shrink-0 items-center">
          <div
            className={`w-full rounded-[1.1cqw] border-[0.25cqw] ${
              dark ? "border-paper/50 bg-paper/10" : "border-clinical bg-clinical/[0.07]"
            } px-[2cqw] py-[2.2cqw] text-center`}
            {...marks.hero}
            {...marks.shared(slide.hub)}
          >
            <span
              className={`text-[2.1cqw] font-semibold leading-tight ${c.heading}`}
            >
              {slide.hub}
            </span>
          </div>
        </div>
      )}

      {slide.hub && (
        <Arrow direction="right" dark={dark} marks={marks.build(first, base)} />
      )}

      <div className="flex flex-1 flex-col justify-center gap-[1.3cqw]">
        <div
          className="grid gap-[1.3cqw]"
          style={{
            // Three branches in a 2-column grid leave a hole; stack them.
            gridTemplateColumns: branches.length >= 4 ? "1fr 1fr" : "1fr",
          }}
        >
          {branches.map((node, i) => (
            <NodeBox
              key={i}
              node={node}
              dark={dark}
              marks={{
                ...marks.build(first + i, base),
                ...marks.shared(node.heading),
              }}
            />
          ))}
        </div>

        {slide.outcome && (
          <>
            <Arrow
              direction="down"
              dark={dark}
              marks={marks.build(first + branches.length, base)}
            />
            <div
              className={`rounded-[0.9cqw] ${c.accent} px-[2cqw] py-[1.2cqw] text-center`}
              {...marks.build(first + branches.length + 1, base)}
              {...marks.shared(slide.outcome)}
            >
              <span
                className={`text-[1.95cqw] font-semibold uppercase tracking-[0.08em] ${
                  dark ? "text-ink" : "text-paper"
                }`}
              >
                {slide.outcome}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Ordered steps, left to right, with numbered chips and connectors. */
function Flow({ nodes, dark }: { nodes: DiagramNode[]; dark: boolean }) {
  const c = palette(dark);
  const marks = useSlideMarks();
  const steps = nodes.slice(0, 5);

  return (
    <div className="flex flex-1 items-center gap-[1cqw]">
      {steps.map((node, i) => (
        // A protocol is the one place the order of arrival is the content: the
        // steps build left to right, in the order they happen.
        <div
          key={i}
          className="flex min-w-0 flex-1 items-center gap-[1cqw]"
          {...marks.build(1 + i)}
        >
          <div className="min-w-0 flex-1">
            <div
              className={`flex h-[3.4cqw] w-[3.4cqw] items-center justify-center rounded-full ${c.accent}`}
            >
              <span
                className={`text-[1.7cqw] font-semibold tabular-nums ${
                  dark ? "text-ink" : "text-paper"
                }`}
              >
                {i + 1}
              </span>
            </div>
            <NodeBox
              node={node}
              dark={dark}
              className="mt-[1.1cqw]"
              marks={marks.shared(node.heading)}
            />
          </div>
          {i < steps.length - 1 && (
            <div className={`h-[0.22cqw] w-[2.2cqw] shrink-0 ${c.line}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Unordered parallel blocks. */
function Cards({ nodes, dark }: { nodes: DiagramNode[]; dark: boolean }) {
  const marks = useSlideMarks();
  const cards = nodes.slice(0, 6);
  const columns = cards.length <= 4 ? 2 : 3;

  return (
    <div
      className="grid flex-1 content-center gap-[1.5cqw]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cards.map((node, i) => (
        <NodeBox
          key={i}
          node={node}
          dark={dark}
          marks={{
            ...marks.build(1 + i),
            ...marks.shared(node.heading),
          }}
        />
      ))}
    </div>
  );
}
