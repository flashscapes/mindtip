// TEMPORARY diagnostic route — see prior voice searches for context.
// Removed again once a survivalist voice is chosen.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const gender = typeof req.query.gender === 'string' ? req.query.gender : '';

  const params = new URLSearchParams({ language: 'en', limit: '20' });
  if (q) params.set('q', q);
  if (gender) params.set('gender', gender);

  try {
    const r = await fetch(`https://api.cartesia.ai/voices?${params.toString()}`, {
      headers: {
        'X-API-Key': process.env.CARTESIA_API_KEY ?? '',
        'Cartesia-Version': '2026-03-01'
      }
    });
    const body = await r.json();
    if (!r.ok) {
      res.status(r.status).json(body);
      return;
    }
    const simplified = (body.data ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      gender: v.gender,
      country: v.country
    }));
    res.status(200).json({ count: simplified.length, voices: simplified });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
