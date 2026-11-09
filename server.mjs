import http from 'node:http'
import { createServer } from 'vite'
import { handleApi } from './shared/service.mjs'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
const server = http.createServer(async (req, res) => {
  const route = req.url?.split('?')[0]
  if (!route?.startsWith('/api/')) return vite.middlewares(req, res)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (!['/api/stt', '/api/generate-vacancy', '/api/analyze'].includes(route)) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Маршрут не найден.' })) }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.writeHead(405); return res.end(JSON.stringify({ error: 'Нужен POST-запрос.' })) }
  try {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 3 * 1024 * 1024) { res.writeHead(413); res.end(JSON.stringify({ error: 'Запрос превышает 3 МБ.' })); req.resume(); return }
      chunks.push(chunk)
    }
    const result = await handleApi(route, JSON.parse(Buffer.concat(chunks).toString('utf8')))
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Не удалось обработать запрос.' }))
  }
})
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Voice Vacancy: http://127.0.0.1:' + (process.env.PORT || 4173)))
async function shutdown() { server.close(); await vite.close() }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
