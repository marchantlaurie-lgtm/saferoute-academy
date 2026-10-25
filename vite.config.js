import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'saferoute-advisories-api',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/api/advisories', async (request, response) => {
          const { default: handler } = await import('./api/advisories.js')
          const url = new URL(request.url || '/', 'http://localhost')
          const apiRequest = {
            method: request.method,
            query: Object.fromEntries(url.searchParams.entries()),
          }
          const apiResponse = {
            setHeader(name, value) { response.setHeader(name, value) },
            status(code) { response.statusCode = code; return this },
            json(value) {
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify(value))
              return this
            },
          }
          await handler(apiRequest, apiResponse)
        })
      },
    },
  ],
})
