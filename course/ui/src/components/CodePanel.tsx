import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ExternalLink } from 'lucide-react'
import type { CodeExample } from '../lib/types'

interface CodePanelProps {
  example: CodeExample
  colabUrl?: string
  title?: string
}

export default function CodePanel({ example, colabUrl, title }: CodePanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(example.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono">
          {title || example.filename || example.language}
        </span>
        <div className="flex items-center gap-2">
          {colabUrl && (
            <a
              href={colabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink size={12} />
              Open in Colab
            </a>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={example.language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', maxHeight: '520px' }}
        showLineNumbers
        wrapLines
        lineProps={(lineNumber) => {
          const highlighted = example.highlightLines?.includes(lineNumber)
          return highlighted
            ? { style: { display: 'block', backgroundColor: 'rgba(124,58,237,0.2)' } }
            : {}
        }}
      >
        {example.code}
      </SyntaxHighlighter>
    </div>
  )
}
