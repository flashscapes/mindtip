import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { generateRouter } from './routes/generate'
import { extractMemoryRouter } from './routes/extractMemory'

// The Express app itself, with no .listen() call — this is what gets
// reused both by the local dev server (server/index.ts) and by Vercel's
// serverless entry point (/api/[...path].ts), which needs a plain
// request handler rather than something that binds to a port.
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', generateRouter)
app.use('/api', extractMemoryRouter)

export default app
