import { Link } from 'react-router-dom'
import { CheckCircle2, Lock, Clock, ChevronRight, Zap } from 'lucide-react'
import { useProgress } from '../hooks/useProgress'
import type { Module } from '../lib/types'
import { ALL_MODULES } from '../content'

const DIFFICULTY_COLOR = {
  intro:         'text-blue-400 bg-blue-950/40',
  beginner:      'text-emerald-400 bg-emerald-950/40',
  intermediate:  'text-amber-400 bg-amber-950/40',
  advanced:      'text-red-400 bg-red-950/40',
}

function ModuleCard({ mod }: { mod: Module }) {
  const { isModuleUnlocked, isLessonComplete, progress } = useProgress()
  const unlocked = isModuleUnlocked(mod.id)
  const completedCount = mod.lessons.filter((l) => isLessonComplete(`${mod.id}-${l.id}`)).length
  const total = mod.lessons.length
  const allDone = total > 0 && completedCount === total
  const pipelineLabel = mod.pipelineVersion ? `pipeline.py ${mod.pipelineVersion}` : null

  return (
    <Link
      to={unlocked ? `/module/${mod.id}` : '#'}
      className={`group block rounded-xl border transition-all duration-200 ${
        unlocked
          ? 'border-slate-700 bg-slate-900 hover:border-brand/50 hover:bg-slate-800/80'
          : 'border-slate-800 bg-slate-900/40 cursor-not-allowed opacity-50'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-brand-400">{mod.id.toUpperCase()}</span>
            {allDone && <CheckCircle2 size={14} className="text-emerald-400" />}
            {!unlocked && <Lock size={13} className="text-slate-600" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[mod.difficulty]}`}>
              {mod.difficulty}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock size={11} />
              {mod.durationMin}m
            </span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-brand-200 transition-colors">
          {mod.title}
        </h3>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{mod.subtitle}</p>

        {/* Pipeline version badge */}
        {pipelineLabel && (
          <div className="flex items-center gap-1 mb-3">
            <Zap size={11} className="text-brand-400" />
            <span className="text-xs font-mono text-brand-400">{pipelineLabel}</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {mod.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        {unlocked && total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{completedCount}/{total} lessons</span>
              {unlocked && <ChevronRight size={13} className="text-slate-600 group-hover:text-brand-400 transition-colors" />}
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(completedCount / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

export default function CourseHome() {
  const { progress, resetProgress } = useProgress()
  const totalLessons = ALL_MODULES.flatMap((m) => m.lessons).length
  const completedCount = progress.completedLessons.length
  const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Scalar Academy</p>
              <h1 className="text-sm font-bold text-white leading-tight">Multi-Agent AI: Prompt → Production</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Overall Progress</p>
              <p className="text-sm font-bold text-brand-400">{overallPct}%</p>
            </div>
            <button
              onClick={() => { if (confirm('Reset all progress?')) resetProgress() }}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-4 py-1.5 mb-4">
            <span className="text-xs text-brand-400 font-medium">Built on the Housing.com production codebase</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            From Single Prompt<br />to Production Pipeline
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            12 modules. One evolving <code className="text-brand-300 bg-slate-800 px-1 rounded">pipeline.py</code>.
            Every concept drawn from a real multi-agent system that runs 2× daily at Housing.com.
          </p>

          {/* Global progress bar */}
          <div className="max-w-sm mx-auto mt-6">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">{completedCount} of {totalLessons} lessons complete</p>
          </div>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_MODULES.map((mod) => <ModuleCard key={mod.id} mod={mod} />)}
        </div>
      </main>
    </div>
  )
}
