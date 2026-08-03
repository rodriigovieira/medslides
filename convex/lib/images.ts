const FAL_URL = "https://fal.run/fal-ai/flux/schnell";

/** Appended to every prompt — generated text inside an image always looks wrong. */
const STYLE_SUFFIX =
  "editorial photography, natural light, muted low-saturation neutral palette, soft contrast, shallow depth of field, cinematic, no text, no words, no letters, no charts, no diagrams";

/**
 * Blocks prompts that would produce something a viewer could mistake for real
 * clinical evidence. The system prompt already forbids these, but a generated
 * "CT scan" reaching a slide is the one failure mode worth defending twice.
 */
const FORBIDDEN =
  /\b(x-?ray|radiograph|ct scan|mri|ultrasound|echocardiogram|ecg|ekg|histolog|biopsy|pathology slide|microscop|lesion|wound|rash|tumor|autopsy|cadaver|dissection|chart|graph|diagram|scan of)\b/i;

export function isSafeImagePrompt(prompt: string): boolean {
  return !FORBIDDEN.test(prompt);
}

export type GeneratedImage = { bytes: ArrayBuffer; contentType: string };

/**
 * Generates one backdrop image. Returns null instead of throwing — a deck
 * without images is fine, a failed deck is not.
 */
export async function generateImage(
  prompt: string,
): Promise<GeneratedImage | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  if (!isSafeImagePrompt(prompt)) {
    console.warn(`imagePrompt rejeitado pelo filtro clínico: ${prompt}`);
    return null;
  }

  try {
    const res = await fetch(FAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `${prompt.trim()}, ${STYLE_SUFFIX}`,
        image_size: "landscape_16_9",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      }),
    });

    if (!res.ok) {
      console.warn(`fal ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }

    const body = (await res.json()) as {
      images?: Array<{ url?: string; content_type?: string }>;
    };
    const image = body.images?.[0];
    if (!image?.url) return null;

    const download = await fetch(image.url);
    if (!download.ok) return null;

    return {
      bytes: await download.arrayBuffer(),
      contentType: image.content_type ?? "image/jpeg",
    };
  } catch (error) {
    console.warn(`Falha ao gerar imagem: ${String(error)}`);
    return null;
  }
}
