import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import CalloutBox from './CalloutBox'
import type { ConceptSection } from '../lib/types'

function renderMarkdown(text: string) {
  // Simple inline markdown: **bold**, `code`, newlines
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-slate-800 text-amber-300 px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    return <span key={i}>{part}</span>
  })
}

function ConceptSection({ section }: { section: ConceptSection }) {
  return (
    <div className="mb-6">
      {section.heading && (
        <h3 className="text-lg font-semibold text-white mb-3">{section.heading}</h3>
      )}
      <div className="text-slate-300 text-sm leading-7 space-y-2">
        {section.body.split('\n\n').map((para, i) => (
          <p key={i}>{renderMarkdown(para)}</p>
        ))}
      </div>
      {section.callouts?.map((c, i) => <CalloutBox key={i} callout={c} />)}
      {section.codeExample && (
        <div className="mt-4 rounded-lg overflow-hidden border border-slate-700">
          {section.codeExample.filename && (
            <div className="px-4 py-2 bg-slate-800 text-xs text-slate-400 font-mono border-b border-slate-700">
              {section.codeExample.filename}
            </div>
          )}
          <SyntaxHighlighter
            language={section.codeExample.language}
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem' }}
            showLineNumbers
          >
            {section.codeExample.code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export default function ConceptPanel({ sections }: { sections: ConceptSection[] }) {
  return (
    <div className="space-y-2">
      {sections.map((s, i) => <ConceptSection key={i} section={s} />)}
    </div>
  )
}
