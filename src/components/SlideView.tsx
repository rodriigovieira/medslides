import type { Slide } from "@/lib/deck";

/**
 * Everything is sized in `cqw` against the slide's own width, so one component
 * renders identically as a thumbnail, in the editor, and full-screen.
 *
 * Photos are used three different ways rather than as one universal backdrop:
 * full-bleed behind the cover and section dividers, and as a bleed panel beside
 * the text on content slides. A single treatment everywhere is what made the
 * earlier version look flat.
 */
export function SlideView({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  const image = slide.imageUrl;
  const treatment = imageTreatment(slide);
  const onDark = Boolean(image) && treatment === "full";
  const dark = onDark || slide.layout === "secao" || slide.layout === "destaque";

  return (
    <div
      className={`@container relative aspect-video w-full overflow-hidden ${
        dark ? "bg-[#0a141e] text-paper" : "bg-paper-raised text-ink"
      }`}
      style={{ containerType: "inline-size" }}
    >
      {image && treatment === "full" && (
        <>
          <Img src={image} className="absolute inset-0 h-full w-full" />
          <div
            className="absolute inset-0"
            style={{
              background:
                slide.layout === "capa"
                  ? "linear-gradient(to top, rgba(8,16,24,0.94) 8%, rgba(8,16,24,0.72) 42%, rgba(8,16,24,0.30) 78%, rgba(8,16,24,0.18) 100%)"
                  : "linear-gradient(96deg, rgba(8,16,24,0.90) 0%, rgba(8,16,24,0.74) 45%, rgba(8,16,24,0.44) 100%)",
            }}
          />
        </>
      )}

      {image && treatment === "panel" && (
        <div className="absolute inset-y-0 right-0 w-[41cqw]">
          <Img src={image} className="h-full w-full" />
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
        } py-[6.5cqw]`}
      >
        <Body slide={slide} dark={dark} />
      </div>

      {slide.layout !== "capa" && (
        <div
          className="absolute left-0 top-0 h-[0.85cqw] w-[15cqw]"
          style={{ background: dark ? "#f7f6f2" : "#0d7a6f" }}
        />
      )}

      <Footer slide={slide} index={index} total={total} dark={dark} />
    </div>
  );
}

/** How this slide should use its photo, if it has one. */
function imageTreatment(slide: Slide): "full" | "panel" | "none" {
  if (!slide.imageUrl) return "none";
  if (slide.layout === "capa" || slide.layout === "secao") return "full";
  if (slide.layout === "destaque") return "full";
  if (slide.layout === "comparacao") return "none";
  return "panel";
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
}: {
  slide: Slide;
  index: number;
  total: number;
  dark: boolean;
}) {
  const faint = dark ? "text-paper/55" : "text-ink-faint";
  return (
    <>
      {slide.source && (
        <div
          className={`absolute bottom-[3.2cqw] left-[7cqw] max-w-[58cqw] truncate text-[1.45cqw] ${faint}`}
        >
          {slide.source}
        </div>
      )}
      {slide.layout !== "capa" && (
        <div
          className={`absolute bottom-[3.2cqw] right-[7cqw] text-[1.45cqw] tabular-nums ${faint}`}
        >
          {index + 1} / {total}
        </div>
      )}
    </>
  );
}

function Body({ slide, dark }: { slide: Slide; dark: boolean }) {
  const muted = dark ? "text-paper/85" : "text-ink-soft";
  const faint = dark ? "text-paper/65" : "text-ink-faint";
  const rule = dark ? "bg-paper" : "bg-clinical";

  switch (slide.layout) {
    case "capa":
      return (
        <div className="flex h-full flex-col justify-end pb-[2cqw]">
          <div className={`mb-[3.2cqw] h-[0.9cqw] w-[11cqw] ${rule}`} />
          <h1 className="max-w-[80cqw] font-[family-name:var(--font-display)] text-[6.8cqw] leading-[1.02] tracking-tight">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p
              className={`mt-[2.6cqw] max-w-[62cqw] text-[2.5cqw] leading-snug ${muted}`}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      );

    case "secao":
      return (
        <div className="flex h-full flex-col justify-center">
          <h2 className="max-w-[72cqw] font-[family-name:var(--font-display)] text-[5.8cqw] leading-[1.06] tracking-tight">
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p
              className={`mt-[2.4cqw] max-w-[60cqw] text-[2.3cqw] leading-snug ${muted}`}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      );

    case "destaque":
      return (
        <div className="flex h-full flex-col justify-center">
          <h2
            className={`max-w-[62cqw] text-[2.1cqw] font-medium uppercase leading-snug tracking-[0.16em] ${faint}`}
          >
            {slide.title}
          </h2>
          {slide.stat && (
            <>
              <div className="mt-[1.6cqw] font-[family-name:var(--font-display)] text-[13cqw] leading-[0.92] tracking-tight">
                {slide.stat.value}
              </div>
              <p
                className={`mt-[1.8cqw] max-w-[58cqw] text-[2.7cqw] leading-snug ${muted}`}
              >
                {slide.stat.label}
              </p>
            </>
          )}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="mt-[2.8cqw] space-y-[1.1cqw]">
              {slide.bullets.map((b, i) => (
                <li
                  key={i}
                  className={`max-w-[58cqw] text-[2cqw] leading-snug ${muted}`}
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
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} />
          <div className="mt-[3.6cqw] grid flex-1 grid-cols-2 gap-[4.5cqw]">
            {[slide.left, slide.right].map((col, i) =>
              col ? (
                <div key={i}>
                  <div className={`h-[0.4cqw] w-full ${rule}`} />
                  <h3
                    className={`mt-[1.6cqw] text-[2.3cqw] font-semibold leading-snug ${
                      dark ? "text-paper" : "text-clinical-deep"
                    }`}
                  >
                    {col.heading}
                  </h3>
                  <ul className="mt-[1.8cqw] space-y-[1.3cqw]">
                    {col.bullets.map((b, j) => (
                      <li
                        key={j}
                        className={`text-[1.95cqw] leading-snug ${muted}`}
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
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} />
          <ul className="mt-[3.4cqw] space-y-[2cqw]">
            {(slide.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-[1.8cqw]">
                <span className="mt-[0.5cqw] font-[family-name:var(--font-display)] text-[2.4cqw] leading-none text-signal tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[2.3cqw] leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        </>
      );

    default:
      return (
        <>
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} />
          <ul className="mt-[3.4cqw] space-y-[1.9cqw]">
            {(slide.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-[1.8cqw]">
                <span
                  className={`mt-[1.1cqw] h-[0.7cqw] w-[0.7cqw] shrink-0 rounded-full ${
                    dark ? "bg-paper/80" : "bg-clinical"
                  }`}
                />
                <span className={`text-[2.3cqw] leading-snug ${muted}`}>
                  {b}
                </span>
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
}: {
  title: string;
  subtitle?: string;
  dark: boolean;
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-[4.2cqw] leading-[1.12] tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-[1.3cqw] text-[2cqw] leading-snug ${
            dark ? "text-paper/70" : "text-ink-faint"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
