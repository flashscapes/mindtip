import app from './app'

// Local development entry point only. Vercel never runs this file — it
// uses /api/[...path].ts instead, which imports the same app above
// without ever calling .listen().
const port = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(port, () => {
  console.log(`MindTip server listening on http://localhost:${port}`)
})
