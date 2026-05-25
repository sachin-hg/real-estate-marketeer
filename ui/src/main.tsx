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

// Pre-load the current page's lazy chunk before hydrating.
// App.tsx uses React.lazy for these pages — if the chunk hasn't resolved when
// hydrateRoot runs, React.lazy suspends and shows the spinner fallback, which
// doesn't match the server HTML → error #418. By awaiting the same import()
// Promise that React.lazy already started (browser module cache deduplicates it),
// we ensure React.lazy's internal cache is populated before hydration begins.
const SSR_PRELOADS: Partial<Record<string, () => Promise<unknown>>> = {
  '/pricing': () => import('./pages/Pricing'),
  '/invest':  () => import('./pages/InvestorLanding'),
  '/demo':    () => import('./pages/Demo'),
  '/login':   () => import('./pages/Login'),
  '/pitch':   () => import('./pages/Pitch'),
}

function mount() {
  if (container.hasChildNodes() && SSR_ROUTES.has(currentPath)) {
    ReactDOM.hydrateRoot(container, appElement)
  } else {
    // Clear any stale SSR content (e.g. landing page HTML served as SPA fallback)
    container.innerHTML = ''
    ReactDOM.createRoot(container).render(appElement)
  }
}

const preload = SSR_PRELOADS[currentPath]
if (preload && container.hasChildNodes() && SSR_ROUTES.has(currentPath)) {
  // Wait for the page chunk to load, then hydrate. React.lazy's .then() was
  // registered first (at App.tsx import time), so its cache is populated before
  // our mount() callback fires.
  preload().then(mount).catch(mount) // catch: network error → still attempt hydration
} else {
  mount()
}
