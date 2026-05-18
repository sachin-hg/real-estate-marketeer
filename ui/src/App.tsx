import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Posts from './pages/Posts'
import Prompts from './pages/Prompts'
import Generate from './pages/Generate'
import Trending from './pages/Trending'
import LiveFeed from './pages/LiveFeed'
import DevMode from './pages/DevMode'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/prompts" element={<Prompts />} />
        <Route path="/generate" element={<Generate />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/live" element={<LiveFeed />} />
        <Route path="/dev" element={<DevMode />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
