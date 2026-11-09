import ReactMarkdown from 'react-markdown'
import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, ArrowRight, ArrowLeft, Download, Copy, Sparkles, Check, RotateCcw } from 'lucide-react'
import { QUESTIONS, assessAnswer, generateLocalVacancy } from '../shared/domain.mjs'
import { useVoiceInput } from './hooks/useVoiceInput'
import './App.css'

type Screen = 'welcome' | 'question' | 'review' | 'processing' | 'result'
interface Draft { texts: string[]; step: number; result: string; source: string; notice: string; screen: Screen }
const KEY = 'voice-vacancy-v2'
const empty = (): Draft => ({ texts: Array(QUESTIONS.length).fill(''), step: 0, result: '', source: '', notice: '', screen: 'welcome' })
function restore(): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (value && Array.isArray(value.texts) && value.texts.length === 4 && value.texts.every((t: unknown) => typeof t === 'string')) { value.texts = ['', ...value.texts]; value.step = 0; value.screen = 'welcome' }
    if (!value || !Array.isArray(value.texts) || value.texts.length !== QUESTIONS.length || !value.texts.every((s: unknown) => typeof s === 'string' && s.length <= 6000) || !Number.isInteger(value.step) || value.step < 0 || value.step >= QUESTIONS.length) return empty()
    return { ...empty(), texts: value.texts, step: value.step, result: typeof value.result === 'string' ? value.result : '', source: typeof value.source === 'string' ? value.source : '', notice: typeof value.notice === 'string' ? value.notice : '', screen: value.screen === 'result' && value.result ? 'result' : 'welcome' }
  } catch { return empty() }
}
async function api(route: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal || AbortSignal.timeout(35000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Сервис недоступен.')
  return data
}

function Ring({ progress, listening = false }: { progress: number; listening?: boolean }) {
  return <div className={'ring ' + (listening ? 'listening' : '')} role="progressbar" aria-label="Заполненность ответов" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={Math.min(QUESTIONS.length, progress)}>
    <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="ring-track" cx="100" cy="100" r="84" />
      {Array.from({ length: 60 }, (_, i) => {
        const angle = (i * 6 - 90) * Math.PI / 180
        return <line key={i} x1={100 + 80 * Math.cos(angle)} y1={100 + 80 * Math.sin(angle)} x2={100 + 91 * Math.cos(angle)} y2={100 + 91 * Math.sin(angle)} className={i < progress * 12 ? 'filled' : ''} />
      })}</svg>
    <div className="ring-center">{progress >= QUESTIONS.length ? <Check size={34} /> : listening ? <div className="wave">{[1,2,3,4,5].map(i => <i key={i} style={{ animationDelay: i * 0.12 + 's' }} />)}</div> : <Mic size={32} />}<small>{progress >= QUESTIONS.length ? 'Готово' : listening ? 'Слушаю' : 'Ваш голос'}</small></div>
  </div>
}

export function App() {
  const [draft, setDraft] = useState<Draft>(restore)
  const [screen, setScreen] = useState<Screen>(draft.screen)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [preview, setPreview] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<{ source: string; assessments: { questionId: number; sufficient: boolean; hint: string }[] } | null>(null)
  const [storageError, setStorageError] = useState(false)
  const request = useRef<AbortController | null>(null)
  const focusRef = useRef<HTMLHeadingElement>(null)
  const voice = useVoiceInput(text => setDraft(d => ({ ...d, texts: d.texts.map((s, i) => i === d.step ? (s + ' ' + text).trim().slice(0, 6000) : s) })))
  const busy = voice.listening || voice.pending
  const assessment = assessAnswer(draft.step, draft.texts[draft.step])
  const answered = draft.texts.filter(t => t.trim().length >= 3).length
  const hasDraft = draft.texts.some(t => t.trim())
  useEffect(() => {
    // Storage availability is an external browser state; reflect write failures in the UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { localStorage.setItem(KEY, JSON.stringify({ ...draft, screen })); queueMicrotask(() => setStorageError(false)) }
    catch { queueMicrotask(() => setStorageError(true)) }
  }, [draft, screen])
  useEffect(() => { focusRef.current?.focus() }, [screen, draft.step])
  useEffect(() => () => request.current?.abort(), [])
  function updateText(text: string) { setDraft(d => ({ ...d, texts: d.texts.map((s, i) => i === d.step ? text : s) })) }
  function navigate(step: number) { setAnalysis(null); setError(''); setDraft(d => ({ ...d, step })); setScreen('question') }
  function reset() { request.current?.abort(); setDraft(empty()); setScreen('welcome'); setConfirmReset(false); setError('') }
  async function analyze() {
    setAnalyzing(true); setError('')
    try { setAnalysis(await api('/api/analyze', { answers: draft.texts.map((rawText, questionId) => ({ rawText, questionId })) })) }
    catch { setError('Не удалось проверить содержание. Ваши ответы сохранены, можно продолжить.') }
    finally { setAnalyzing(false) }
  }
  async function generate() {
    if (draft.texts.some(t => t.trim().length < 3)) { setError('Ответьте на все пять вопросов.'); return }
    setScreen('processing'); setError('')
    const answers = draft.texts.map((rawText, questionId) => ({ rawText, questionId }))
    const controller = new AbortController(); request.current = controller
    const timer = setTimeout(() => controller.abort(), 35000)
    try {
      const data = await api('/api/generate-vacancy', { answers }, controller.signal)
      if (!data.vacancy || typeof data.vacancy !== 'string') throw new Error('Некорректный ответ сервера.')
      setDraft(d => ({ ...d, result: data.vacancy, source: data.source, notice: data.warning || '' }))
      setScreen('result')
    } catch {
      if (request.current !== controller) return
      setDraft(d => ({ ...d, result: generateLocalVacancy(answers), source: 'template', notice: 'Сервер недоступен. Собран локальный шаблон из ваших ответов.' }))
      setScreen('result')
    } finally { clearTimeout(timer); if (request.current === controller) request.current = null }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(draft.result); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setError('Не удалось скопировать. Скачайте файл или выделите текст в редакторе.') }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([draft.result], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'vacancy.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="app-shell">
    <main id="main" key={screen + (screen === 'question' ? draft.step : '')} className={screen === 'welcome' ? 'main welcome-main screen-enter' : 'main screen-enter'}>
      {screen === 'welcome' && <section className="welcome">
        <h1 tabIndex={-1} ref={focusRef}>Соберём основу вакансии</h1>
        <p className="muted">Пять вопросов. Голосом или текстом.</p>
        <Ring progress={answered} />
        <p className="welcome-note">Говорите свободно.<br />Текст можно исправить в любой момент.</p>
        <button className="primary" onClick={() => setScreen('question')}>{hasDraft ? 'Продолжить черновик' : 'Начать'}<ArrowRight size={18} /></button>
        {hasDraft && <button className="text-button" onClick={() => setConfirmReset(true)}>Начать заново</button>}
      </section>}
      {screen === 'question' && <section className="question-layout" key={draft.step}>
        <aside><p className="eyebrow">ОСНОВА ВАКАНСИИ</p><Ring progress={answered} listening={voice.listening} /><ol className="steps">{['Название позиции', 'Ежедневные задачи', 'Текущий проект', 'Будущие планы', 'Навыки и инструменты'].map((title, i) => <li key={title}><button disabled={busy} aria-current={i === draft.step ? 'step' : undefined} onClick={() => navigate(i)}><span className={draft.texts[i].trim().length >= 3 ? 'step-done' : ''}>{draft.texts[i].trim().length >= 3 ? <Check size={13} /> : i + 1}</span>{title}</button></li>)}</ol></aside>
        <div className="question-panel"><p className="eyebrow">ВОПРОС {draft.step + 1} ИЗ {QUESTIONS.length}</p><h1 tabIndex={-1} ref={focusRef}>{QUESTIONS[draft.step]}</h1><p className="muted">Отвечайте о будущем сотруднике. Можно говорить или писать.</p>
          <label className="field-label" htmlFor="answer">Ваш ответ</label><textarea id="answer" value={draft.texts[draft.step]} maxLength={6000} disabled={voice.listening || voice.pending} onChange={e => updateText(e.target.value)} placeholder={draft.step === 0 ? "Например: UX/UI-дизайнер, Middle" : "Расскажите своими словами…"} rows={6} />
          <div className="answer-meta"><span>{draft.texts[draft.step].length} / 6000</span><span>{assessment.sufficient ? 'Есть конкретика' : 'Можно дополнить'}</span></div>
          {voice.interim && <p className="interim" aria-live="polite">{voice.interim}</p>}
          <div className="voice-controls"><button className={voice.listening ? 'record recording' : 'record'} disabled={!voice.supported || voice.pending} onClick={voice.listening ? voice.stop : voice.start}>{voice.listening ? <MicOff size={18} /> : <Mic size={18} />}{voice.pending ? 'Ожидаем микрофон…' : voice.listening ? 'Остановить запись' : 'Ответить голосом'}</button></div>
          {!voice.supported && <p className="muted">Голосовой ввод в этом браузере недоступен. Введите ответ текстом.</p>}
          {voice.error && <p className="error" role="alert">{voice.error}</p>}
          {draft.texts[draft.step].trim() && !assessment.sufficient && <p className="hint">{assessment.hint} Можно продолжить или дополнить ответ.</p>}
          <div className="navigation"><button className="secondary" disabled={busy} onClick={() => draft.step ? navigate(draft.step - 1) : setScreen('welcome')}><ArrowLeft size={16} />Назад</button><button className="primary" disabled={busy || draft.texts[draft.step].trim().length < 3} onClick={() => draft.step < QUESTIONS.length - 1 ? navigate(draft.step + 1) : setScreen('review')}>{draft.step === QUESTIONS.length - 1 ? 'Проверить ответы' : 'Далее'}<ArrowRight size={16} /></button></div>
        </div>
      </section>}
      {screen === 'review' && <section className="wide-panel"><p className="eyebrow">ПЕРЕД ГЕНЕРАЦИЕЙ</p><h1 tabIndex={-1} ref={focusRef}>Всё верно?</h1><p className="muted">Исправьте ответы при необходимости. Мы не добавляем неизвестные условия.</p><div className="review-list">{QUESTIONS.map((q, i) => <article key={q}><div><h2>{q}</h2><p>{draft.texts[i] || 'Пока нет ответа'}</p>{!(analysis?.assessments[i] || assessAnswer(i, draft.texts[i])).sufficient && <small>{(analysis?.assessments[i] || assessAnswer(i, draft.texts[i])).hint}</small>}</div><button className="text-button" disabled={analyzing} onClick={() => navigate(i)}>Изменить</button></article>)}</div><div className="toolbar"><button className="secondary" disabled={analyzing || answered !== QUESTIONS.length} onClick={analyze}>{analyzing ? 'Проверяем содержание…' : 'Проверить полноту'}</button><button className="primary" disabled={answered !== QUESTIONS.length || analyzing} onClick={generate}><Sparkles size={18} />Собрать основу</button></div>{analysis && <p role="status" className="hint">{analysis.source === 'ai' ? 'AI проверил содержание. Уточнения показаны под ответами; решение продолжить остаётся за вами.' : 'AI-проверка сейчас недоступна. Показаны базовые подсказки. Можно продолжить.'}</p>}</section>}
      {screen === 'processing' && <section className="processing" role="status" aria-live="polite"><Ring progress={answered} /><h1 tabIndex={-1} ref={focusRef}>Пишем основу вакансии</h1><p className="muted">Превращаем ваши ответы в связный текст. Обычно это занимает несколько секунд.</p><button className="secondary" onClick={() => { const current = request.current; request.current = null; current?.abort(); setScreen('review') }}>Отменить и вернуться</button></section>}
      {screen === 'result' && <section className="wide-panel result-panel"><p className="eyebrow">ЧЕРНОВИК ГОТОВ</p><div className="result-heading"><h1 tabIndex={-1} ref={focusRef}>Основа вакансии готова</h1><span className="source-badge">{draft.source === 'ai' ? 'AI-черновик' : 'Шаблон по ответам'}</span></div><p className="hint">{draft.notice || 'Проверьте текст и заполните уточнения перед публикацией.'}</p><div className="toolbar"><button className="secondary" onClick={() => setPreview(!preview)}>{preview ? 'Редактировать текст' : 'Показать превью'}</button><button className="secondary" onClick={copy}><Copy size={16} />{copied ? 'Скопировано' : 'Копировать'}</button><button className="secondary" onClick={download}><Download size={16} />Скачать .md</button></div>
        {preview ? <article className="vacancy-paper"><ReactMarkdown skipHtml>{draft.result}</ReactMarkdown></article> : <textarea className="result-editor" aria-label="Редактор вакансии" value={draft.result} onChange={e => setDraft(d => ({ ...d, result: e.target.value }))} rows={24} />}
        <div className="navigation"><button className="secondary" onClick={() => setScreen('review')}><ArrowLeft size={16} />К ответам</button><button className="text-button" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Новая вакансия</button></div>
      </section>}
      {error && <p className="error global-error" role="alert">{error}</p>}
      {storageError && <p className="error" role="alert">Браузер не разрешил сохранить черновик. Скачайте результат перед закрытием.</p>}
    </main>

    {confirmReset && <div className="modal-backdrop"><section className="modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" onKeyDown={e => { if (e.key === 'Escape') setConfirmReset(false); if (e.key === 'Tab') { e.preventDefault(); const buttons = e.currentTarget.querySelectorAll('button'); (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus() } }}><h2 id="reset-title">Удалить текущий черновик?</h2><p>Ответы и текст вакансии будут удалены с этого устройства. Сначала скачайте нужный результат.</p><div className="navigation"><button autoFocus className="secondary" onClick={() => setConfirmReset(false)}>Оставить черновик</button><button className="primary" onClick={reset}>Удалить и начать</button></div></section></div>}
  </div>
}
