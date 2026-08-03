"use client";

import {
  AI_CREDIT,
  DIAGRAM_LAYOUTS,
  citationLine,
  type Reference,
  type Slide,
} from "@/lib/deck";
import { fitSlide, sized } from "@/lib/fit";
import { scrimFor, treatmentFor } from "@/lib/compose";
import { stage } from "@/lib/motion";
import { Editable, type EditHandler } from "./Editable";
import { useSlideMarks } from "./Motion";

import { Diagram } from "./Diagram";

/** The shared scrim, as a CSS gradient. */
function scrimCss(layout: Slide["layout"]): string {
  const { vertical, stops } = scrimFor(layout);
  const parts = stops.map(([at, color]) => `${color} ${(at * 100).toFixed(0)}%`);
  return `linear-gradient(${vertical ? "to top" : "96deg"}, ${parts.join(", ")})`;
}

/**
 * Everything is sized in `cqw` against the slide's own width, so one component
 * renders identically as a thumbnail, in the editor, and full-screen.
 *
 * Photos are used two different ways rather than as one universal backdrop —
 * `treatmentFor` decides which. A single treatment everywhere is what made the
 * earlier version look flat.
 */
export function SlideView({
  slide,
  index,
  total,
  references,
  onEdit,
  onBulletFocus,
}: {
  slide: Slide;
  index: number;
  total: number;
  references?: Reference[];
  /** Present only in the workspace's main slide — never on thumbnails. */
  onEdit?: EditHandler;
  /** Reports which bullet has focus so the workspace can show its actions. */
  onBulletFocus?: (index: number | null) => void;
}) {
  const marks = useSlideMarks();
  const image = slide.imageUrl;
  const treatment = treatmentFor(slide, Boolean(image));
  const citedCount = (slide.refs ?? []).filter((n) =>
    references?.some((r) => r.n === n),
  ).length;
  const fit = fitSlide({
    slide,
    panel: treatment === "panel",
    hasRefs: citedCount > 0,
  });
  const onDark = Boolean(image) && treatment === "full";
  const dark = onDark || slide.layout === "secao" || slide.layout === "destaque";

  return (
    <div
      className={`@container relative aspect-video w-full overflow-hidden ${
        dark ? "bg-[#0a141e] text-paper" : "bg-paper-raised text-ink"
      }`}
      style={{ containerType: "inline-size" }}
    >
      {/* The photo lives in a wrapper of its own, rather than as loose siblings,
          so the presenter has one box to fly when the same photo turns up on the
          next slide with a different treatment. `overflow-hidden` is what makes
          that read as a crop closing in instead of a stretch — see motion.ts. */}
      {image && treatment === "full" && (
        <div
          className="absolute inset-0 overflow-hidden"
          {...marks.sharedImage(image)}
        >
          <Img src={image} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0" style={{ background: scrimCss(slide.layout) }} />
        </div>
      )}

      {image && treatment === "panel" && (
        <div
          className={`absolute inset-y-0 right-0 w-[41cqw] overflow-hidden ${
            slide.imageStyle === "ilustracao" ? "bg-paper-raised" : ""
          }`}
          {...marks.sharedImage(image)}
        >
          {/* A photograph bleeds off the panel; an illustration is a whole
              object, so cropping it to fill would eat the margins it was drawn
              with and clip the subject. */}
          <Img
            src={image}
            className={`h-full w-full ${
              slide.imageStyle === "ilustracao"
                ? // `multiply` drops the JPEG's white to nothing against the
                  // page. The model only returns JPEG, so there is no alpha to
                  // work with, and without this the art sits in a faintly
                  // visible white rectangle.
                  "!object-contain p-[3cqw] mix-blend-multiply"
                : ""
            }`}
          />
          {/* Feathered inner edge so the panel reads as part of the page. */}
          <div
            className="absolute inset-y-0 left-0 w-[9cqw]"
            style={{
              background:
                "linear-gradient(to right, #fffefb 0%, rgba(255,254,251,0.55) 55%, rgba(255,254,251,0) 100%)",
            }}
          />
        </div>
      )}

      <div
        className={`absolute inset-0 flex flex-col ${
          treatment === "panel" ? "pl-[7cqw] pr-[46cqw]" : "px-[7cqw]"
        }`}
        style={{
          paddingTop: "6.5cqw",
          // Reserve the citation strip's height so body text can never flow
          // underneath it — that collision was the visible bug.
          paddingBottom: `${(6.5 + fit.footer - 2.6).toFixed(2)}cqw`,
        }}
      >
        <Body
          slide={slide}
          dark={dark}
          scale={fit.scale}
          onEdit={onEdit}
          onBulletFocus={onBulletFocus}
        />
      </div>

      {slide.layout !== "capa" && (
        <div
          className="absolute left-0 top-0 h-[0.85cqw] w-[15cqw]"
          style={{ background: dark ? "#f7f6f2" : "#0d7a6f" }}
        />
      )}

      <Footer
        slide={slide}
        index={index}
        total={total}
        dark={dark}
        treatment={treatment}
        references={references}
      />
    </div>
  );
}

