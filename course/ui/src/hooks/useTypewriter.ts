import { useState, useEffect, useRef, useCallback } from 'react'

export type TypewriterState = 'idle' | 'pulsing' | 'erasing' | 'typing' | 'flashing' | 'done'

interface UseTypewriterOptions {
  charDelayMs?: number
  pulseMs?: number
  flashMs?: number
  onComplete?: () => void
}

export function useTypewriter(text: string, options: UseTypewriterOptions = {}) {
  const { charDelayMs = 30, pulseMs = 600, flashMs = 800, onComplete } = options
  const [state, setState] = useState<TypewriterState>('idle')
  const [displayed, setDisplayed] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const start = useCallback(() => {
    clear()
    setState('pulsing')
    setDisplayed('???')

    // Phase 1: amber pulse
    timeoutRef.current = setTimeout(() => {
      setState('erasing')
      setDisplayed('')

      // Phase 2: small pause after erase
      timeoutRef.current = setTimeout(() => {
        setState('typing')
        let i = 0

        const typeNext = () => {
          if (i < text.length) {
            setDisplayed(text.slice(0, i + 1))
            i++
            timeoutRef.current = setTimeout(typeNext, charDelayMs)
          } else {
            // Phase 3: green flash
            setState('flashing')
            timeoutRef.current = setTimeout(() => {
              setState('done')
              onComplete?.()
            }, flashMs)
          }
        }
        typeNext()
      }, 150)
    }, pulseMs)
  }, [text, charDelayMs, pulseMs, flashMs, onComplete])

  const reset = useCallback(() => {
    clear()
    setState('idle')
    setDisplayed('???')
  }, [])

  useEffect(() => () => clear(), [])

  return { state, displayed, start, reset }
}
