// DESTINATION: api/speak.ts  (repo root, alongside your existing api/[...path].ts)
//
// This is a standalone Vercel serverless function. Vercel routes /api/speak
// to this file directly — it takes precedence over your api/[...path].ts
// catch-all because it's a more specific match, so no routing changes needed
// there.
//
// Why a separate file at all (not folded into your Express app): text
// generation (Gemini) and speech synthesis are two different jobs with two
// different failure modes. Keeping them as separate functions means a slow
// TTS render never risks your existing Gemini endpoint's timeout budget,
// and vice versa.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EdgeTTS } from 'edge-tts-universal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { text, voice } = req.body as { text?: string; voice?: string };

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    // Calm, warm voices worth A/B testing for this tone: en-US-AvaNeural,
    // en-US-EmmaNeural, en-GB-SoniaNeural.
    const selectedVoice = voice || 'en-US-AvaNeural';

    const tts = new EdgeTTS(text, selectedVoice, {
      rate: '-8%',   // slightly slower — calmer pacing than default
      pitch: '0Hz',
      volume: '+0%',
    });

    const audioBuffer = await tts.toBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
