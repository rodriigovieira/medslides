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

export type ImageStyle = "foto" | "ilustracao";

/**
 * Direction bolted onto every prompt.
 *
 * The no-text clause carries most of the weight: image models render lettering
 * as convincing gibberish, and a slide whose art contains fake words is worse
 * than a slide with no art. Labels belong to the deck, which can spell.
 *
 * Two registers, because congress decks use two. A photograph is atmosphere —
 * the room, the team, the light. An illustration is vocabulary — the antibody,
 * the heart, the receptor — drawn in the deck's own palette so it reads as part
 * of the design rather than as clip art dropped on top of it.
 */
const NO_TEXT =
  "No text, no letters, no numbers, no labels, no watermarks, no logos, no signage of any kind.";

const DIRECTION: Record<ImageStyle, string> = {
  foto: [
    "Photorealistic editorial photograph, natural light, shallow depth of field.",
    NO_TEXT,
    "No charts, no diagrams, no medical imaging.",
    "Dignified and documentary in tone, as for a medical conference slide.",
  ].join(" "),
  ilustracao: [
    "Clean scientific illustration for a medical conference slide: flat editorial",
    "infographic style, smooth shapes, subtle depth, confident line work.",
    "Palette: deep teal (#0D7A6F) as the primary, warm gold (#C79A3A) as the accent,",
    "muted plum for contrast, on a plain pure white background.",
    "A single subject, centred, with generous margins and no background scenery.",
    NO_TEXT,
  ].join(" "),
};

/**
 * What must never be generated, in any register.
 *
 * These are *measurements*. Ask the model for a chest X-ray with a nodule and it
 * produces a convincing one, showing a finding no patient has and no
 * radiologist reported; ask it for deruxtecan's structural formula and it draws
 * a molecule that is wrong in a way nobody in the room will check bond by bond.
 * Next to a verified PubMed citation, either is fabricated evidence.
 */
const NEVER =
  /\b(x-?rays?|radiograf\w*|raios?-?x|radiographs?|ct scans?|tomografias?|mri|resson[âa]nci\w*|ultrassom|ultrassonografi\w*|ultrasounds?|ecocardiogram\w*|echocardiograms?|ecgs?|ekgs?|eletrocardiogram\w*|histolog\w*|bi[óo]psi\w*|biops\w+|pathology slides?|l[âa]minas?|microscop\w*|autops\w+|aut[óo]psi\w*|cadavers?|cad[áa]ver\w*|dissection|dissec[çc][ãa]o|surgical site|blood smear|esfrega[çc]o|chemical structures?|structural formulas?|molecular structures?|estruturas? qu[íi]mica\w*|f[óo]rmulas? estrutural\w*|estruturas? molecular\w*|smiles)\b/i;

/**
 * Subjects that are fine as a diagram and dangerous as a photograph.
 *
 * A stylised tumour cell with PD-L1 on its surface is the standard vocabulary of
 * every immuno-oncology talk ever given — it is a diagram of a concept, and
 * nobody mistakes it for a patient. A photorealistic one is a picture of
 * somebody's disease.
 *
 * This distinction exists because the flat list got it wrong in production: a
 * doctor asked for a mechanism-of-action schematic for immunotherapy, the model
 * wrote a perfectly good prompt containing the word "tumour", and the request
 * was refused. The blocked case was the exact case the illustration style was
 * built for.
 */
const PHOTO_ONLY =
  /\b(lesions?|les[õo]es|les[ãa]o|wounds?|feridas?|rashes|erup[çc][õo]es|tumou?rs?|tumor\w*)\b/i;

/** The reason a prompt was refused, or null when it is fine. */
export function refuseImagePrompt(
  prompt: string,
  style: ImageStyle,
): string | null {
  // Negations stripped first, so "an empty ward, no wounds" isn't blocked by
  // its own safety wording.
  const text = prompt.replace(
    /\b(?:no|without|free of|sem|nenhum[ao]?)\s+[\w-]+/gi,
    " ",
  );

  if (NEVER.test(text)) {
    return "Não gero exame de imagem, lâmina, peça anatômica nem estrutura química: inventadas, essas imagens são lidas como dado — uma fórmula estrutural errada parece tão convincente quanto a certa. Descreva o ambiente, a cena, ou um esquema (anticorpo, célula, receptor, órgão).";
  }
  if (style === "foto" && PHOTO_ONLY.test(text)) {
    return "Não gero *foto* de lesão, ferida ou tumor — uma foto dessas ao lado de uma citação real é lida como o caso de um paciente. Como esquema científico funciona: peça \"gere um esquema\" em vez de uma foto.";
  }
  return null;
}

export async function generateSlideImage(
  prompt: string,
  quality: ImageQuality,
  style: ImageStyle,
): Promise<{ bytes: ArrayBuffer; contentType: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ImageError("GEMINI_API_KEY ausente.");

  const text = prompt.trim();
  if (text.length < 4) throw new ImageError("Descreva a imagem que você quer.");
  // Callers check this *before* promising anything and before spending budget;
  // repeating it here is the backstop for a future caller that forgets.
  const refusal = refuseImagePrompt(text, style);
  if (refusal) throw new ImageError(refusal);

  const model = IMAGE_MODELS[quality];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${text}\n\n${DIRECTION[style]}` }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          // A photograph fills the slide, so it's framed like the slide. An
          // illustration sits in the panel beside the text, where a square holds
          // the subject at a usable size instead of stranding it in wide space.
          imageConfig: { aspectRatio: style === "foto" ? "16:9" : "1:1" },
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
