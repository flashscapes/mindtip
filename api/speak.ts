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
    voiceId: '65209f8e-6140-4a20-b819-3cc2e21da19b', // Nolan - Expressive Agent: "Warm, engaging, and effortlessly dependable with a natural, conversational touch"
    speed: 0.98,
    emotion: 'determined'
  },
  poker: {
    voiceId: '87a983d8-3471-4c4b-9ade-f1d10a4110ac', // Devin - Relaxed Spirit: "smooth, easygoing tone that feels relaxed and effortlessly cool"
    speed: 0.97,
    emotion: 'determined'
  },
  astronaut: {
    voiceId: '23e9e50a-4ea2-447b-b589-df90dbb848a2', // Dallas - Fireside Friend: "kind male for inviting and authentic conversations"
    speed: 0.97,
    emotion: 'contemplative'
  },
  executive: {
    // Reusing the verified voice ID freed up by the retired infantry
    // character rather than guessing an untested one — a wrong ID fails
    // synthesis outright. "Matter-of-fact" suits concise business advice,
    // and it is clearly distinct from the therapist's warmer Nolan. Swap
    // for a more polished voice from the Cartesia library if desired.
    voiceId: '87286a8d-7ea7-4235-a41a-dd9fa6630feb', // Henry - Plainspoken Guy: "youthful... monotone, matter-of-fact attitude"
    speed: 1.03, // slightly brisk — he respects your time
    emotion: 'determined'
  },
  survivalist: {
    voiceId: 'db69127a-dbaf-4fa9-b425-2fe67680c348', // Clint - Rugged Actor: "raspy voice with rugged tone"
    speed: 0.95,
    emotion: 'determined'
  },
  // The app's own voice on the welcome screen, before any character has
  // been chosen. It previously had no entry here at all, so it fell all
  // the way through to OpenAI's light 'shimmer' default -- a cold first
  // impression, and the wrong register for the question it asks.
  //
  // Reuses Dallas, the warmest male voice already verified in this file,
  // because Cartesia's library could not be reached from here to pick an
  // unused one. The overlap with the Astronaut is not heard back to back:
  // the welcome is over before anyone meets him.
  welcome: {
    voiceId: '23e9e50a-4ea2-447b-b589-df90dbb848a2', // Dallas - Fireside Friend: "kind male for inviting and authentic conversations"
    speed: 0.96,
    emotion: 'contemplative'
  }
};

// Per-key OpenAI voices, used for any key with no Cartesia entry above.
//
// 'custom' is the character the user types in themselves, and it wants a
// resonant broadcast voice that suits whoever they named. It is routed to
// OpenAI rather than Cartesia on purpose: every Cartesia ID above is
// already spoken for, so reusing one would make an invented character
// sound exactly like the Poker Player or the Therapist, and Cartesia's
// library could not be reached from here to pick an unused one. 'onyx' is
// OpenAI's deep announcer voice and, being a different engine entirely,
// cannot collide with any existing character's timbre.
//
// To move this to a purpose-picked Cartesia voice later, add a 'custom'
// entry to CARTESIA_VOICES above -- it takes precedence automatically and
// nothing else needs to change.
const OPENAI_VOICES: Record<string, string> = {
  custom: 'onyx'
};

const DEFAULT_OPENAI_VOICE = 'shimmer';

// Used only when a Cartesia request fails and the key has no OpenAI voice
// of its own -- a deep, neutral stand-in rather than the light default.
const CARTESIA_FALLBACK: CartesiaVoiceConfig = {
  voiceId: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', // Ronald - Thinker: "intense, deep young adult male"
  speed: 0.94,
  emotion: 'determined'
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
      output_format: { container: 'mp3', sample_rate: 24000, bit_rate: 64000 }, // speech-appropriate quality, not CD-quality -- smaller/faster with no perceptible loss for voice
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

async function speakWithOpenAI(text: string, voice: string = DEFAULT_OPENAI_VOICE): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
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

  const cartesiaConfig = CARTESIA_VOICES[voiceKey];
  const openaiVoice = OPENAI_VOICES[voiceKey] ?? DEFAULT_OPENAI_VOICE;

  // Two engines, either order, with the unused one as a fallback. A single
  // engine meant one missing or rejected key turned into a 500 and total
  // silence in the conversation -- which reads as the app being broken,
  // not as a voice being unavailable. A different-sounding reply is a far
  // better failure than no reply at all.
  const primary = cartesiaConfig
    ? () => speakWithCartesia(text, cartesiaConfig)
    : () => speakWithOpenAI(text, openaiVoice);
  const fallback = cartesiaConfig
    ? () => speakWithOpenAI(text, openaiVoice)
    : () => speakWithCartesia(text, CARTESIA_FALLBACK);

  try {
    let audioBuffer: Buffer;
    try {
      audioBuffer = await primary();
    } catch (primaryErr) {
      console.error('Primary TTS engine failed, falling back:', primaryErr);
      audioBuffer = await fallback();
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
