import app from '../server/app.js'

// Vercel serverless entry for POST /api/extract-memory. Same app export
// as api/generate.ts — Express's own routing handles the rest.
//
// NOTE: this filename must match the URL path exactly (Vercel routes
// api/<name>.ts to /api/<name>). It was previously named memory.ts, which
// routed to /api/memory instead of /api/extract-memory — the actual
// endpoint the client calls and the Express router expects — causing a
// silent 404 on every extraction attempt.
export default app
