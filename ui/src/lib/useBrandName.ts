import { useEffect, useState } from 'react'

export function useBrandName(): string {
  const [brand, setBrand] = useState<string>(
    (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'NAVA'
  )
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((d: { app_name?: string }) => { if (d.app_name) setBrand(d.app_name) })
      .catch(() => {})
  }, [])
  return brand
}
