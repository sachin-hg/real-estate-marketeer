import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import InvestorLanding from './pages/InvestorLanding'
import Pricing from './pages/Pricing'
import Demo from './pages/Demo'
import Dashboard from './pages/Dashboard'
import Pitch from './pages/Pitch'
import Posts from './pages/Posts'
import Prompts from './pages/Prompts'
import Generate from './pages/Generate'
import Trending from './pages/Trending'
import RunDetail from './pages/RunDetail'
import RunsList from './pages/RunsList'
import PostDetail from './pages/PostDetail'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/invest" element={<InvestorLanding />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/demo" element={<Demo />} />

      {/* Protected: investor pitch */}
      <Route element={<ProtectedRoute />}>
        <Route path="/pitch" element={<Pitch />} />
      </Route>

      {/* Protected: app shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/posts" element={<Posts />} />
          <Route path="/dashboard/posts/:postId" element={<PostDetail />} />
          <Route path="/dashboard/prompts" element={<Prompts />} />
          <Route path="/dashboard/generate" element={<Generate />} />
          <Route path="/dashboard/trending" element={<Trending />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/runs" element={<RunsList />} />
          <Route path="/dashboard/runs/:runId" element={<RunDetail />} />
          <Route path="/dashboard/analytics" element={<Analytics />} />
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
