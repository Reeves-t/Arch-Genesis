import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT =
  'You are a pose and composition analyst. Look at this sketch and extract ONLY the following: ' +
  'body orientation (facing left/right/forward), stance type (standing/crouching/lunging/arms raised etc), ' +
  'what each hand is holding or doing, and overall energy of the pose (aggressive/relaxed/dynamic etc). ' +
  'Output 2-3 sentences maximum. Do NOT describe art style, line quality, body proportions, or sketch characteristics. ' +
  'Ignore that this is a rough drawing — only extract pose and composition intent.';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { sketchBase64 } = await req.json();

    if (!sketchBase64) {
      return new Response(JSON.stringify({ description: '' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_PROMPT },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: sketchBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 150, temperature: 0.2 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', errText);
      return new Response(JSON.stringify({ description: '' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const description: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return new Response(JSON.stringify({ description }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-sketch error:', err);
    return new Response(JSON.stringify({ description: '' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
