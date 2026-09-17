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
// voice=noir-detective / voice=therapist paths: Cartesia Sonic instead, with
// real voices picked from the actual library (see CARTESIA_VOICES below for
// which one and why) plus generation_config to push delivery toward
// something more dramatic than a flat reading -- both speed and emotion are
// current, stable (non-experimental) Cartesia TTS request fields as of API
// version 2026-08-14, not the deprecated __experimental_controls path.
// Requires env var: CARTESIA_API_KEY.

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CartesiaVoiceConfig {
  voiceId: string;
  speed: number; // 0.6-1.5
  emotion: string;
}

const CARTESIA_VOICES: Record<string, CartesiaVoiceConfig> = {
  'noir-detective': {
    voiceId: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Ronald - Thinker: "intense, deep young adult male"
    speed: 0.9,
    emotion: 'mysterious'
  },
  therapist: {
    voiceId: 'cd6256ef-2b2a-41f6-a8d8-c1307af5061f', // Preston - Relatable Pal: "confident... expressive tone and charismatic delivery"
    speed: 1.0,
    emotion: 'determined'
  },
  poker: {
    voiceId: '87a983d8-3471-4c4b-9ade-f1d10a4110ac', // Devin - Relaxed Spirit: "smooth, easygoing tone that feels relaxed and effortlessly cool"
    speed: 0.97,
    emotion: 'determined'
  },
  astronaut: {
    voiceId: 'aa2cafe9-97ba-4052-ac3c-875000f95212', // Zander - Composed Advisor: "measured and calm presence"
    speed: 0.97,
    emotion: 'contemplative'
  },
  infantry: {
    voiceId: '87286a8d-7ea7-4235-a41a-dd9fa6630feb', // Henry - Plainspoken Guy: "youthful... monotone, matter-of-fact attitude"
    speed: 1.02,
    emotion: 'determined'
  },
  survivalist: {
    voiceId: 'db69127a-dbaf-4fa9-b425-2fe67680c348', // Clint - Rugged Actor: "raspy voice with rugged tone"
    speed: 0.95,
    emotion: 'determined'
  }
};

async function speakWithCartesia(text: string, config: CartesiaVoiceConfig): Promise<Buffer> {
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
      voice: { id: config.voiceId },
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      generation_config: {
        speed: config.speed,
        emotion: config.emotion
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
    const cartesiaConfig = CARTESIA_VOICES[voiceKey];
    const audioBuffer = cartesiaConfig
      ? await speakWithCartesia(text, cartesiaConfig)
      : await speakWithOpenAI(text);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
