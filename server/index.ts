import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { generateRouter } from './routes/generate'
import { extractMemoryRouter } from './routes/extractMemory'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', generateRouter)
app.use('/api', extractMemoryRouter)

const port = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(port, () => {
  console.log(`MindTip server listening on http://localhost:${port}`)
})
