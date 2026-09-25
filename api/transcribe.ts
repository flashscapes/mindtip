// DESTINATION: api/transcribe.ts  (repo root, alongside api/speak.ts)
//
// Receives raw audio bytes (whatever MIME type MediaRecorder actually used
// client-side — audio/webm on most browsers, audio/mp4 on Safari/iOS) as
// the request body and forwards them to Groq's Whisper endpoint. Requires
// a new env var: GROQ_API_KEY (separate from whatever key powers your
// Gemini conversation logic — Whisper isn't part of the Gemini API).

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

    // The client now sends the MIME type it actually recorded in
    // (MediaRecorder's negotiated type, via the request's Content-Type) —
    // NOT always audio/webm. Safari on iOS doesn't support webm at all and
    // silently records audio/mp4 instead; hardcoding 'speech.webm' /
    // 'audio/webm' here regardless labeled that mp4 data as webm, which
    // Groq correctly rejected ("could not process file - is it a valid
    // media file?"). Mapping the real incoming type to a matching filename
    // extension so Groq can actually identify the format.
    const incomingType = (req.headers['content-type'] || 'audio/webm').split(';')[0].trim();
    const extensionByType: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/aac': 'aac',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
    };
    const extension = extensionByType[incomingType] ?? 'webm';

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: incomingType }), `speech.${extension}`);
    formData.append('model', 'whisper-large-v3-turbo');
    // Both measurably improve accuracy over relying on auto-detection alone,
    // especially on short or quiet clips — a language hint skips language
    // auto-detection entirely, and a short context prompt biases decoding
    // toward the kind of vocabulary this app actually hears.
    formData.append('language', 'en');
    // Whisper's prompt biases decoding toward the vocabulary it describes.
    // The conversational prompt below is right for a conversation and
    // actively wrong for a name: it steers a one-syllable clip toward
    // ordinary words, which is how "Al" came back as "Ow" and "Flash" as
    // "Splash". A name turn says so via ?context=name and gets a prompt
    // that expects a proper noun on its own. Deliberately no example names
    // -- Whisper biases toward tokens that appear in the prompt, so listing
    // any would tilt every future name toward those.
    const context = typeof req.query.context === 'string' ? req.query.context : '';
    formData.append(
      'prompt',
      context === 'name'
        ? 'The speaker says only their own name and nothing else. It may be a short, uncommon, or shortened name.'
        : 'A reflective conversation about feelings, relationships, work, and daily life.'
    );
    // Whisper falls back to progressively higher temperatures when it is
    // unsure, which is exactly when it invents a plausible-sounding word in
    // place of an unfamiliar one. Pinning it to 0 keeps the most likely
    // decoding instead of a creative one.
    formData.append('temperature', '0');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq transcription error:', errText);
      // TEMPORARY DIAGNOSTIC ONLY — surface Groq's actual status/error text
      // to the client so it shows up in the frontend debug log, instead of
      // a generic message that hides which upstream failure this actually is.
      res.status(502).json({
        error: 'Transcription failed',
        upstreamStatus: groqRes.status,
        upstreamError: errText.slice(0, 500),
      });
      return;
    }

    const data = (await groqRes.json()) as { text?: string };
    res.status(200).json({ text: data.text ?? '' });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
}
