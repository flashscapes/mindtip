// DESTINATION: api/transcribe.ts  (repo root, alongside api/speak.ts)
//
// Receives raw audio bytes (audio/webm from MediaRecorder) as the request
// body and forwards them to Groq's Whisper endpoint. Requires a new env
// var: GROQ_API_KEY (separate from whatever key powers your Gemini
// conversation logic — Whisper isn't part of the Gemini API).

export const config = {
  api: { bodyParser: false },
};

import type { VercelRequest, VercelResponse } from '@vercel/node';

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const audioBuffer = await readRawBody(req);
    if (audioBuffer.length === 0) {
      res.status(400).json({ error: 'No audio received' });
      return;
    }

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'speech.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    // Both measurably improve accuracy over relying on auto-detection alone,
    // especially on short or quiet clips — a language hint skips language
    // auto-detection entirely, and a short context prompt biases decoding
    // toward the kind of vocabulary this app actually hears.
    formData.append('language', 'en');
    formData.append('prompt', 'A reflective conversation about feelings, relationships, work, and daily life.');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq transcription error:', errText);
      res.status(502).json({ error: 'Transcription failed' });
      return;
    }

    const data = (await groqRes.json()) as { text?: string };
    res.status(200).json({ text: data.text ?? '' });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
}
