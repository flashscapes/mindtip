import app from '../server/app.js'

// Vercel serverless entry for POST /api/reflect. Same app export as
// api/generate.ts and api/extract-memory.ts — Express's own routing
// handles the rest.
//
// This filename must match the URL path exactly (Vercel routes
// api/<name>.ts to /api/<name>). We got burned once already by a
// mismatched filename (api/memory.ts routing to /api/memory instead of
// the /api/extract-memory the app actually called) — double-checked here:
// this file is reflect.ts, the router below defines POST /reflect under
// the /api prefix, and the client calls /api/reflect. All three match.
export default app
