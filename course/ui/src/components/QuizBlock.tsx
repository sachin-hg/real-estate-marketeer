import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import type { Question, MCQQuestion, FillInQuestion, TFQuestion } from '../lib/types'

function MCQItem({ q, onAnswer }: { q: MCQQuestion; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleSelect = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    onAnswer(i === q.correctIndex)
  }

  return (
    <div>
      <p className="text-sm text-white font-medium mb-3">{q.stem}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrect = i === q.correctIndex
          const showResult = selected !== null

          let cls = 'border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
          if (showResult && isCorrect) cls = 'border border-emerald-500 bg-emerald-950/40 text-emerald-200'
          else if (showResult && isSelected && !isCorrect) cls = 'border border-red-500 bg-red-950/40 text-red-200'

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selected !== null}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${cls}`}
            >
              <span className="font-mono text-xs text-slate-500 mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          )
        })}
      </div>
      {selected !== null && (
        <div className={`mt-3 px-4 py-2 rounded-lg text-xs ${selected === q.correctIndex ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'}`}>
          {selected === q.correctIndex ? '✓ Correct — ' : '✗ Incorrect — '}
          {q.explanation}
        </div>
      )}
    </div>
  )
}

function FillInItem({ q, onAnswer }: { q: FillInQuestion; onAnswer: (correct: boolean) => void }) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const isCorrect = value.trim().toLowerCase() === q.answer.toLowerCase()

  const handleSubmit = () => {
    if (!value.trim()) return
    setSubmitted(true)
    onAnswer(isCorrect)
  }

  return (
    <div>
      <p className="text-sm text-white font-medium mb-3">{q.stem}</p>
      {q.hint && <p className="text-xs text-slate-500 mb-2">Hint: {q.hint}</p>}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
          disabled={submitted}
          placeholder="Type your answer..."
          className="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand disabled:opacity-60 font-mono"
        />
        <button
          onClick={handleSubmit}
          disabled={submitted || !value.trim()}
          className="px-3 py-2 bg-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-brand-600 transition-colors"
        >
          Check
        </button>
      </div>
      {submitted && (
        <div className={`mt-3 px-4 py-2 rounded-lg text-xs flex items-start gap-2 ${isCorrect ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'}`}>
          {isCorrect ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="flex-shrink-0 mt-0.5" />}
          <span>{isCorrect ? 'Correct!' : `Expected: ${q.answer}`}{q.explanation ? ` — ${q.explanation}` : ''}</span>
        </div>
      )}
    </div>
  )
}

function TFItem({ q, onAnswer }: { q: TFQuestion; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<boolean | null>(null)

  const handleSelect = (v: boolean) => {
    if (selected !== null) return
    setSelected(v)
    onAnswer(v === q.answer)
  }

  return (
    <div>
      <p className="text-sm text-white font-medium mb-3">{q.stem}</p>
      <div className="flex gap-3">
        {([true, false] as const).map((v) => {
          const isSelected = selected === v
          const isCorrect = v === q.answer
          const showResult = selected !== null
          let cls = 'border border-slate-700 text-slate-300 hover:border-slate-500'
          if (showResult && isCorrect) cls = 'border border-emerald-500 bg-emerald-950/40 text-emerald-200'
          else if (showResult && isSelected && !isCorrect) cls = 'border border-red-500 bg-red-950/40 text-red-200'
          return (
            <button key={String(v)} onClick={() => handleSelect(v)} disabled={selected !== null}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${cls}`}>
              {v ? 'True' : 'False'}
            </button>
          )
        })}
      </div>
      {selected !== null && (
        <div className={`mt-3 px-4 py-2 rounded-lg text-xs ${selected === q.answer ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'}`}>
          {selected === q.answer ? '✓ Correct — ' : '✗ Incorrect — '}{q.explanation}
        </div>
      )}
    </div>
  )
}

interface QuizBlockProps {
  questions: Question[]
  gatesReveal?: boolean
  passingScore?: number
  onComplete?: (score: number) => void
  title?: string
}

export default function QuizBlock({ questions, gatesReveal = false, passingScore = 0.6, onComplete, title }: QuizBlockProps) {
  const [answers, setAnswers] = useState<(boolean | null)[]>(Array(questions.length).fill(null))
  const [currentIdx, setCurrentIdx] = useState(0)
  const [quizComplete, setQuizComplete] = useState(false)

  const handleAnswer = (idx: number, correct: boolean) => {
    const updated = [...answers]
    updated[idx] = correct
    setAnswers(updated)

    if (idx === questions.length - 1 || !gatesReveal) {
      // All answered or non-gating: check completion
      setTimeout(() => {
        if (idx === questions.length - 1) {
          const score = updated.filter(Boolean).length / questions.length
          setQuizComplete(true)
          onComplete?.(score)
        } else if (!gatesReveal) {
          setCurrentIdx(idx + 1)
        }
      }, 800)
    }
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1)
  }

  const score = answers.filter(Boolean).length / questions.length
  const passed = score >= passingScore

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {title || (gatesReveal ? 'Mid-Lesson Quiz' : 'Module Quiz')}
          </span>
          {gatesReveal && <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">Unlocks code reveal</span>}
        </div>
        <span className="text-xs text-slate-500">{Math.min(currentIdx + 1, questions.length)}/{questions.length}</span>
      </div>

      <div className="p-4">
        {/* Progress dots */}
        <div className="flex gap-1.5 mb-4">
          {questions.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
              answers[i] === true ? 'bg-emerald-500' :
              answers[i] === false ? 'bg-red-500' :
              i === currentIdx ? 'bg-brand' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        {/* Current question */}
        {!quizComplete ? (
          <div>
            {(() => {
              const q = questions[currentIdx]
              const answered = answers[currentIdx] !== null
              const content = (() => {
                if (q.type === 'mcq') return <MCQItem q={q} onAnswer={(c) => handleAnswer(currentIdx, c)} />
                if (q.type === 'fillin') return <FillInItem q={q} onAnswer={(c) => handleAnswer(currentIdx, c)} />
                return <TFItem q={q} onAnswer={(c) => handleAnswer(currentIdx, c)} />
              })()
              return (
                <div>
                  {content}
                  {answered && currentIdx < questions.length - 1 && (
                    <button onClick={handleNext}
                      className="mt-4 flex items-center gap-1 text-xs text-brand-400 hover:text-brand transition-colors">
                      Next question <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <div className={`text-center py-4 ${passed ? 'text-emerald-300' : 'text-red-300'}`}>
            <p className="text-2xl font-bold mb-1">{Math.round(score * 100)}%</p>
            <p className="text-sm">{passed ? (gatesReveal ? '🎉 Code reveal unlocked!' : '✓ Module complete!') : 'Review the concepts and try again'}</p>
            <p className="text-xs text-slate-500 mt-1">{answers.filter(Boolean).length}/{questions.length} correct</p>
          </div>
        )}
      </div>
    </div>
  )
}
