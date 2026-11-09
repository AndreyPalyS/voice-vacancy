import { handleApi } from '../shared/service.mjs'
interface Request { method?: string; body: unknown }
interface Response { setHeader(name: string, value: string): void; status(code: number): Response; json(value: unknown): unknown }
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Нужен POST-запрос.' })
  try { return res.status(200).json(await handleApi('/api/analyze', req.body)) }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Ошибка запроса.' }) }
}
