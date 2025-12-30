import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from './dist/index.js'

// Use Vercel-compatible in-memory database (no native modules)
import { d1Database, r2Bucket } from './db-adapter-vercel.js'

// Replace Cloudflare serveStatic with Node.js version
// This is a deployment adapter - no logic changes
const nodeApp = app.use('/static/*', serveStatic({ root: './public' }))

const port = parseInt(process.env.PORT || '3000', 10)

console.log(`Server starting on port ${port}`)
console.log(`⚠️  Using in-memory database - data will not persist`)

serve({
  fetch: (request, env) => {
    // Inject bindings compatible with Cloudflare Workers
    // This is deployment adapter only - no logic changes
    return nodeApp.fetch(request, {
      DB: d1Database,
      IMAGES: r2Bucket,
      RESEND_API_KEY: process.env.RESEND_API_KEY
    })
  },
  port
})

console.log(`Server is running on http://localhost:${port}`)