function Img({ src, className }: { src: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs; the exporter needs the same plain URL
    <img src={src} alt="" aria-hidden className={`object-cover ${className}`} />
  );
}

function Footer({
  slide,
  index,
  total,
  dark,
  treatment,
  references,
}: {
  slide: Slide;
  index: number;
  total: number;
  dark: boolean;
  treatment: "full" | "panel" | "none";
  references?: Reference[];
}) {
  const faint = dark ? "text-paper/55" : "text-ink-faint";
  // Only references that were actually verified reach the slide.
  const cited = (slide.refs ?? [])
    .map((n) => references?.find((r) => r.n === n))
    .filter((r): r is Reference => Boolean(r))
    .slice(0, 2);
  // With a photo panel on the right, the page number has to stay in the text
  // column — over the photo it's unreadable.
  const numberRight = treatment === "panel" ? "right-[44cqw]" : "right-[7cqw]";
  return (
    <>
      {cited.length > 0 && (
        <div
          className={`absolute bottom-[2.6cqw] left-[7cqw] max-w-[62cqw] space-y-[0.3cqw] text-[1.25cqw] leading-tight ${faint}`}
        >
          {cited.map((ref) => (
            <div key={ref.n} className="truncate">
              <span className="tabular-nums">{ref.n}.</span>{" "}
              {citationLine(ref)}{" "}
              <span className="opacity-70">PMID {ref.pmid}</span>
            </div>
          ))}
        </div>
      )}
      {slide.layout !== "capa" && (
        <div
          className={`absolute bottom-[3.2cqw] ${numberRight} text-[1.45cqw] tabular-nums ${faint}`}
        >
          {index + 1} / {total}
        </div>
      )}
      {/* Generated art is labelled on the slide itself, not just in the notes.
          An invented image presented as a photograph to a room of doctors is a
          different thing from one they can see was made by a model. */}
      {slide.imageCredit === AI_CREDIT && (
        <div
          className={`absolute bottom-[0.9cqw] left-[7cqw] text-[1.05cqw] ${faint}`}
        >
          ✦ {AI_CREDIT}
        </div>
      )}
    </>
  );
}

