import test from 'node:test'
import assert from 'node:assert/strict'
import { assessAnswer, validateAnswers, generateLocalVacancy } from '../shared/domain.mjs'
import { handleApi } from '../shared/service.mjs'
const answers = ['UX/UI-дизайнер, Middle', 'Проектирует интерфейсы, проводит исследования пользователей и проверяет гипотезы.', 'Разрабатывает интерфейс сервиса автоматического найма для бизнес-заказчиков компании.', 'Продолжит этот проект: улучшит онбординг и запустит тестирование с клиентами.', 'Владеет Figma, HTML, CSS, прототипированием и методами интервью пользователей.'].map((rawText, questionId) => ({ rawText, questionId }))
test('all answer ids required, unique, bounded strings; input order is normalized', () => {
 assert.equal(validateAnswers([...answers].reverse())[0].questionId, 0)
 for (const bad of [null, [], answers.slice(1), [answers[0],answers[0],answers[2],answers[3]], [{...answers[0], rawText: 5}, ...answers.slice(1)], [{...answers[0], rawText: 'a'.repeat(6001)}, ...answers.slice(1)], [null,...answers.slice(1)]]) assert.throws(() => validateAnswers(bad))
})
test('heuristic distinguishes a useful answer from repetition or unrelated text', () => {
 answers.forEach(a => assert.equal(assessAnswer(a.questionId, a.rawText).sufficient, true))
 for (const text of ['', 'да', 'проект проект проект проект проект проект', 'Сегодня прекрасная погода и птицы поют за окном']) assert.equal(assessAnswer(1, text).sufficient, false)
})
test('template includes supplied facts and explicitly missing conditions', () => {
 const text = generateLocalVacancy(answers)
 answers.forEach(a => assert.ok(text.includes(a.rawText)))
 assert.ok(text.includes('[Уточнить зарплату'))
 assert.ok(!text.includes('30 мин'))
 assert.ok(!text.includes('150 000'))
})
test('no-key mode works without fetch and marks template source', async () => {
 const data = await handleApi('/api/generate-vacancy', { answers }, {})
 assert.equal(data.source, 'template')
 assert.ok(data.warning.includes('не подключён'))
})
test('invalid audio and missing STT setup return useful errors', async () => {
 await assert.rejects(handleApi('/api/stt', {}, {}), /не настроено/)
 await assert.rejects(handleApi('/api/stt', { audio: '???', contentType: 'text/html' }, {GROQ_API_KEY:'test'}), /аудиофайл/)
})
test('upstream outage returns an explicitly labelled template', async () => {
 const oldFetch = globalThis.fetch
 globalThis.fetch = async () => new Response('', { status: 503 })
 try { const data = await handleApi('/api/generate-vacancy', {answers}, {GROQ_API_KEY:'test'}); assert.equal(data.source, 'template'); assert.match(data.warning, /недоступен/) }
 finally { globalThis.fetch = oldFetch }
})
test('AI response is returned and audio proxy uses multipart upstream', async () => {
 const oldFetch = globalThis.fetch
 globalThis.fetch = async (_url, init) => {
  if (init.body instanceof FormData) { assert.equal(init.body.get('model'), 'whisper-large-v3-turbo'); assert.equal(init.body.get('file').name, 'audio.mp3'); return Response.json({text:'Распознанный ответ'}) }
  return Response.json({choices:[{message:{content:'# Вакансия'}}]})
 }
 try {
  assert.equal((await handleApi('/api/generate-vacancy', {answers}, {GROQ_API_KEY:'test'})).source,'ai')
  assert.equal((await handleApi('/api/stt', {audio:Buffer.from('audio').toString('base64'),contentType:'audio/mpeg'}, {GROQ_API_KEY:'test'})).text,'Распознанный ответ')
 } finally { globalThis.fetch = oldFetch }
})

test('semantic analysis uses rules without a key and validates model JSON', async () => {
 assert.equal((await handleApi('/api/analyze', {answers}, {})).source, 'rules')
 const oldFetch = globalThis.fetch
 try {
  globalThis.fetch = async () => Response.json({choices:[{message:{content:JSON.stringify({assessments:answers.map(a => ({questionId:a.questionId, score:0.8, hint:'Уточните результат проекта'}))})}}]})
  const result = await handleApi('/api/analyze', {answers}, {GROQ_API_KEY:'test'})
  assert.equal(result.source,'ai'); assert.ok(result.assessments.every(a => a.sufficient))
  globalThis.fetch = async () => Response.json({choices:[{message:{content:'{"assessments":[null]}'}}]})
  assert.equal((await handleApi('/api/analyze', {answers}, {GROQ_API_KEY:'test'})).source,'rules')
 } finally { globalThis.fetch = oldFetch }
})
