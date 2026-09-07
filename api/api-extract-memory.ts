import app from '../server/app.js'

// Vercel serverless entry for POST /api/extract-memory. Same app export
// as api/generate.ts — Express's own routing handles the rest.
export default app
