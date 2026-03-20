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

// ============================================================
// LEGACY PNG DIRECTIONAL SYSTEM — COMMENTED OUT
// Replaced by Tripo 3D generation pipeline
// Keep for reference in case fallback is needed
// See generateTripoModel() for new approach
// ============================================================
/*
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
    frontUrl = selectedImageUrl;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

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
*/

// ============================================================
// LEGACY BACKGROUND REMOVAL — COMMENTED OUT
// No longer needed with Tripo 3D pipeline
// ============================================================
/*
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
*/

// ============================================================
// TRIPO 3D GENERATION PIPELINE
// Converts cypher PNG to GLB via FAL Tripo API
// Cost: $0.20-0.40 per model, commercial use included
// ============================================================

export async function generateTripoModel(
  imageUrl: string,
  cypherId: string,
  userId: string
): Promise<string | null> {
  console.log('TRIPO: Starting 3D model generation');
  console.log('TRIPO: Input image URL:', imageUrl);

  try {
    const result = await fal.subscribe('tripo3d/tripo/v2.5/image-to-3d', {
      input: {
        image_url: imageUrl,
        texture: 'standard',
        texture_alignment: 'original_image',
        orientation: 'default',
      },
      logs: true,
      onQueueUpdate: (update: any) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log: any) => log.message).forEach((msg: string) =>
            console.log('TRIPO LOG:', msg)
          );
        }
      },
    }) as any;

    console.log('TRIPO: Generation complete');
    console.log('TRIPO: Result keys:', Object.keys(result?.data ?? {}));

    const glbUrl = result?.data?.model_mesh?.url ?? null;
    console.log('TRIPO: GLB URL:', glbUrl);

    if (!glbUrl) {
      console.error('TRIPO: No GLB URL in response', JSON.stringify(result?.data));
      return null;
    }

    // Upload GLB to Supabase Storage
    // NOTE: Using arrayBuffer + Uint8Array — React Native Blob is not compatible with Supabase JS client
    const storagePath = `${userId}/${cypherId}/model.glb`;
    console.log('TRIPO: Uploading GLB to Supabase Storage:', storagePath);

    const glbResponse = await fetch(glbUrl);
    const glbBuffer = await glbResponse.arrayBuffer();
    const glbBytes = new Uint8Array(glbBuffer);
    console.log('TRIPO: GLB buffer byteLength:', glbBuffer.byteLength);

    if (glbBuffer.byteLength === 0) {
      console.error('TRIPO: GLB buffer is empty');
      return null;
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cypher-models')
      .upload(storagePath, glbBytes, {
        contentType: 'model/gltf-binary',
        upsert: true,
      });

    console.log('TRIPO: Upload result:', uploadData, uploadError);
    if (uploadError) throw new Error(`GLB upload failed: ${uploadError.message}`);

    const { data: publicData } = supabase.storage
      .from('cypher-models')
      .getPublicUrl(storagePath);

    console.log('TRIPO: Public GLB URL:', publicData.publicUrl);
    return publicData.publicUrl;

  } catch (err) {
    console.error('TRIPO: Generation failed:', err);
    return null;
  }
}

// ─── Pose GLB generation (attack / defend) ────────────────────────────────────

export async function generatePoseGLB(
  baseImageUrl: string,
  originalPrompt: string,
  originalSeed: number,
  poseType: 'attack' | 'defend',
  poseDescription: string,
  cypherId: string,
  userId: string,
  setNumber: number
): Promise<string | null> {
  console.log(`POSE GLB: Starting ${poseType} pose generation`);

  try {
    // Step 1 — Generate posed PNG via flux img2img
    const posePrompt = poseType === 'attack'
      ? `${originalPrompt}, aggressive attack pose, ${poseDescription}, weapon raised and ready to strike, dynamic action stance, lunging forward, full body visible, pure black background, no background`
      : `${originalPrompt}, defensive stance, ${poseDescription}, shield or guard raised, braced and ready, protective pose, full body visible, pure black background, no background`;

    const negativePrompt = 'background, environment, scenery, multiple characters, different character, text, watermark';

    console.log(`POSE GLB: Generating ${poseType} PNG via flux img2img`);
    const pngResult = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        prompt: posePrompt,
        image_url: baseImageUrl,
        strength: 0.45,
        num_inference_steps: 28,
        negative_prompt: negativePrompt,
        seed: poseType === 'attack' ? originalSeed + 10 : originalSeed + 20,
        image_size: { width: 768, height: 1024 },
      },
    }) as any;

    const posePngUrl = pngResult?.data?.images?.[0]?.url ?? null;
    console.log(`POSE GLB: ${poseType} PNG URL:`, posePngUrl);

    if (!posePngUrl) throw new Error('Pose PNG generation returned null');

    // Step 2 — Convert posed PNG to GLB via Tripo
    console.log(`POSE GLB: Converting ${poseType} PNG to GLB via Tripo`);
    const tripoResult = await fal.subscribe('tripo3d/tripo/v2.5/image-to-3d', {
      input: {
        image_url: posePngUrl,
        texture: 'standard',
        texture_alignment: 'original_image',
        orientation: 'default',
      },
      logs: true,
      onQueueUpdate: (update: any) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log: any) => log.message).forEach((msg: string) =>
            console.log(`POSE GLB TRIPO LOG:`, msg)
          );
        }
      },
    }) as any;

    const glbUrl = tripoResult?.data?.model_mesh?.url ?? null;
    console.log(`POSE GLB: ${poseType} GLB URL:`, glbUrl);

    if (!glbUrl) throw new Error('Tripo returned no GLB for pose');

    // Step 3 — Upload GLB to Supabase Storage
    // NOTE: Using arrayBuffer + Uint8Array — React Native Blob is not compatible with Supabase JS client
    const timestamp = Date.now();
    const storagePath = `${userId}/${cypherId}/${poseType}_set${setNumber}_${timestamp}.glb`;

    const glbResponse = await fetch(glbUrl);
    const glbBuffer = await glbResponse.arrayBuffer();
    const glbBytes = new Uint8Array(glbBuffer);
    console.log(`POSE GLB: Buffer byteLength:`, glbBuffer.byteLength);

    if (glbBuffer.byteLength === 0) throw new Error('Pose GLB buffer is empty');

    const { error: uploadError } = await supabase.storage
      .from('cypher-models')
      .upload(storagePath, glbBytes, {
        contentType: 'model/gltf-binary',
        upsert: true,
      });

    if (uploadError) throw new Error(`Pose GLB upload failed: ${uploadError.message}`);

    const { data: publicData } = supabase.storage
      .from('cypher-models')
      .getPublicUrl(storagePath);

    console.log(`POSE GLB: Final URL:`, publicData.publicUrl);
    return publicData.publicUrl;

  } catch (err) {
    console.error(`POSE GLB: Failed for ${poseType}:`, err);
    return null;
  }
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
