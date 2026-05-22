import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import type { Module } from '../lib/types'

interface ProgressSidebarProps {
  modules: Module[]
}

export default function ProgressSidebar({ modules }: ProgressSidebarProps) {
  const { moduleId, lessonId } = useParams()
  const { isLessonComplete, progress } = useProgress()
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set([moduleId || 'm0'])
  )

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalLessons = modules.flatMap((m) => m.lessons).length
  const completedCount = progress.completedLessons.length
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-sm font-bold text-white">Scalar Academy</span>
        </div>
        <p className="text-xs text-slate-500 leading-tight">Multi-Agent AI: Prompt → Production</p>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Progress</span>
          <span className="text-xs font-semibold text-brand-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">{completedCount}/{totalLessons} lessons</p>
      </div>

      {/* Module list */}
      <nav className="flex-1 py-2">
        {modules.map((mod) => {
          const isActive = mod.id === moduleId
          const expanded = expandedModules.has(mod.id)
          const modComplete = mod.lessons.every((l) => isLessonComplete(`${mod.id}-${l.id}`))

          return (
            <div key={mod.id}>
              <button
                onClick={() => toggleModule(mod.id)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  isActive ? 'bg-brand/10 border-r-2 border-brand' : 'hover:bg-slate-800'
                }`}
              >
                {modComplete ? (
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle size={14} className="text-slate-600 flex-shrink-0" />
                )}
                <span className={`flex-1 text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {mod.id.toUpperCase()}: {mod.title}
                </span>
                {expanded ? <ChevronDown size={12} className="text-slate-600" /> : <ChevronRight size={12} className="text-slate-600" />}
              </button>

              {expanded && (
                <div className="pl-8 py-1">
                  {mod.lessons.map((lesson) => {
                    const lid = `${mod.id}-${lesson.id}`
                    const done = isLessonComplete(lid)
                    const active = lessonId === lesson.id && moduleId === mod.id
                    return (
                      <Link
                        key={lesson.id}
                        to={`/module/${mod.id}/lesson/${lesson.id}`}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          active ? 'bg-brand/20 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {done
                          ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                          : <Circle size={11} className="text-slate-700 flex-shrink-0" />}
                        <span className="truncate">{lesson.title}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
