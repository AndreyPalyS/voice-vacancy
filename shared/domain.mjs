export const QUESTIONS = [
  'На какую позицию вы ищете сотрудника?',
  'Какие две-три задачи он будет выполнять ежедневно?',
  'К какому проекту он присоединится? Что предстоит сделать?',
  'Чем он будет заниматься в ближайшие полгода: продолжит этот проект или начнёт другой?',
  'Какими инструментами и знаниями он должен владеть?',
]

const hints = [
  'Назовите должность и уровень, если уже определились.',
  'Назовите конкретные действия: например, проектировать интерфейсы и проверять гипотезы.',
  'Опишите продукт или проект и результат, за который отвечает сотрудник.',
  'Уточните, продолжится ли текущий проект, и что предстоит сделать.',
  'Назовите конкретные инструменты или профессиональные знания.',
]

/** Transparent heuristic: a useful prompt to clarify, never a claim of AI understanding. */
export function assessAnswer(id, text) {
  const clean = text.trim()
  const words = clean.toLowerCase().match(/[\p{L}\p{N}+#.-]+/gu) || []
  const unique = new Set(words)
  const relevant = [
    /[\p{L}]{3}/u,
    /проектир|разраб|провер|тестир|анализ|созда|поддерж|писать|пишет|дизайн|прода|общ|управ|вед[её]т|готов|обраб|соглас|рису|собира|исслед/i,
    /проект|продукт|сервис|прилож|сайт|платформ|систем|магазин|клиент|интерфейс|crm|erp/i,
    /продолж|тот же|друг|нов|развит|запуск|внедр|масштаб|доработ|улучш|проект/i,
    /figma|react|python|sql|excel|git|html|css|javascript|typescript|инструмент|знани|навык|анализ|дизайн|исслед|программ|коммуникац|интервью|прототип/i,
  ][id]?.test(clean) || false
  if (id === 0) return { score: clean.length >= 3 ? 1 : 0, sufficient: clean.length >= 3, hint: hints[0] }
  const score = Math.min(1, (unique.size >= 6 ? 0.5 : unique.size / 12) + (relevant ? 0.5 : 0))
  return { score, sufficient: score >= 0.9, hint: hints[id] || hints[0] }
}

export function validateAnswers(value) {
  if (!Array.isArray(value) || value.length !== QUESTIONS.length) throw new Error('Нужны ответы на все пять вопроса.')
  const ids = new Set()
  for (const answer of value) {
    if (!answer || !Number.isInteger(answer.questionId) || answer.questionId < 0 || answer.questionId >= QUESTIONS.length || ids.has(answer.questionId) || typeof answer.rawText !== 'string' || answer.rawText.trim().length < 3 || answer.rawText.length > 6000) {
      throw new Error('Проверьте ответы: пять уникальных вопроса, от 3 до 6000 символов каждый.')
    }
    ids.add(answer.questionId)
  }
  return [...value].sort((a, b) => a.questionId - b.questionId)
}

/** No inferred salary, company, job title or interview process. */
export function generateLocalVacancy(answers) {
  const sorted = validateAnswers(answers)
  return `# ${sorted[0].rawText.trim()}\n\n## О компании\n[Уточнить компанию и продукт]\n\n## Ежедневные задачи\n${sorted[1].rawText.trim()}\n\n## Текущий проект\n${sorted[2].rawText.trim()}\n\n## Ближайшие полгода\n${sorted[3].rawText.trim()}\n\n## Навыки и инструменты\n${sorted[4].rawText.trim()}\n\n## Условия\n[Уточнить зарплату, формат работы, локацию и занятость]\n\n## Процесс найма\n[Уточнить этапы отбора]\n\n---\nЧерновик по ответам заказчика. Проверьте и дополните перед публикацией.`
}
