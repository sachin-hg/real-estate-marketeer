import { useState } from 'react'
import { Play, RotateCcw, Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { usePyodide } from '../hooks/usePyodide'

interface PyodideRunnerProps {
  initialCode: string
  readOnly?: boolean
  expectedOutput?: string
  label?: string
}

export default function PyodideRunner({ initialCode, readOnly = false, expectedOutput, label }: PyodideRunnerProps) {
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState<{ stdout: string; stderr: string; elapsedMs: number; success: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const { status, runCode } = usePyodide()

  const handleRun = async () => {
    const result = await runCode(code)
    setOutput(result)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setCode(initialCode)
    setOutput(null)
  }

  const isLoading = status === 'loading'
  const isRunning = status === 'running'
  const isReady = status === 'ready'

  const outputMatches = expectedOutput && output?.stdout.trim().includes(expectedOutput.trim())

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">{label || 'Try it — runs in your browser'}</span>
          {isLoading && <span className="text-xs text-amber-400 animate-pulse">Loading Python runtime...</span>}
          {isReady && <span className="text-xs text-emerald-400">● Ready</span>}
          {isRunning && <span className="text-xs text-brand-400 animate-pulse">Running...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={handleCopy} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleRun}
            disabled={!isReady || isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Play size={12} />
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Code editor */}
      {readOnly ? (
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', maxHeight: '300px' }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full bg-slate-950 text-slate-100 font-mono text-xs p-4 focus:outline-none resize-none"
          style={{ minHeight: '200px', maxHeight: '400px', tabSize: 4 }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const start = e.currentTarget.selectionStart
              const end = e.currentTarget.selectionEnd
              const newCode = code.slice(0, start) + '    ' + code.slice(end)
              setCode(newCode)
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 4
              }, 0)
            }
          }}
        />
      )}

      {/* Output */}
      {output && (
        <div className={`border-t ${output.success ? 'border-slate-700' : 'border-red-800'}`}>
          <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900">
            <span className={`text-xs font-mono ${output.success ? 'text-slate-400' : 'text-red-400'}`}>
              {output.success ? 'Output' : 'Error'} — {output.elapsedMs}ms
            </span>
            {expectedOutput && (
              <span className={`text-xs ${outputMatches ? 'text-emerald-400' : 'text-amber-400'}`}>
                {outputMatches ? '✓ Expected output' : '○ Output differs from expected'}
              </span>
            )}
          </div>
          <pre className={`px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${
            output.success ? 'text-emerald-300' : 'text-red-300'
          }`}>
            {output.stdout || output.stderr || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  )
}
