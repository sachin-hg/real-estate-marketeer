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
import { Suspense } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Import public pages eagerly — lazy() returns Suspense fallbacks in renderToString.
// Suspense wrappers here mirror App.tsx exactly so the server and client React trees
// match during hydration. Since imports are eager, Suspense never actually suspends.
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
      <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
      <Route path="/invest" element={<Suspense fallback={null}><InvestorLanding /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={null}><Pricing /></Suspense>} />
      <Route path="/demo" element={<Suspense fallback={null}><Demo /></Suspense>} />
      {/* Mirror the client's ProtectedRoute wrapper so the React tree matches on hydration.
          ProtectedRoute with optimistic=true renders <Outlet /> while isLoading=true,
          which is always the case during SSR (useEffect never runs server-side). */}
      <Route element={<ProtectedRoute optimistic />}>
        <Route path="/pitch" element={<Suspense fallback={null}><Pitch /></Suspense>} />
      </Route>
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
