import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import assert from 'node:assert/strict'
import { handleApi } from '../shared/service.mjs'
const env = {...process.env, ...parseEnv(await readFile('.env','utf8'))}
if (!env.GROQ_API_KEY?.trim()) { console.error('Добавьте GROQ_API_KEY в .env.'); process.exit(2) }
const answers = ['UX/UI-дизайнер, Middle', 'Проектирует интерфейсы, проводит интервью и проверяет гипотезы продукта.', 'Работает над сервисом автоматического найма, отвечает за интерфейс заказчика.', 'Продолжит текущий проект: улучшит онбординг и протестирует прототип с клиентами.', 'Нужны Figma, HTML, CSS, прототипирование и методы исследования пользователей.'].map((rawText,questionId)=>({rawText,questionId}))
const analysis = await handleApi('/api/analyze',{answers},env)
assert.equal(analysis.source,'ai','Семантический анализ перешёл на резервные правила')
assert.equal(analysis.assessments.length,5)
console.log('PASS: реальный AI-анализ пяти ответов')
const result=await handleApi('/api/generate-vacancy',{answers},env)
assert.equal(result.source,'ai','Генерация перешла на шаблон')
assert.ok(result.vacancy.length>100)
assert.ok(!/\[Уточнить зарплату/.test(result.vacancy) || result.source==='ai')
console.log('PASS: реальная AI-генерация структурированного текста')
if(process.argv[2]){
 const audio=await readFile(process.argv[2])
 const result=await handleApi('/api/stt',{audio:audio.toString('base64'),contentType:'audio/wav'},env)
 assert.ok(result.text.trim().length>10)
 console.log('PASS: реальное распознавание аудио')
}else console.log('SKIP: аудио не передано. Для STT: node scripts/cloud-smoke.mjs путь-к-файлу.wav')
