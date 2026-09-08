// DESTINATION: api/speak.ts  (repo root, alongside your existing api/[...path].ts)
//
// Matches RoadTip's live api/speak.js exactly: GET request, text via query
// string, raw MP3 bytes back. Kept as its own file (not folded into your
// Express catch-all) so a slow synthesis never risks your Gemini endpoint's
// timeout budget.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EdgeTTS } from 'edge-tts-universal';

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
    const tts = new EdgeTTS(text, 'en-US-EmmaMultilingualNeural');
    const audioBuffer = await tts.toBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Speech synthesis failed' });
  }
}
