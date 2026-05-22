import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
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
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/posts/:postId" element={<PostDetail />} />
        <Route path="/prompts" element={<Prompts />} />
        <Route path="/generate" element={<Generate />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/live" element={<Navigate to="/posts" replace />} />
        <Route path="/dev" element={<Navigate to="/generate" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/runs" element={<RunsList />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
