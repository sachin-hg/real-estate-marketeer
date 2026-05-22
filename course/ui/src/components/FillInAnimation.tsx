import { useEffect } from 'react'
import { useTypewriter } from '../hooks/useTypewriter'

interface FillInAnimationProps {
  text: string
  autoStart?: boolean
  onComplete?: () => void
}

export default function FillInAnimation({ text, autoStart = false, onComplete }: FillInAnimationProps) {
  const { state, displayed, start } = useTypewriter(text, { onComplete })

  useEffect(() => {
    if (autoStart) start()
  }, [autoStart, start])

  const bgClass =
    state === 'pulsing' ? 'bg-amber-400/20 animate-pulse' :
    state === 'flashing' ? 'bg-emerald-400/20' :
    state === 'done' ? 'bg-emerald-400/10' :
    'bg-transparent'

  const textClass =
    state === 'done' ? 'text-emerald-300' :
    state === 'typing' || state === 'flashing' ? 'text-white' :
    'text-amber-400'

  return (
    <span className={`font-mono text-sm px-1 rounded transition-all duration-200 ${bgClass} ${textClass}`}>
      {displayed || (state === 'idle' ? '???' : '')}
      {(state === 'typing') && (
        <span className="inline-block w-0.5 h-4 bg-current align-middle ml-0.5 animate-pulse" />
      )}
    </span>
  )
}
