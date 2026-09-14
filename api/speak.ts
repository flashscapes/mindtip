// DESTINATION: api/speak.ts  (repo root, alongside your existing api/[...path].ts)
//
// GET request, text (and optionally a character `voice` key) via query
// string, raw MP3 bytes back. Kept as its own file (not folded into your
// Express catch-all) so a slow synthesis never risks your Gemini endpoint's
// timeout budget.
//
// Default path: OpenAI TTS (shimmer voice) -- unchanged from before.
// Requires env var: OPENAI_API_KEY.
//
// voice=noir-detective path: Cartesia Sonic instead, with a real voice
// picked from the actual library (Ronald - Thinker: "intense, deep young
// adult male") plus generation_config.emotion to push the delivery toward
// something more dramatic than a flat reading -- both are current, stable
// (non-experimental) Cartesia TTS request fields as of API version
// 2026-08-14, not the deprecated __experimental_controls path.
// Requires env var: CARTESIA_API_KEY.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CARTESIA_VOICES: Record<string, string> = {
  'noir-detective': '5ee9feff-1265-424a-9d7f-8e4d431a12c7' // Ronald - Thinker
};

async function speakWithCartesia(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.CARTESIA_API_KEY ?? '',
      'Cartesia-Version': '2026-08-14',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model_id: 'sonic-3.6',
      transcript: text,
      voice: { id: voiceId },
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      generation_config: {
        speed: 0.9,
        emotion: 'mysterious'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cartesia TTS error: ${res.status} — ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function speakWithOpenAI(text: string): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS error: ${res.status} — ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = typeof req.query.text === 'string' ? req.query.text : '';
  const voiceKey = typeof req.query.voice === 'string' ? req.query.voice : '';

  if (!text) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const cartesiaVoiceId = CARTESIA_VOICES[voiceKey];
    const audioBuffer = cartesiaVoiceId
      ? await speakWithCartesia(text, cartesiaVoiceId)
      : await speakWithOpenAI(text);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
