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
 * Returns image URLs plus the base prompt and first seed used (for pose consistency).
 */
export async function generateCypherImages(
  visualDescription: string,
  sketchBase64: string | null
): Promise<{ urls: string[]; basePrompt: string; seed: number }> {
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

  const urls = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
    .map((r) => r.value);

  return { urls, basePrompt: baseContext, seed: seeds[0] };
}

// ─── Phase 2: Directional image generation (img2img) ─────────────────────────

/**
 * Generates front, right, and left facing variants from the selected image.
 * Runs SEQUENTIALLY to avoid rate limiting and ensure consistency.
 * Each call uses fal-ai/flux/dev/image-to-image with low strength to preserve identity.
 */
export async function generateDirectionalImages(
  selectedImageUrl: string,
  originalPrompt: string,
  originalSeed: number
): Promise<{
  frontUrl: string | null;
  rightUrl: string | null;
  leftUrl: string | null;
}> {
  const basePrompt = originalPrompt;

  // Front — img2img staying close to selected variant
  console.log('DIRECTIONAL: Generating front facing');
  let frontUrl: string | null = null;
  try {
    const frontResult = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        prompt: `${basePrompt}, facing directly forward toward viewer, front facing, neutral battle ready stance, full body visible, same character design and colors`,
        image_url: selectedImageUrl,
        strength: 0.25,
        num_inference_steps: 28,
        seed: originalSeed,
        image_size: { width: 768, height: 1024 },
      },
    }) as any;
    frontUrl = frontResult?.data?.images?.[0]?.url ?? null;
    console.log('DIRECTIONAL: Front result:', frontUrl ? 'ok' : 'null');
  } catch (err) {
    console.warn('DIRECTIONAL: Front generation failed:', err);
    frontUrl = selectedImageUrl; // fallback to original
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Right — text-to-image with explicit right facing direction
  console.log('DIRECTIONAL: Generating right facing via text-to-image');
  let rightUrl: string | null = null;
  try {
    const rightResult = await fal.subscribe('xai/grok-imagine-image', {
      input: {
        prompt: `${basePrompt}, character body and face turned to face right side of frame, right profile three quarter view, character walking or standing toward the right, full body visible, isolated on pure black background, no background, same character design colors and features`,
        negative_prompt: 'facing forward, facing left, front view, looking at camera, symmetrical, background, environment',
        aspect_ratio: '2:3',
        output_format: 'jpeg',
        seed: originalSeed + 100,
      },
    }) as any;
    const rightImages = rightResult?.data?.images ?? rightResult?.images ?? [];
    rightUrl = rightImages?.[0]?.url ?? rightImages?.[0] ?? null;
    console.log('DIRECTIONAL: Right result:', rightUrl ? 'ok' : 'null');
  } catch (err) {
    console.warn('DIRECTIONAL: Right generation failed:', err);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Left — text-to-image with explicit left facing direction
  console.log('DIRECTIONAL: Generating left facing via text-to-image');
  let leftUrl: string | null = null;
  try {
    const leftResult = await fal.subscribe('xai/grok-imagine-image', {
      input: {
        prompt: `${basePrompt}, character body and face turned to face left side of frame, left profile three quarter view, character walking or standing toward the left, full body visible, isolated on pure black background, no background, same character design colors and features`,
        negative_prompt: 'facing forward, facing right, front view, looking at camera, symmetrical, background, environment',
        aspect_ratio: '2:3',
        output_format: 'jpeg',
        seed: originalSeed + 200,
      },
    }) as any;
    const leftImages = leftResult?.data?.images ?? leftResult?.images ?? [];
    leftUrl = leftImages?.[0]?.url ?? leftImages?.[0] ?? null;
    console.log('DIRECTIONAL: Left result:', leftUrl ? 'ok' : 'null');
  } catch (err) {
    console.warn('DIRECTIONAL: Left generation failed:', err);
  }

  return { frontUrl, rightUrl, leftUrl };
}

// ─── Phase 3: Sequential background removal ───────────────────────────────────

/**
 * Runs background removal on an array of image URLs sequentially.
 * Falls back to original URL on failure. Skips nulls.
 */
export async function removeBackgroundSequential(
  imageUrls: (string | null)[]
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];

  for (const url of imageUrls) {
    if (!url) {
      results.push(null);
      continue;
    }

    try {
      const result = await fal.subscribe('fal-ai/birefnet', {
        input: { image_url: url },
      }) as any;
      results.push(result?.data?.image?.url ?? null);
    } catch (err) {
      console.warn('[removeBackgroundSequential] failed for image, using original:', err);
      results.push(url);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

// ─── Pose generation (attack / defend) ───────────────────────────────────────

/**
 * Generates a single directional pose (attack or defend) for a cypher.
 * Uses img2img from the base image. Runs background removal on result.
 */
export async function generatePoseImage(
  baseImageUrl: string,
  originalPrompt: string,
  originalSeed: number,
  poseType: 'attack' | 'defend',
  poseDescription: string,
  facing: 'right' | 'left'
): Promise<string | null> {
  const facingText = facing === 'right'
    ? 'character body and face turned to face right side of frame, right profile three quarter view, moving or acting toward the right'
    : 'character body and face turned to face left side of frame, left profile three quarter view, moving or acting toward the left';

  const poseContext = poseType === 'attack'
    ? `dynamic attack pose, ${poseDescription}, aggressive action stance, explosive movement, weapon or ability in use`
    : `defensive stance, ${poseDescription}, braced guard position, shield or block posture, ready to absorb impact`;

  const posePrompt = `${originalPrompt}, ${poseContext}, ${facingText}, full body visible, isolated on pure black background, no background`;

  const negativePrompt = facing === 'right'
    ? 'facing forward, facing left, front view, looking at camera, symmetrical, background, environment'
    : 'facing forward, facing right, front view, looking at camera, symmetrical, background, environment';

  // Seeds: attack right +10, attack left +11, defend right +20, defend left +21
  const seedOffset = poseType === 'attack'
    ? (facing === 'right' ? 10 : 11)
    : (facing === 'right' ? 20 : 21);

  try {
    const result = await fal.subscribe('xai/grok-imagine-image', {
      input: {
        prompt: posePrompt,
        negative_prompt: negativePrompt,
        aspect_ratio: '2:3',
        output_format: 'jpeg',
        seed: originalSeed + seedOffset,
      },
    }) as any;

    const images = result?.data?.images ?? result?.images ?? [];
    const imageUrl: string | null = images?.[0]?.url ?? images?.[0] ?? null;
    if (!imageUrl) return null;

    // Remove background
    const bgResult = await fal.subscribe('fal-ai/birefnet', {
      input: { image_url: imageUrl },
    }) as any;

    return bgResult?.data?.image?.url ?? imageUrl;
  } catch (err) {
    console.warn('[generatePoseImage] failed:', err);
    return null;
  }
}
