/**
 * Generated slide art via Gemini's image models ("Nano Banana").
 *
 * Stock photography stays the default and always will: it is free, it is a real
 * photograph, and a deck that costs nothing to illustrate can stay free. This
 * path exists for the case stock cannot serve — a specific scene, a specific
 * composition, art direction the user actually has in mind — and it is never
 * taken automatically. Somebody has to ask for it, every time.
 *
 * `FAL_KEY` was deliberately deleted from both deployments after image
 * generation ran unattended and quietly billed. The difference here is not the
 * provider: it is that nothing generates an image unless a person asked for that
 * image, and both the per-user and the whole-service daily budgets are enforced
 * before the call is made.
 */

/** Roughly 1.1k output tokens an image; the caps are what bound the spend. */
export const IMAGE_MODELS = {
  rapida: "gemini-3.1-flash-image",
  alta: "gemini-3-pro-image",
} as const;

export type ImageQuality = keyof typeof IMAGE_MODELS;

export class ImageError extends Error {}

/**
 * Direction bolted onto every prompt.
 *
 * Text is the big one: image models render lettering as convincing gibberish,
 * and a slide whose photo contains fake words is worse than a slide with no
 * photo. The rest keeps generated art in the same visual register as the stock
 * photography it sits beside — editorial, real, unstyled.
 */
const DIRECTION = [
  "Photorealistic editorial photograph, 16:9, natural light, shallow depth of field.",
  "No text, no letters, no numbers, no watermarks, no logos, no signage of any kind.",
  "No charts, no diagrams, no medical imaging, no anatomical illustration.",
  "Dignified and documentary in tone, as for a medical conference slide.",
].join(" ");

/**
 * Nothing that could be mistaken for evidence from a real patient.
 *
 * The stock filter blocks the same subjects, but blocking them there only meant
 * a search returned nothing. Here the model would *comply*: ask it for a chest
 * X-ray with a nodule and it produces a convincing one, with a lesion that no
 * patient has and no radiologist reported. On a slide, next to a verified PubMed
 * citation, that is fabricated clinical evidence. Portuguese included, because
 * this prompt is written by a Brazilian doctor, not by our English prompt layer.
 */
const FORBIDDEN =
  /\b(x-?rays?|radiograf\w*|raios?-?x|radiographs?|ct scans?|tomografias?|mri|resson[âa]nci\w*|ultrassom|ultrassonografi\w*|ultrasounds?|ecocardiogram\w*|echocardiograms?|ecgs?|ekgs?|eletrocardiogram\w*|histolog\w*|bi[óo]psi\w*|biops\w+|pathology slides?|l[âa]minas?|microscop\w*|lesions?|les[õo]es|les[ãa]o|wounds?|feridas?|rashes|erup[çc][õo]es|tumou?rs?|tumor\w*|autops\w+|aut[óo]psi\w*|cadavers?|cad[áa]ver\w*|dissection|dissec[çc][ãa]o|surgical site|blood smear|esfrega[çc]o)\b/i;

export function isSafeImagePrompt(prompt: string): boolean {
  // Negations stripped first, so "an empty ward, no wounds" isn't blocked by
  // its own safety wording.
  const text = prompt.replace(
    /\b(?:no|without|free of|sem|nenhum[ao]?)\s+[\w-]+/gi,
    " ",
  );
  return !FORBIDDEN.test(text);
}

export async function generateSlideImage(
  prompt: string,
  quality: ImageQuality,
): Promise<{ bytes: ArrayBuffer; contentType: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ImageError("GEMINI_API_KEY ausente.");

  const text = prompt.trim();
  if (text.length < 4) throw new ImageError("Descreva a imagem que você quer.");
  if (!isSafeImagePrompt(text)) {
    throw new ImageError(
      "Não gero imagem de exame, lesão ou peça anatômica: uma imagem inventada dessas ao lado de uma citação real é lida como evidência do caso. Descreva o ambiente ou a cena.",
    );
  }

  const model = IMAGE_MODELS[quality];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${text}\n\n${DIRECTION}` }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
    },
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 200);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Non-JSON error body.
    }
    throw new ImageError(`Gemini ${res.status}: ${detail}`);
  }

  const body = (await res.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  const candidate = body.candidates?.[0];
  const inline = candidate?.content?.parts?.find((p) => p.inlineData)?.inlineData;

  if (!inline?.data) {
    // A refusal comes back as a normal 200 with no image part, so the reason
    // has to be read off the candidate rather than the status code.
    throw new ImageError(
      candidate?.finishReason && candidate.finishReason !== "STOP"
        ? `O modelo não gerou a imagem (${candidate.finishReason}).`
        : "O modelo não devolveu nenhuma imagem.",
    );
  }

  return {
    bytes: Buffer.from(inline.data, "base64").buffer as ArrayBuffer,
    contentType: inline.mimeType ?? "image/jpeg",
    model,
  };
}
