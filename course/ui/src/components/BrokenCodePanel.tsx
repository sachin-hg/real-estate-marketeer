import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, HelpCircle } from 'lucide-react'
import type { BrokenCode, TodoItem } from '../lib/types'

interface TodoHintProps {
  todo: TodoItem
  revealed: boolean
}

function TodoHint({ todo, revealed }: TodoHintProps) {
  const [open, setOpen] = useState(false)

  if (revealed) return null

  return (
    <span className="relative inline-block ml-2 align-middle">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-amber-400 hover:text-amber-300 transition-colors"
        title="Show hint"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-72 rounded-lg bg-slate-800 border border-amber-600/40 p-3 shadow-xl">
          <p className="text-xs font-semibold text-amber-300 mb-1">💡 Hint</p>
          <p className="text-xs text-slate-300 mb-2">{todo.lineHint}</p>
          <p className="text-xs font-semibold text-red-400 mb-1">⚠ Why it matters</p>
          <p className="text-xs text-slate-400">{todo.whyItMatters}</p>
          <button onClick={() => setOpen(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-400">Close</button>
        </div>
      )}
    </span>
  )
}

interface BrokenCodePanelProps {
  broken: BrokenCode
  revealedIndices: number[]   // which todos have been revealed (by index)
  filename?: string
}

export default function BrokenCodePanel({ broken, revealedIndices, filename }: BrokenCodePanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(broken.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Build rendered code: replace revealed ??? with correct code, leave others
  let renderCode = broken.code
  broken.todos.forEach((todo, idx) => {
    if (revealedIndices.includes(idx)) {
      renderCode = renderCode.replace(todo.marker, todo.correctCode)
    }
  })

  // Split into lines to identify TODO lines for custom rendering
  const lines = broken.code.split('\n')
  const todoLineNumbers = new Set<number>()
  lines.forEach((line, i) => {
    if (broken.todos.some((t) => line.includes(t.marker) || line.includes('# ⚠ TODO'))) {
      todoLineNumbers.add(i + 1)
    }
  })

  return (
    <div className="rounded-xl border border-amber-700/50 overflow-hidden bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-amber-700/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-300 font-mono">{filename || 'pipeline.py'} — broken version</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="relative">
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', maxHeight: '480px' }}
          showLineNumbers
          wrapLines
          lineProps={(lineNumber) => {
            if (todoLineNumbers.has(lineNumber)) {
              return {
                style: {
                  display: 'block',
                  backgroundColor: 'rgba(251,191,36,0.08)',
                  borderLeft: '3px solid #FBBF24',
                },
              }
            }
            return {}
          }}
        >
          {renderCode}
        </SyntaxHighlighter>

        {/* Overlay hint buttons next to ??? lines */}
        <div className="absolute top-0 right-2 flex flex-col gap-0.5 pt-2">
          {broken.todos.map((todo, idx) => (
            !revealedIndices.includes(idx) && (
              <TodoHint key={idx} todo={todo} revealed={false} />
            )
          ))}
        </div>
      </div>

      <div className="px-4 py-2 bg-amber-950/20 border-t border-amber-700/30">
        <p className="text-xs text-amber-400">
          {revealedIndices.length}/{broken.todos.length} TODO{broken.todos.length !== 1 ? 's' : ''} revealed
          {revealedIndices.length < broken.todos.length && ' — answer the quiz above to unlock'}
        </p>
      </div>
    </div>
  )
}
