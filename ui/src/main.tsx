import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

const appElement = (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </HelmetProvider>
)

// Routes whose HTML is pre-rendered at build time via ssr-render.mjs.
// For these, React must hydrate the existing DOM (not replace it).
// All other routes (dashboard/*) fall back to the SPA shell with an empty root
// div — use createRoot there to avoid hydration mismatches.
const SSR_ROUTES = new Set(['/', '/pricing', '/demo', '/login', '/invest', '/pitch'])
const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
const container = document.getElementById('root')!

if (container.hasChildNodes() && SSR_ROUTES.has(currentPath)) {
  ReactDOM.hydrateRoot(container, appElement)
} else {
  // Clear any stale SSR content (e.g. landing page HTML served as SPA fallback)
  container.innerHTML = ''
  ReactDOM.createRoot(container).render(appElement)
}
