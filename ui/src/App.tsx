import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

// Landing stays eager — it's the critical-path page for unauthenticated users,
// and its pre-baked SSG HTML is already served before JS loads.
import Landing from './pages/Landing'

// All other public pages lazy-loaded — each visited in isolation, no co-loading needed.
const Login = lazy(() => import('./pages/Login'))
const InvestorLanding = lazy(() => import('./pages/InvestorLanding'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Demo = lazy(() => import('./pages/Demo'))

// Protected pages — always lazy (only authenticated users, never on first load)
const Layout = lazy(() => import('./components/Layout'))
const Pitch = lazy(() => import('./pages/Pitch'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Posts = lazy(() => import('./pages/Posts'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Prompts = lazy(() => import('./pages/Prompts'))
const Generate = lazy(() => import('./pages/Generate'))
const Trending = lazy(() => import('./pages/Trending'))
const Settings = lazy(() => import('./pages/Settings'))
const RunsList = lazy(() => import('./pages/RunsList'))
const RunDetail = lazy(() => import('./pages/RunDetail'))
const Analytics = lazy(() => import('./pages/Analytics'))

// Minimal dark-background fallback — prevents white flash while chunks load.
// Keeps layout stable (no CLS) and signals loading without a full spinner.
function PageFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07071a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2px solid rgba(139,92,246,0.3)',
        borderTopColor: '#8B5CF6',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Thin fallback for within-shell page transitions — no full-height layout needed.
function SectionFallback() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      background: 'transparent',
    }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '2px solid rgba(139,92,246,0.3)',
        borderTopColor: '#8B5CF6',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

function AppShell() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Layout />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
      <Route path="/invest" element={<Suspense fallback={<PageFallback />}><InvestorLanding /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={<PageFallback />}><Pricing /></Suspense>} />
      <Route path="/demo" element={<Suspense fallback={<PageFallback />}><Demo /></Suspense>} />

      {/* Protected: investor pitch */}
      <Route element={<ProtectedRoute />}>
        <Route path="/pitch" element={<Suspense fallback={<PageFallback />}><Pitch /></Suspense>} />
      </Route>

      {/* Protected: app shell with sidebar */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Suspense fallback={<SectionFallback />}><Dashboard /></Suspense>} />
          <Route path="/dashboard/posts" element={<Suspense fallback={<SectionFallback />}><Posts /></Suspense>} />
          <Route path="/dashboard/posts/:postId" element={<Suspense fallback={<SectionFallback />}><PostDetail /></Suspense>} />
          <Route path="/dashboard/prompts" element={<Suspense fallback={<SectionFallback />}><Prompts /></Suspense>} />
          <Route path="/dashboard/generate" element={<Suspense fallback={<SectionFallback />}><Generate /></Suspense>} />
          <Route path="/dashboard/trending" element={<Suspense fallback={<SectionFallback />}><Trending /></Suspense>} />
          <Route path="/dashboard/settings" element={<Suspense fallback={<SectionFallback />}><Settings /></Suspense>} />
          <Route path="/dashboard/runs" element={<Suspense fallback={<SectionFallback />}><RunsList /></Suspense>} />
          <Route path="/dashboard/runs/:runId" element={<Suspense fallback={<SectionFallback />}><RunDetail /></Suspense>} />
          <Route path="/dashboard/analytics" element={<Suspense fallback={<SectionFallback />}><Analytics /></Suspense>} />
          {/* legacy redirects */}
          <Route path="/posts" element={<Navigate to="/dashboard/posts" replace />} />
          <Route path="/posts/:postId" element={<Navigate to="/dashboard/posts" replace />} />
          <Route path="/runs" element={<Navigate to="/dashboard/runs" replace />} />
          <Route path="/runs/:runId" element={<Navigate to="/dashboard/runs" replace />} />
          <Route path="/analytics" element={<Navigate to="/dashboard/analytics" replace />} />
          <Route path="/generate" element={<Navigate to="/dashboard/generate" replace />} />
          <Route path="/trending" element={<Navigate to="/dashboard/trending" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
          <Route path="/prompts" element={<Navigate to="/dashboard/prompts" replace />} />
          <Route path="/live" element={<Navigate to="/dashboard/posts" replace />} />
          <Route path="/dev" element={<Navigate to="/dashboard/generate" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
