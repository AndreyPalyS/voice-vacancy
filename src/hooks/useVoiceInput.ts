import { useEffect, useRef, useState } from 'react'

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null
  start(): void; stop(): void; abort(): void
}

/** One recognizer per mount; changing callbacks never interrupts the microphone. */
export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [pending, setPending] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<Recognition | null>(null)
  const callback = useRef(onText)
  useEffect(() => { callback.current = onText }, [onText])
  const host = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Constructor = host.SpeechRecognition || host.webkitSpeechRecognition
  useEffect(() => {
    if (!Constructor) return
    const recognition = new Constructor()
    recognition.lang = 'ru-RU'; recognition.continuous = true; recognition.interimResults = true
    recognition.onstart = () => { setPending(false); setListening(true) }
    recognition.onend = () => { setPending(false); setListening(false); setInterim('') }
    recognition.onerror = ({ error: code }) => {
      setPending(false); setListening(false)
      if (code === 'aborted') return
      setError(code === 'not-allowed' ? 'Разрешите доступ к микрофону в настройках браузера или введите ответ.' : code === 'no-speech' ? 'Речь не обнаружена. Попробуйте ещё раз.' : 'Распознавание недоступно. Проверьте сеть или введите ответ текстом.')
    }
    recognition.onresult = event => {
      let final = ''; let draft = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript + ' '
        else draft += result[0].transcript
      }
      if (final.trim()) callback.current(final.trim())
      setInterim(draft)
    }
    ref.current = recognition
    return () => {
      recognition.onstart = null; recognition.onend = null; recognition.onerror = null; recognition.onresult = null
      recognition.abort(); ref.current = null
    }
  }, [Constructor])
  return { listening, pending, interim, error, supported: !!Constructor,
    start: () => {
      if (pending || listening) return
      setError(''); setPending(true)
      try { ref.current?.start() } catch { setPending(false); setError('Не удалось включить микрофон. Попробуйте снова.') }
    },
    stop: () => { setPending(true); ref.current?.stop() },
  }
}
