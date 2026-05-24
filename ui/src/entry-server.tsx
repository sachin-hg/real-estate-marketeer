/**
 * entry-server.tsx — Vite SSR build entry.
 *
 * Exports a single `render(url)` function used by scripts/ssr-render.mjs at
 * build time to produce fully-rendered HTML for each public route.
 *
 * Only public (unauthenticated) routes are included here.  Protected routes
 * (dashboard/*) are never pre-rendered — they fall back to the SPA shell.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'

// Import public pages eagerly — lazy() returns Suspense fallbacks in renderToString
import Landing from './pages/Landing'
import Login from './pages/Login'
import InvestorLanding from './pages/InvestorLanding'
import Pricing from './pages/Pricing'
import Demo from './pages/Demo'
import Pitch from './pages/Pitch'

function PublicApp() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/invest" element={<InvestorLanding />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/demo" element={<Demo />} />
      {/* Auth-gated at the server — FastAPI redirects unauthenticated requests
          before this HTML is ever served, so no client-side auth wrapper needed. */}
      <Route path="/pitch" element={<Pitch />} />
    </Routes>
  )
}

export function render(url: string): { appHtml: string } {
  const helmetContext = {}
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })

  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={queryClient}>
        <StaticRouter location={url}>
          <AuthProvider>
            <PublicApp />
          </AuthProvider>
        </StaticRouter>
      </QueryClientProvider>
    </HelmetProvider>
  )

  return { appHtml }
}
