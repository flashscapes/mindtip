import app from '../server/app.js'

// Vercel serverless entry for POST /api/generate. Plain filename (no
// special characters) to avoid GitHub's folder-autocomplete pitfalls —
// exports the same Express app either file, since Express itself already
// knows how to route /api/generate correctly once it receives the request.
export default app
