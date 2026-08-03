import type { Slide } from "@/lib/deck";

/**
 * Everything inside a slide is sized in `cqw` against the slide's own width, so
 * one component renders identically as a thumbnail, in the editor, and
 * full-screen in present mode.
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
  const hasImage = Boolean(slide.imageUrl);
  // An image slide is always dark: the text sits on a scrim over the photo.
  const dark = hasImage || slide.layout === "secao" || slide.layout === "destaque";

  return (
    <div
      className={`@container relative aspect-video w-full overflow-hidden ${
        dark ? "bg-clinical-deep text-paper" : "bg-paper-raised text-ink"
      }`}
      style={{ containerType: "inline-size" }}
    >
      {slide.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs, and the exporter needs the same plain URL */}
          <img
            src={slide.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Neutral ink, not the brand green — a scrim in the photo's own hue
              just erases it. Fades out so the image is actually visible. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(96deg, rgba(10,20,30,0.92) 0%, rgba(10,20,30,0.80) 34%, rgba(10,20,30,0.42) 62%, rgba(10,20,30,0.12) 100%)",
            }}
          />
        </>
      )}

      <div className="absolute inset-0 flex flex-col px-[7cqw] py-[6cqw]">
        <Body slide={slide} dark={dark} />
      </div>

      {slide.layout !== "capa" && (
        <>
          <div
            className="absolute left-0 top-0 h-[0.9cqw] w-[16cqw]"
            style={{ background: dark ? "#f7f6f2" : "#0d7a6f" }}
          />
          <div
            className={`absolute bottom-[3cqw] right-[7cqw] text-[1.5cqw] tabular-nums ${
              dark ? "text-paper/60" : "text-ink-faint"
            }`}
          >
            {index + 1} / {total}
          </div>
        </>
      )}

      {slide.source && (
        <div
          className={`absolute bottom-[3cqw] left-[7cqw] max-w-[65cqw] truncate text-[1.5cqw] ${
            dark ? "text-paper/60" : "text-ink-faint"
          }`}
        >
          {slide.source}
        </div>
      )}
    </div>
  );
}

function Body({ slide, dark }: { slide: Slide; dark: boolean }) {
  const muted = dark ? "text-paper/80" : "text-ink-soft";
  const faint = dark ? "text-paper/70" : "text-ink-faint";

  switch (slide.layout) {
    case "capa":
      return (
        <div className="flex h-full flex-col justify-center">
          <div
            className={`mb-[3cqw] h-[1cqw] w-[12cqw] ${dark ? "bg-paper" : "bg-clinical"}`}
          />
          <h1 className={`font-[family-name:var(--font-display)] text-[7cqw] leading-[1.05] tracking-tight ${dark ? "max-w-[62cqw]" : "max-w-[76cqw]"}`}>
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p
              className={`mt-[3cqw] text-[2.6cqw] leading-snug ${muted} ${dark ? "max-w-[58cqw]" : "max-w-[70cqw]"}`}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      );

    case "secao":
      return (
        <div className="flex h-full flex-col justify-center">
          <h2 className="font-[family-name:var(--font-display)] text-[6cqw] leading-[1.1] tracking-tight">
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`mt-[2.5cqw] max-w-[68cqw] text-[2.4cqw] leading-snug ${muted}`}>
              {slide.subtitle}
            </p>
          )}
        </div>
      );

    case "destaque":
      return (
        <div className="flex h-full flex-col justify-center">
          <h2 className={`text-[2.4cqw] font-medium uppercase tracking-[0.18em] ${faint}`}>
            {slide.title}
          </h2>
          {slide.stat && (
            <>
              <div className="mt-[2cqw] font-[family-name:var(--font-display)] text-[13cqw] leading-none">
                {slide.stat.value}
              </div>
              <p className={`mt-[1.5cqw] max-w-[70cqw] text-[2.8cqw] leading-snug ${muted}`}>
                {slide.stat.label}
              </p>
            </>
          )}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="mt-[3cqw] space-y-[1.2cqw]">
              {slide.bullets.map((b, i) => (
                <li key={i} className={`text-[2.1cqw] leading-snug ${muted}`}>
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
          <div className="mt-[4cqw] grid flex-1 grid-cols-2 gap-[5cqw]">
            {[slide.left, slide.right].map((col, i) =>
              col ? (
                <div key={i} className={`${dark ? "border-paper/50" : "border-clinical"} border-t-[0.4cqw] pt-[2cqw]`}>
                  <h3 className={`text-[2.4cqw] font-semibold leading-snug ${dark ? "text-paper" : "text-clinical-deep"}`}>
                    {col.heading}
                  </h3>
                  <ul className="mt-[2cqw] space-y-[1.4cqw]">
                    {col.bullets.map((b, j) => (
                      <li
                        key={j}
                        className={`text-[2cqw] leading-snug ${muted}`}
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
          <ul className="mt-[4cqw] space-y-[2.2cqw]">
            {(slide.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-[2cqw]">
                <span className="mt-[0.6cqw] font-[family-name:var(--font-display)] text-[2.6cqw] leading-none text-signal tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[2.5cqw] leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        </>
      );

    default:
      return (
        <>
          <SlideTitle title={slide.title} subtitle={slide.subtitle} dark={dark} />
          <ul className="mt-[4cqw] space-y-[2cqw]">
            {(slide.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-[2cqw]">
                <span className={`mt-[1.2cqw] h-[0.8cqw] w-[0.8cqw] shrink-0 rounded-full ${dark ? "bg-paper/80" : "bg-clinical"}`} />
                <span className={`text-[2.5cqw] leading-snug ${muted}`}>{b}</span>
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
      <h2 className="max-w-[82cqw] font-[family-name:var(--font-display)] text-[4.4cqw] leading-[1.15] tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-[1.5cqw] max-w-[75cqw] text-[2.1cqw] leading-snug ${dark ? "text-paper/70" : "text-ink-faint"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
