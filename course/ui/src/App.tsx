import { Routes, Route, Navigate } from 'react-router-dom'
import CourseHome from './pages/CourseHome'
import ModuleView from './pages/ModuleView'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Routes>
        <Route path="/" element={<CourseHome />} />
        <Route path="/module/:moduleId" element={<ModuleView />} />
        <Route path="/module/:moduleId/lesson/:lessonId" element={<ModuleView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