function Body({
  slide,
  dark,
  scale,
  onEdit,
  onBulletFocus,
}: {
  slide: Slide;
  dark: boolean;
  scale: number;
  onEdit?: EditHandler;
  onBulletFocus?: (index: number | null) => void;
}) {
  const marks = useSlideMarks();
  const editable = Boolean(onEdit);
  const bullets = slide.bullets ?? [];
  const setBullet = (i: number) => (text: string) => {
    const next = [...bullets];
    next[i] = text;
    onEdit?.({ bullets: next });
  };

  const muted = dark ? "text-paper/85" : "text-ink-soft";
  const faint = dark ? "text-paper/65" : "text-ink-faint";
  const rule = dark ? "bg-paper" : "bg-clinical";

  if (DIAGRAM_LAYOUTS.includes(slide.layout)) {
    return (
      <>
        <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} scale={scale} onEdit={onEdit} />
        <div className="mt-[3cqw] flex flex-1 flex-col">
          <Diagram slide={slide} dark={dark} />
        </div>
      </>
    );
  }

  switch (slide.layout) {
    case "capa":
      return (
        <div className="flex h-full flex-col justify-end pb-[2cqw]">
          <div
            className={`mb-[3.2cqw] h-[0.9cqw] w-[11cqw] ${rule}`}
            {...marks.build(stage(0))}
          />
          <Editable
            as="div"
            value={slide.title}
            editable={editable}
            onCommit={(next) => onEdit?.({ title: next })}
            className="max-w-[80cqw] font-[family-name:var(--font-display)] text-[6.8cqw] leading-[1.02] tracking-tight"
            marks={{ ...marks.build(stage(1)), ...marks.shared(slide.title) }}
          />
          {slide.subtitle && (
            <Editable
              as="div"
              value={slide.subtitle}
              editable={editable}
              onCommit={(next) => onEdit?.({ subtitle: next })}
              className={`mt-[2.6cqw] max-w-[62cqw] text-[2.5cqw] leading-snug ${muted}`}
              marks={marks.build(stage(2))}
            />
          )}
        </div>
      );

    case "secao":
      return (
        <div className="flex h-full flex-col justify-center">
          <Editable
            as="div"
            value={slide.title}
            editable={editable}
            onCommit={(next) => onEdit?.({ title: next })}
            className="max-w-[72cqw] font-[family-name:var(--font-display)] text-[5.8cqw] leading-[1.06] tracking-tight"
            // A section divider announces a topic and the next slide usually
            // titles itself with it. That is the "the section title becomes the
            // slide title" move, and it is the one text match that pays off
            // often enough to be worth having.
            marks={{ ...marks.build(stage(0)), ...marks.shared(slide.title) }}
          />
          {slide.subtitle && (
            <Editable
              as="div"
              value={slide.subtitle}
              editable={editable}
              onCommit={(next) => onEdit?.({ subtitle: next })}
              className={`mt-[2.4cqw] max-w-[60cqw] text-[2.3cqw] leading-snug ${muted}`}
              marks={marks.build(stage(1))}
            />
          )}
        </div>
      );

    case "destaque":
      return (
        <div className="flex h-full flex-col justify-center">
          <Editable
            as="div"
            value={slide.title}
            editable={editable}
            onCommit={(next) => onEdit?.({ title: next })}
            className={`max-w-[62cqw] text-[2.1cqw] font-medium uppercase leading-snug tracking-[0.16em] ${faint}`}
            marks={marks.build(stage(0))}
          />
          {slide.stat && (
            <>
              <Editable
                as="div"
                value={slide.stat.value}
                editable={editable}
                onCommit={(next) =>
                  onEdit?.({ stat: { value: next, label: slide.stat!.label } })
                }
                className="mt-[1.6cqw] font-[family-name:var(--font-display)] text-[13cqw] leading-[0.92] tracking-tight"
                // The number is the slide. If the following slide repeats it —
                // as a diagram hub, or a heading — it flies there at 13cqw and
                // shrinks into place instead of blinking out and back.
                marks={{
                  ...marks.build(stage(1)),
                  ...marks.shared(slide.stat.value),
                }}
              />
              <Editable
                as="div"
                value={slide.stat.label}
                editable={editable}
                onCommit={(next) =>
                  onEdit?.({ stat: { value: slide.stat!.value, label: next } })
                }
                className={`mt-[1.8cqw] max-w-[58cqw] text-[2.7cqw] leading-snug ${muted}`}
                marks={marks.build(stage(2))}
              />
            </>
          )}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="mt-[2.8cqw] space-y-[1.1cqw]">
              {slide.bullets.map((b, i) => (
                <li
                  key={i}
                  className={`max-w-[58cqw] text-[2cqw] leading-snug ${muted}`}
                  {...marks.build(stage(3 + i))}
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case "comparacao":
      return (
        <>
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} scale={scale} onEdit={onEdit} />
          <div className="mt-[3.6cqw] grid flex-1 grid-cols-2 gap-[4.5cqw]">
            {[slide.left, slide.right].map((col, i) =>
              col ? (
                // A comparison is read as two columns, not as eight bullets, so
                // each column arrives whole. Staggering inside them would make
                // the audience read down the left while the right is still
                // filling in, which is the opposite of the point.
                <div key={i} {...marks.build(stage(1 + i))}>
                  <div className={`h-[0.4cqw] w-full ${rule}`} />
                  <h3
                    style={{ fontSize: sized(2.3, scale) }}
                    className={`mt-[1.6cqw] font-semibold leading-snug ${
                      dark ? "text-paper" : "text-clinical-deep"
                    }`}
                  >
                    {col.heading}
                  </h3>
                  <ul className="mt-[1.8cqw] space-y-[1.3cqw]">
                    {col.bullets.map((b, j) => (
                      <li
                        key={j}
                        className={`leading-snug ${muted}`}
                        style={{ fontSize: sized(1.95, scale) }}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
        </>
      );

    case "encerramento":
      return (
        <>
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} scale={scale} onEdit={onEdit} />
          <ul
            className="mt-[3.4cqw]"
            style={{ display: "grid", gap: sized(2, scale) }}
          >
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-[1.8cqw]" {...marks.build(stage(2 + i))}>
                <span
                  className="mt-[0.5cqw] font-[family-name:var(--font-display)] leading-none text-signal tabular-nums"
                  style={{ fontSize: sized(2.4, scale) }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Editable
                  value={b}
                  editable={editable}
                  onCommit={setBullet(i)}
                  onFocus={() => onBulletFocus?.(i)}
                  className="leading-snug"
                  style={{ fontSize: sized(2.3, scale) }}
                />
              </li>
            ))}
          </ul>
        </>
      );

    default:
      return (
        <>
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} scale={scale} onEdit={onEdit} />
          <ul
            className="mt-[3.4cqw]"
            style={{ display: "grid", gap: sized(1.9, scale) }}
          >
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-[1.8cqw]" {...marks.build(stage(2 + i))}>
                <span
                  className={`mt-[1.1cqw] h-[0.7cqw] w-[0.7cqw] shrink-0 rounded-full ${
                    dark ? "bg-paper/80" : "bg-clinical"
                  }`}
                />
                <Editable
                  value={b}
                  editable={editable}
                  onCommit={setBullet(i)}
                  onFocus={() => onBulletFocus?.(i)}
                  className={`leading-snug ${muted}`}
                  style={{ fontSize: sized(2.3, scale) }}
                />
              </li>
            ))}
          </ul>
        </>
      );
  }
}

function SlideTitle({
  title,
  subtitle,
  dark,
  scale,
  onEdit,
}: {
  title: string;
  subtitle?: string;
  dark: boolean;
  scale: number;
  onEdit?: EditHandler;
}) {
  const marks = useSlideMarks();
  return (
    <div>
      <Editable
        as="div"
        value={title}
        editable={Boolean(onEdit)}
        onCommit={(next) => onEdit?.({ title: next })}
        placeholder="Título do slide"
        className="font-[family-name:var(--font-display)] leading-[1.12] tracking-tight"
        style={{ fontSize: sized(4.2, scale) }}
        marks={{ ...marks.build(stage(0)), ...marks.shared(title) }}
      />
      {subtitle && (
        <Editable
          as="div"
          value={subtitle}
          editable={Boolean(onEdit)}
          onCommit={(next) => onEdit?.({ subtitle: next })}
          placeholder="Subtítulo"
          className={`mt-[1.3cqw] leading-snug ${
            dark ? "text-paper/70" : "text-ink-faint"
          }`}
          style={{ fontSize: sized(2, scale) }}
          marks={marks.build(stage(1))}
        />
      )}
    </div>
  );
}
