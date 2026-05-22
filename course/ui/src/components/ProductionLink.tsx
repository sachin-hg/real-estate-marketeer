import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { ProductionRef } from '../lib/types'

const GITHUB_BASE = 'https://github.com/housing-dot-com/real-estate-marketeer/blob/main'

interface ProductionLinkProps {
  ref_: ProductionRef
}

export default function ProductionLink({ ref_ }: ProductionLinkProps) {
  const [expanded, setExpanded] = useState(true)

  const githubUrl = `${GITHUB_BASE}/${ref_.file}#L${ref_.startLine}-L${ref_.endLine}`

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wide">In Production</span>
          <span className="text-xs text-slate-400 font-mono">
            {ref_.file}:{ref_.startLine}–{ref_.endLine}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ExternalLink size={12} />
            GitHub
          </a>
          <button onClick={() => setExpanded((v) => !v)} className="text-slate-500 hover:text-slate-300">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && ref_.excerpt && (
        <div className="border-t border-brand/20">
          <SyntaxHighlighter
            language="python"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.76rem', maxHeight: '280px' }}
            showLineNumbers
            startingLineNumber={ref_.startLine}
            wrapLines
            lineProps={(lineNumber) => {
              const ann = ref_.annotations?.find((a) => a.line === lineNumber)
              return ann ? { style: { display: 'block', backgroundColor: 'rgba(124,58,237,0.15)' } } : {}
            }}
          >
            {ref_.excerpt}
          </SyntaxHighlighter>
          {ref_.annotations && ref_.annotations.length > 0 && (
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 space-y-1">
              {ref_.annotations.map((a, i) => (
                <p key={i} className="text-xs text-slate-400">
                  <span className="text-brand-400 font-mono">Line {a.line}:</span> {a.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
