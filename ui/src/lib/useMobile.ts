import { useState, useEffect } from 'react'

export function useMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}
