import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Code2, Factory, Play, ChevronRight } from 'lucide-react'
import { useProgress } from '../hooks/useProgress'
import ProgressSidebar from '../components/ProgressSidebar'
import ConceptPanel from '../components/ConceptPanel'
import CodePanel from '../components/CodePanel'
import BrokenCodePanel from '../components/BrokenCodePanel'
import FillInAnimation from '../components/FillInAnimation'
import QuizBlock from '../components/QuizBlock'
import PyodideRunner from '../components/PyodideRunner'
import ProductionLink from '../components/ProductionLink'
import { ALL_MODULES } from '../content'
import type { Lesson } from '../lib/types'

type TabId = 'concept' | 'code' | 'prod' | 'try'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'concept', label: 'Concept', icon: BookOpen },
  { id: 'code',    label: 'Code',    icon: Code2 },
  { id: 'prod',    label: 'In Prod', icon: Factory },
  { id: 'try',     label: 'Try It',  icon: Play },
]

function LessonView({ lesson, moduleId }: { lesson: Lesson; moduleId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>('concept')
  const [revealedTodos, setRevealedTodos] = useState<number[]>([])
  const [midQuizPassed, setMidQuizPassed] = useState(false)
  const [endQuizPassed, setEndQuizPassed] = useState(false)
  const { markLessonComplete, saveQuizScore, isLessonComplete } = useProgress()
  const lessonId = `${moduleId}-${lesson.id}`
  const done = isLessonComplete(lessonId)

  const handleMidQuizComplete = (score: number) => {
    saveQuizScore(`${lessonId}-mid`, score)
    if (score >= 0.6) {
      setMidQuizPassed(true)
      // Unlock next TODO reveal
      setRevealedTodos((prev) => {
        const nextIdx = prev.length
        return lesson.brokenCode && nextIdx < lesson.brokenCode.todos.length
          ? [...prev, nextIdx]
          : prev
      })
    }
  }

  const handleEndQuizComplete = (score: number) => {
    saveQuizScore(`${lessonId}-end`, score)
    if (score >= 0.6) {
      setEndQuizPassed(true)
      markLessonComplete(lessonId)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Lesson header */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">{lesson.title}</h2>
          <span className="text-xs text-slate-500">{lesson.durationMin} min</span>
        </div>
        {done && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => {
            const hasContent =
              (id === 'concept' && lesson.concept.length > 0) ||
              (id === 'code' && (lesson.brokenCode || lesson.completeCode)) ||
              (id === 'prod' && lesson.productionRef) ||
              (id === 'try' && lesson.pyodideCode)
            if (!hasContent) return null
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-brand text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6 max-w-3xl">
        {activeTab === 'concept' && (
          <div className="space-y-6">
            <ConceptPanel sections={lesson.concept} />

            {/* Mid-lesson quiz (gates code reveal) */}
            {lesson.midQuiz && lesson.midQuiz.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  {midQuizPassed ? '✓ Quiz passed — code revealed below' : 'Answer to unlock the code reveal'}
                </h3>
                <QuizBlock
                  questions={lesson.midQuiz}
                  gatesReveal
                  onComplete={handleMidQuizComplete}
                  title="Mid-Lesson Quiz"
                />
              </div>
            )}

            {/* End-of-lesson quiz */}
            {lesson.endQuiz && lesson.endQuiz.length > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">Module Quiz</h3>
                <QuizBlock
                  questions={lesson.endQuiz}
                  onComplete={handleEndQuizComplete}
                  title="Module Quiz"
                />
                {endQuizPassed && (
                  <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700/40 rounded-xl text-sm text-emerald-300">
                    🎉 Lesson complete! Continue to the next lesson.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && (
          <div className="space-y-6">
            {lesson.brokenCode && (
              <div>
                <h3 className="text-sm font-semibold text-amber-300 mb-3">
                  ⚠ Broken version — spot what's missing
                </h3>
                <BrokenCodePanel
                  broken={lesson.brokenCode}
                  revealedIndices={revealedTodos}
                  filename="pipeline.py"
                />
                {midQuizPassed && revealedTodos.length > 0 && (
                  <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-700/30 rounded-lg">
                    <p className="text-xs text-emerald-300 font-medium mb-1">✓ Revealed: correct code filled in above</p>
                    <p className="text-xs text-slate-400">
                      {lesson.brokenCode.todos[revealedTodos[revealedTodos.length - 1]]?.lineHint}
                    </p>
                  </div>
                )}
              </div>
            )}
            {lesson.completeCode && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Complete version</h3>
                <CodePanel example={lesson.completeCode} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'prod' && lesson.productionRef && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              This exact pattern in the Housing.com production codebase:
            </p>
            <ProductionLink ref_={lesson.productionRef} />
          </div>
        )}

        {activeTab === 'try' && lesson.pyodideCode && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Run this in your browser — Python executes via WebAssembly. LLM calls are mocked.
            </p>
            <PyodideRunner
              initialCode={lesson.pyodideCode}
              expectedOutput={lesson.pyodideExpected}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ModuleView() {
  const { moduleId, lessonId } = useParams()
  useProgress()

  const mod = ALL_MODULES.find((m) => m.id === moduleId)
  if (!mod) return <Navigate to="/" replace />

  const currentLesson = lessonId ? mod.lessons.find((l) => l.id === lessonId) : mod.lessons[0]
  if (!currentLesson) return <Navigate to={`/module/${mod.id}`} replace />

  const currentIdx = mod.lessons.indexOf(currentLesson)
  const prevLesson = currentIdx > 0 ? mod.lessons[currentIdx - 1] : null
  const nextLesson = currentIdx < mod.lessons.length - 1 ? mod.lessons[currentIdx + 1] : null

  // Find prev/next module
  const modIdx = ALL_MODULES.indexOf(mod)
  const nextMod = modIdx < ALL_MODULES.length - 1 ? ALL_MODULES[modIdx + 1] : null

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <ProgressSidebar modules={ALL_MODULES} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/40">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={13} />
            All modules
          </Link>
          <div className="flex items-center gap-2">
            {prevLesson && (
              <Link
                to={`/module/${mod.id}/lesson/${prevLesson.id}`}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
              >
                <ArrowLeft size={13} />
                {prevLesson.title}
              </Link>
            )}
            {nextLesson ? (
              <Link
                to={`/module/${mod.id}/lesson/${nextLesson.id}`}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand transition-colors"
              >
                {nextLesson.title}
                <ArrowRight size={13} />
              </Link>
            ) : nextMod ? (
              <Link
                to={`/module/${nextMod.id}`}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand transition-colors"
              >
                Next: {nextMod.title}
                <ChevronRight size={13} />
              </Link>
            ) : null}
          </div>
        </div>

        <LessonView key={`${mod.id}-${currentLesson.id}`} lesson={currentLesson} moduleId={mod.id} />
      </div>
    </div>
  )
}
