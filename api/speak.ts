// DESTINATION: api/speak.ts  (repo root, alongside your existing api/[...path].ts)
//
// Matches RoadTip's live api/speak.js: GET request, text via query string,
// OpenAI TTS (shimmer voice), raw MP3 bytes back. Kept as its own file
// (not folded into your Express catch-all) so a slow synthesis never
// risks your Gemini endpoint's timeout budget.
//
// Requires env var: OPENAI_API_KEY (same account/key type RoadTip uses
// for its own speak endpoint — separate from GROQ_API_KEY, which only
// powers transcription).

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = typeof req.query.text === 'string' ? req.query.text : '';

  if (!text) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'shimmer',
        input: text,
        response_format: 'mp3'
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI TTS error:', errText);
      // TEMPORARY: including the real error below for on-screen debugging —
      // revert to a generic message once voice is confirmed working.
      res.status(502).json({ error: 'Speech synthesis failed', detail: errText.slice(0, 300) });
      return;
    }

    const audioBuffer = Buffer.from(await openaiRes.arrayBuffer());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
