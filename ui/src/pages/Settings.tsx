import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Save, AlertTriangle } from 'lucide-react'
import { getSettings, updateSetting } from '../lib/api'

const REQUIRED_KEYS = ['ANTHROPIC_API_KEY', 'TAVILY_API_KEY']

const SECTION_ORDER = [
  'Required',
  'Trend Research',
  'Social Publishing',
  'Notifications / Bot',
  'Infrastructure',
  'Other',
]

interface SettingRowProps {
  envKey: string
  meta: { value: string; is_set: boolean; desc: string; section: string }
  onSave: (key: string, value: string) => void
  isSaving: boolean
}

function SettingRow({ envKey, meta, onSave, isSaving }: SettingRowProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [showValue, setShowValue] = useState(false)

  const handleEdit = () => {
    setInputVal('')
    setEditing(true)
  }

  const handleSave = () => {
    if (!inputVal.trim()) return
    onSave(envKey, inputVal)
    setEditing(false)
    setInputVal('')
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      {/* Status indicator */}
      <div className="mt-1 flex-shrink-0">
        {meta.is_set ? (
          <span className="text-green-500 text-xs">●</span>
        ) : (
          <span className="text-slate-300 text-xs">○</span>
        )}
      </div>

      {/* Key info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono font-semibold text-slate-700">{envKey}</code>
          {REQUIRED_KEYS.includes(envKey) && !meta.is_set && (
            <span className="text-xs bg-red-100 text-red-600 rounded px-1.5 py-0.5">Required</span>
          )}
        </div>
        {meta.desc && (
          <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>
        )}
        {meta.is_set && !editing && (
          <div className="flex items-center gap-1 mt-1">
            <code className="text-xs text-slate-500">
              {showValue ? meta.value : meta.value.replace(/./g, '·').slice(0, 20)}
            </code>
            <button
              onClick={() => setShowValue((v) => !v)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showValue ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
        )}
        {editing && (
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <input
                type={showValue ? 'text' : 'password'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="New value"
                autoFocus
                className="w-full text-sm border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowValue((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!inputVal.trim() || isSaving}
              className="text-xs font-medium bg-brand text-white rounded-lg px-2.5 py-1.5 hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1 transition-colors"
            >
              <Save size={12} />
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs font-medium bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Edit button */}
      {!editing && (
        <button
          onClick={handleEdit}
          className="text-xs font-medium bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          Edit
        </button>
      )}
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateSetting(key, value),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSavedKey(vars.key)
      setTimeout(() => setSavedKey(null), 3000)
    },
  })

  if (isLoading) {
    return <div className="text-slate-400 text-sm">Loading settings...</div>
  }

  const settingsData = settings ?? {}
  const missingRequired = REQUIRED_KEYS.filter((k) => !settingsData[k]?.is_set)

  // Group by section
  const sections: Record<string, [string, (typeof settingsData)[string]][]> = {}
  for (const section of SECTION_ORDER) {
    sections[section] = []
  }
  for (const [key, meta] of Object.entries(settingsData)) {
    const section = meta.section in sections ? meta.section : 'Other'
    sections[section].push([key, meta])
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Warning banner */}
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Missing required keys</p>
            <p className="text-xs text-amber-600">
              {missingRequired.join(', ')} must be set for the agent to function.
            </p>
          </div>
        </div>
      )}

      {savedKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          Saved <code className="font-mono">{savedKey}</code> successfully.
        </div>
      )}

      {SECTION_ORDER.map((section) => {
        const rows = sections[section]
        if (!rows || rows.length === 0) return null
        return (
          <div key={section} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm">{section}</h2>
            </div>
            <div className="px-5">
              {rows.map(([key, meta]) => (
                <SettingRow
                  key={key}
                  envKey={key}
                  meta={meta}
                  onSave={(k, v) => updateMut.mutate({ key: k, value: v })}
                  isSaving={updateMut.isPending}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
