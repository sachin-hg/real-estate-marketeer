// Brand name is resolved at build time from VITE_APP_NAME (set in .env or CI).
// No runtime fetch needed — Vite bakes import.meta.env.VITE_APP_NAME into the
// bundle at build time, so the value is always available without a network round-trip.
//
// If you need to change the brand name: update VITE_APP_NAME and rebuild.
// The prerender.mjs SSG script reads the same env var to bake it into HTML.

export const BRAND_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'NAVA'

// Drop-in hook for components that already use useBrandName() — returns the
// build-time constant synchronously, no state or effect needed.
export function useBrandName(): string {
  return BRAND_NAME
}
