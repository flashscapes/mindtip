import app from '../server/app.js'

// Vercel serverless entry for POST /api/experiment. Same app export as the
// other endpoints — Express's own routing handles the rest.
//
// Filename double-checked against the router: experiment.ts here, router
// defines POST /experiment under the /api prefix, client will call
// /api/experiment. All three match — this is exactly the class of bug
// that broke /api/extract-memory earlier (file named memory.ts routed to
// /api/memory instead).
export default app
