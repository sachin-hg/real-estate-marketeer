import { Lightbulb, AlertTriangle, Zap, Info } from 'lucide-react'
import type { CalloutItem } from '../lib/types'

const CONFIG = {
  insight: { icon: Lightbulb, bg: 'bg-blue-950/60', border: 'border-blue-700', title: 'text-blue-300', icon_color: 'text-blue-400', label: 'Key Insight' },
  mistake: { icon: AlertTriangle, bg: 'bg-red-950/60', border: 'border-red-700', title: 'text-red-300', icon_color: 'text-red-400', label: 'Common Mistake' },
  tip:     { icon: Zap, bg: 'bg-amber-950/60', border: 'border-amber-700', title: 'text-amber-300', icon_color: 'text-amber-400', label: 'Pro Tip' },
  warning: { icon: Info, bg: 'bg-yellow-950/60', border: 'border-yellow-700', title: 'text-yellow-300', icon_color: 'text-yellow-400', label: 'Warning' },
}

export default function CalloutBox({ callout }: { callout: CalloutItem }) {
  const cfg = CONFIG[callout.type]
  const Icon = cfg.icon
  return (
    <div className={`rounded-lg border ${cfg.bg} ${cfg.border} p-4 my-4`}>
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${cfg.icon_color} mt-0.5 flex-shrink-0`} />
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.title} mb-1`}>
            {callout.title || cfg.label}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{callout.body}</p>
        </div>
      </div>
    </div>
  )
}
