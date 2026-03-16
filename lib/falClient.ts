import { fal } from '@fal-ai/client';
import { supabase } from './supabase';

const FAL_KEY = process.env.EXPO_PUBLIC_FAL_KEY ?? '';

fal.config({ credentials: FAL_KEY });

// ─── Gemini sketch analysis (via Supabase Edge Function) ─────────────────────

/**
 * Sends a sketch to the analyze-sketch Edge Function, which calls Gemini vision
 * server-side (Gemini API key is never exposed to the client).
 * Returns a plain-text description of what was drawn, or '' if no sketch / call fails.
 */
async function analyzeSketch(sketchBase64: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-sketch', {
      body: { sketchBase64 },
    });
    if (error) {
      console.warn('Sketch analysis failed:', error.message);
      return '';
    }
    return (data?.description as string) ?? '';
  } catch (err) {
    console.warn('Sketch analysis error:', err);
    return '';
  }
}

// ─── Prompt construction ──────────────────────────────────────────────────────

const NEGATIVE_PROMPT =
  'background, landscape, environment, scenery, ground, sky, text, watermark, ' +
  'signature, extra limbs, deformed hands, bad anatomy, blurry, low detail, low quality, boring pose, ' +
  'sketch, line art, stick figure, pixel art, rough drawing, pencil lines, unfinished';

function buildBaseContext(sketchDescription: string, visualDescription: string): string {
  const sketchPart = sketchDescription ? `${sketchDescription}. ` : '';
  return (
    `${sketchPart}Character concept: ${visualDescription}. ` +
    'Fully rendered professional game character art, stylized 3D illustration, high production value, ' +
    'isolated on pure black background, no environment, no background elements, full body visible, ' +
    'dramatic lighting, vibrant colors, detailed textures and materials, cinematic quality character design. ' +
    'Single protagonist character only. One hero figure centered in frame. Weapons, objects, energy effects, and accessories are part of the character design. ' +
    'Any other humanoid figures, duplicate characters, side-by-side comparisons, or multiple distinct characters are not allowed. This is a solo character portrait.'
  );
}

function buildVariantPrompts(baseContext: string): [string, string, string] {
  const pure =
    baseContext +
    ' Clean heroic stance, full character clearly visible, balanced dramatic lighting, ' +
    'true to the described concept and visual style, polished game-ready character art.';

  const intense =
    baseContext +
    ' Aggressive battle stance, high contrast dramatic lighting, energy aura and effects ' +
    'surrounding the character, pushed color saturation, maximum visual impact, cinematic feel.';

  const alternative =
    baseContext +
    ' Same character reimagined with a different artistic interpretation, alternative color mood ' +
    'and lighting style, unique pose angle, same core concept expressed through a fresh creative lens.';

  return [pure, intense, alternative];
}

// ─── Single image generation ──────────────────────────────────────────────────

async function generateVariant(prompt: string, seed: number): Promise<string> {
  const result = await fal.run('xai/grok-imagine-image', {
    input: {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      aspect_ratio: '2:3',
      output_format: 'jpeg',
      seed,
    },
  }) as any;

  const images = result?.data?.images ?? result?.images ?? [];
  return images?.[0]?.url ?? images?.[0] ?? '';
}

// ─── Background removal ───────────────────────────────────────────────────────

/**
 * Strips the background from a generated image using fal-ai/birefnet.
 * Returns a transparent PNG URL. Throws on failure (caller should catch and fall back).
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  const result = await fal.run('fal-ai/birefnet', {
    input: { image_url: imageUrl },
  }) as any;

  const url = result?.data?.image?.url ?? result?.image?.url ?? '';
  if (!url) throw new Error('birefnet returned no URL');
  return url;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full generation pipeline:
 * 1. Analyze sketch via Gemini (server-side Edge Function) if sketch exists
 * 2. Build 3 distinct variant prompts
 * 3. Generate all 3 simultaneously via xai/grok-imagine-image on FAL
 *
 * Returns up to 3 image URLs. May return fewer if some calls fail.
 */
export async function generateCypherImages(
  visualDescription: string,
  sketchBase64: string | null
): Promise<string[]> {
  // Step 1: Sketch reading
  const sketchDescription = sketchBase64 ? await analyzeSketch(sketchBase64) : '';

  // Step 2: Build prompts
  const baseContext = buildBaseContext(sketchDescription, visualDescription);
  const [prompt1, prompt2, prompt3] = buildVariantPrompts(baseContext);

  // Step 3: Random seeds
  const seeds = [
    Math.floor(Math.random() * 2147483647),
    Math.floor(Math.random() * 2147483647),
    Math.floor(Math.random() * 2147483647),
  ];

  // Step 4: Generate all 3 simultaneously
  const results = await Promise.allSettled([
    generateVariant(prompt1, seeds[0]),
    generateVariant(prompt2, seeds[1]),
    generateVariant(prompt3, seeds[2]),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason;
      console.warn(`Variant ${i + 1} failed — status: ${err?.status}, message: ${err?.message}, body:`, JSON.stringify(err?.body ?? err));
    }
  });

  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
    .map((r) => r.value);
}
