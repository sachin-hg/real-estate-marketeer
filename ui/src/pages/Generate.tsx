import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { triggerDirectRun, getRunStatus } from '../lib/api'
import type { RunStatus, Post } from '../lib/types'

const ALL_PLATFORMS = ['twitter', 'instagram', 'housing_news', 'youtube']

const PLATFORM_BADGE: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  instagram: 'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube: 'bg-red-100 text-red-700',
}

const EXAMPLE_TOPICS = [
  "IPL final tonight",
  "Mumbai metro new line opens",
  "https://housing.com/news/real-estate-2025/",
  "Bengaluru home prices Q1 2025",
  "RCB wins cricket world cup",
]

const PROGRESS_STEPS = [
  { key: 'research_count', label: 'Enriching topic & research', field: 'research_count' as const },
  { key: 'trends_count', label: 'Scanning trends', field: 'trends_count' as const },
  { key: 'drafts_count', label: 'Generating creatives', field: 'drafts_count' as const },
  { key: 'posts_approved', label: 'QA & platform posts', field: 'posts_approved' as const },
]

export default function Generate() {
  const [searchParams] = useSearchParams()
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '')
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'instagram', 'housing_news'])
  const [dryRun, setDryRun] = useState(true)
  const [runId, setRunId] = useState<string | null>(null)

  const triggerMut = useMutation({
    mutationFn: () =>
      triggerDirectRun(topic, {
        dry_run: dryRun,
        target_platforms: platforms,
      }),
    onSuccess: (data) => {
      setRunId(data.run_id)
    },
  })

  const { data: runStatus, refetch: refetchStatus } = useQuery<RunStatus>({
    queryKey: ['run-status', runId],
    queryFn: () => getRunStatus(runId!),
    enabled: !!runId,
    refetchInterval: runId ? 2000 : false,
  })

  // Stop polling when done
  useEffect(() => {
    if (runStatus?.status === 'completed' || runStatus?.status === 'failed') {
      void refetchStatus()
    }
  }, [runStatus?.status, refetchStatus])

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const isRunning = runStatus?.status === 'running'
  const isDone = runStatus?.status === 'completed' || runStatus?.status === 'failed'
  const publishedPosts: Post[] = Array.isArray(runStatus?.published) ? (runStatus.published as Post[]) : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input form */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <h2 className="font-semibold text-slate-800">Generate Content</h2>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Topic / URL / Trend
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="e.g. IPL final tonight, or paste a URL..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">
              Target Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    platforms.includes(p)
                      ? PLATFORM_BADGE[p] + ' border-transparent'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {platforms.includes(p) ? '✓ ' : ''}{p}
                </button>
              ))}
            </div>
          </div>

          {/* Dry run toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDryRun((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                dryRun ? 'bg-brand' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  dryRun ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-slate-600">
              Dry Run <span className="text-slate-400 text-xs">(no live publishing)</span>
            </span>
          </div>

          <button
            onClick={() => triggerMut.mutate()}
            disabled={!topic.trim() || platforms.length === 0 || isRunning || triggerMut.isPending}
            className="w-full bg-brand text-white font-medium text-sm rounded-lg px-4 py-2.5 hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {triggerMut.isPending || isRunning ? 'Generating...' : 'Generate'}
          </button>

          {triggerMut.isError && (
            <p className="text-red-500 text-xs">{String(triggerMut.error)}</p>
          )}
        </div>
      </div>

      {/* Right: Results panel */}
      <div className="space-y-4">
        {!runId && !triggerMut.isPending ? (
          /* Empty state */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="font-semibold text-slate-700">Try these topics</h3>
            <div className="space-y-2">
              {EXAMPLE_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="block w-full text-left text-sm text-brand bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-2 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Progress + results */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">
                Run {runId}
              </h3>
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

            {/* Progress steps */}
            <div className="space-y-2">
              {PROGRESS_STEPS.map(({ label, field }, i) => {
                const val = runStatus?.[field] ?? 0
                const isActive = isRunning && i === PROGRESS_STEPS.findIndex(s => runStatus?.[s.field] === 0)
                const isDoneStep = val > 0 || isDone
                return (
                  <div key={field} className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        isDoneStep
                          ? 'bg-green-100 text-green-600'
                          : isActive
                          ? 'bg-blue-100 text-blue-600 animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isDoneStep ? '✓' : i + 1}
                    </div>
                    <span className="text-sm text-slate-600 flex-1">{label}</span>
                    {val > 0 && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        {val}
                      </span>
                    )}
                  </div>
                )
              })}
              {isDone && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs text-white flex-shrink-0">
                    ✓
                  </div>
                  <span className="text-sm font-medium text-green-600">Done!</span>
                </div>
              )}
            </div>

            {/* Error */}
            {runStatus?.error && (
              <p className="text-xs text-red-500 bg-red-50 rounded p-2">
                Error: {runStatus.error}
              </p>
            )}

            {/* Published posts */}
            {isDone && publishedPosts.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-700">
                  {publishedPosts.length} Post{publishedPosts.length !== 1 ? 's' : ''} Generated
                </h4>
                {publishedPosts.map((post: Post, i: number) => (
                  <div
                    key={post.post_id ?? i}
                    className="bg-slate-50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          PLATFORM_BADGE[post.platform] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {post.platform}
                      </span>
                      {post.qa_overall !== undefined && (
                        <span className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                          QA {post.qa_overall.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3">{post.content}</p>
                  </div>
                ))}
              </div>
            )}

            {isDone && publishedPosts.length === 0 && !runStatus?.error && (
              <p className="text-sm text-slate-400">
                No posts were approved for this run.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
