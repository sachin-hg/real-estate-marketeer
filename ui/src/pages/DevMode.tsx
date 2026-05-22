import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { triggerRun, triggerDirectRun, getRunStatus, getRuns } from '../lib/api'
import type { RunStatus } from '../lib/types'

const ALL_PLATFORMS = ['twitter', 'instagram', 'housing_news', 'youtube']
const TABS = ['Research', 'Trends', 'Drafts', 'Posts', 'QA', 'Published'] as const
type TabKey = (typeof TABS)[number]

const TAB_STATE_KEYS: Record<TabKey, string> = {
  Research: 'research',
  Trends: 'trends',
  Drafts: 'creative_drafts',
  Posts: 'platform_posts',
  QA: 'qa_results',
  Published: 'published',
}

function CopyButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs font-medium bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1 hover:bg-slate-200 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy JSON'}
    </button>
  )
}

export default function DevMode() {
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(ALL_PLATFORMS)
  const [runId, setRunId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('Research')

  const runsQ = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
    refetchInterval: 5000,
  })

  const runStatusQ = useQuery<RunStatus>({
    queryKey: ['run-status', runId],
    queryFn: () => getRunStatus(runId!),
    enabled: !!runId,
    refetchInterval: 2000,
  })

  const inspectRunQ = useQuery<Record<string, unknown>>({
    queryKey: ['run-inspect', selectedRunId],
    queryFn: () => getRunStatus(selectedRunId!) as unknown as Promise<Record<string, unknown>>,
    enabled: !!selectedRunId,
  })

  const fullRunMut = useMutation({
    mutationFn: () =>
      triggerRun({ dry_run: true, topic_hint: topic || undefined, target_platforms: platforms }),
    onSuccess: (data) => setRunId(data.run_id),
  })

  const directRunMut = useMutation({
    mutationFn: () =>
      triggerDirectRun(topic || 'housing market update', {
        dry_run: true,
        target_platforms: platforms,
      }),
    onSuccess: (data) => setRunId(data.run_id),
  })

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const runs = runsQ.data ?? []
  const runStatus = runStatusQ.data
  const inspectRun = inspectRunQ.data
  const inspectStateKey = TAB_STATE_KEYS[activeTab]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Run Pipeline */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Run Pipeline</h2>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Topic (optional)
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave empty for auto-research"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    platforms.includes(p)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => fullRunMut.mutate()}
              disabled={fullRunMut.isPending}
              className="flex-1 text-sm font-medium bg-slate-800 text-white rounded-lg px-3 py-2 hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              Full Run (Dry)
            </button>
            <button
              onClick={() => directRunMut.mutate()}
              disabled={directRunMut.isPending || !topic.trim()}
              className="flex-1 text-sm font-medium bg-brand text-white rounded-lg px-3 py-2 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              Direct Run (Dry)
            </button>
          </div>
        </div>

        {/* Run log */}
        {runId && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">Run Log — {runId}</h3>
              {runStatus && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    runStatus.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : runStatus.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {runStatus.status}
                </span>
              )}
            </div>

            {runStatus ? (
              <div className="space-y-1.5">
                {[
                  { label: 'Research items', val: runStatus.research_count },
                  { label: 'Trends found', val: runStatus.trends_count },
                  { label: 'Drafts generated', val: runStatus.drafts_count },
                  { label: 'Posts approved', val: runStatus.posts_approved },
                  { label: 'Published', val: runStatus.published?.length ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                        val > 0 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {val > 0 ? '✓' : '·'}
                    </span>
                    <span className="text-slate-600 flex-1">{label}</span>
                    <span className="font-medium text-slate-800">{val}</span>
                  </div>
                ))}
                {runStatus.error && (
                  <p className="text-xs text-red-500 bg-red-50 rounded p-2 mt-2">
                    {runStatus.error}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">Waiting for run to start...</div>
            )}
          </div>
        )}
      </div>

      {/* Right: Inspector */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Last Run Inspector</h2>

          <select
            value={selectedRunId ?? ''}
            onChange={(e) => setSelectedRunId(e.target.value || null)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
          >
            <option value="">Select a run...</option>
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {r.run_id} — {r.status} ({r.posts_approved} posts)
              </option>
            ))}
          </select>

          {/* Tabs */}
          {selectedRunId && (
            <>
              <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                      activeTab === tab
                        ? 'bg-brand text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {inspectRunQ.isLoading ? (
                <div className="text-slate-400 text-sm">Loading...</div>
              ) : inspectRun ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <CopyButton data={inspectRun[inspectStateKey] ?? null} />
                  </div>
                  <pre className="text-xs font-mono bg-slate-900 text-green-300 rounded-lg p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                    {JSON.stringify(inspectRun[inspectStateKey] ?? null, null, 2)}
                  </pre>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
