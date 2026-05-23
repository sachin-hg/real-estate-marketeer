import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { triggerRun, triggerDirectRun, getRunStatus } from '../lib/api'
import type { RunStatus } from '../lib/types'

const ALL_PLATFORMS = ['twitter', 'instagram', 'housing_news', 'youtube', 'linkedin']

const PLATFORM_BADGE: Record<string, { bg: string; text: string }> = {
  twitter:      { bg: 'rgba(14,165,233,0.15)',  text: '#38BDF8' },
  instagram:    { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6' },
  housing_news: { bg: 'rgba(16,185,129,0.15)',  text: '#34d399' },
  youtube:      { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  linkedin:     { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
}

const EXAMPLE_TOPICS = [
  "IPL final tonight",
  "Mumbai metro new line opens",
  "RERA penalty news today",
  "Bengaluru home prices Q1 2025",
  "RCB wins cricket world cup",
]

const PROGRESS_STEPS = [
  { key: 'research_count', label: 'Enriching topic & research', field: 'research_count' as const },
  { key: 'trends_count', label: 'Scanning trends', field: 'trends_count' as const },
  { key: 'drafts_count', label: 'Generating creatives', field: 'drafts_count' as const },
  { key: 'posts_approved', label: 'QA & platform posts', field: 'posts_approved' as const },
]

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
}

export default function Generate() {
  const [searchParams] = useSearchParams()
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '')
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'instagram', 'housing_news'])
  const [dryRun, setDryRun] = useState(true)
  const [runId, setRunId] = useState<string | null>(null)

  // If topic is provided: direct run (enriches the specific topic).
  // If topic is empty: full scheduled run (auto-researches trending topics).
  const triggerMut = useMutation({
    mutationFn: () =>
      topic.trim()
        ? triggerDirectRun(topic.trim(), { dry_run: dryRun, target_platforms: platforms })
        : triggerRun({ dry_run: dryRun, target_platforms: platforms }),
    onSuccess: (data) => setRunId(data.run_id),
  })

  const { data: runStatus } = useQuery<RunStatus>({
    queryKey: ['run-status', runId],
    queryFn: () => getRunStatus(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = (query.state.data as RunStatus | undefined)?.status
      if (!runId || status === 'completed' || status === 'failed') return false
      return 2000
    },
  })

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const isRunning = runStatus?.status === 'running'
  const isDone = runStatus?.status === 'completed' || runStatus?.status === 'failed'
  const publishedPosts = runStatus?.published ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input form */}
      <div className="space-y-4">
        <div style={glassCard} className="p-5 space-y-5">
          <h2 style={{ color: '#f1f5f9', fontWeight: 600 }}>Generate Content</h2>

          {/* Topic */}
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Topic / URL / Trend
              <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 4 }}>(optional — leave empty to auto-research trends)</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="e.g. IPL final tonight, or paste a URL... or leave empty to auto-research"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#f1f5f9',
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Platforms */}
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Target Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const badge = PLATFORM_BADGE[p]
                const active = platforms.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: active ? `1px solid ${badge?.text ?? '#6366F1'}` : '1px solid rgba(255,255,255,0.12)',
                      background: active ? (badge?.bg ?? 'rgba(99,102,241,0.15)') : 'rgba(255,255,255,0.04)',
                      color: active ? (badge?.text ?? '#f1f5f9') : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {active ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dry run toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDryRun((v) => !v)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: 20,
                width: 36,
                alignItems: 'center',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: dryRun ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'rgba(255,255,255,0.12)',
                transition: 'background 0.2s',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  transform: dryRun ? 'translateX(18px)' : 'translateX(3px)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>
              Dry Run <span style={{ color: '#64748b', fontSize: 12 }}>(no live publishing)</span>
            </span>
          </div>

          <button
            onClick={() => triggerMut.mutate()}
            disabled={platforms.length === 0 || isRunning || triggerMut.isPending}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg,#8B5CF6,#6366F1)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              borderRadius: 10,
              padding: '10px 16px',
              border: 'none',
              cursor: platforms.length === 0 || isRunning || triggerMut.isPending ? 'not-allowed' : 'pointer',
              opacity: platforms.length === 0 || isRunning || triggerMut.isPending ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {triggerMut.isPending || isRunning
              ? 'Generating...'
              : topic.trim() ? 'Generate from Topic' : 'Auto-Research & Generate'}
          </button>

          {triggerMut.isError && (
            <p style={{ color: '#f87171', fontSize: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px' }}>
              {String(triggerMut.error)}
            </p>
          )}
        </div>
      </div>

      {/* Right: Results panel */}
      <div className="space-y-4">
        {!runId && !triggerMut.isPending ? (
          /* Empty state */
          <div style={glassCard} className="p-6 space-y-3">
            <h3 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>Try these topics</h3>
            <div className="space-y-2">
              {EXAMPLE_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: 14,
                    color: '#a78bfa',
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Progress + results */
          <div style={glassCard} className="p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 style={{ color: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                {runId}
              </h3>
              {runStatus && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: runStatus.status === 'completed'
                      ? 'rgba(16,185,129,0.15)'
                      : runStatus.status === 'failed'
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(59,130,246,0.15)',
                    color: runStatus.status === 'completed'
                      ? '#34d399'
                      : runStatus.status === 'failed'
                      ? '#f87171'
                      : '#60a5fa',
                  }}
                >
                  {runStatus.status}
                </span>
              )}
              {runId && (
                <Link
                  to={`/dashboard/runs/${runId}`}
                  style={{ marginLeft: 'auto', fontSize: 12, color: '#818CF8', flexShrink: 0, textDecoration: 'none' }}
                >
                  View full run →
                </Link>
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
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        flexShrink: 0,
                        background: isDoneStep
                          ? 'rgba(16,185,129,0.15)'
                          : isActive
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(255,255,255,0.06)',
                        color: isDoneStep
                          ? '#34d399'
                          : isActive
                          ? '#60a5fa'
                          : '#64748b',
                      }}
                      className={isActive ? 'animate-pulse' : ''}
                    >
                      {isDoneStep ? '✓' : i + 1}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 14, flex: 1 }}>{label}</span>
                    {val > 0 && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: '#f1f5f9',
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        padding: '2px 6px',
                      }}>
                        {val}
                      </span>
                    )}
                  </div>
                )
              })}
              {isDone && (
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#34d399', flexShrink: 0,
                  }}>✓</div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#34d399' }}>Done!</span>
                </div>
              )}
            </div>

            {/* Error */}
            {runStatus?.error && (
              <p style={{
                fontSize: 12, color: '#f87171',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                Error: {runStatus.error}
              </p>
            )}

            {/* Published posts */}
            {isDone && publishedPosts.length > 0 && (
              <div className="space-y-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  {publishedPosts.length} Post{publishedPosts.length !== 1 ? 's' : ''} Generated
                </h4>
                {publishedPosts.map((post, i) => {
                  const badge = PLATFORM_BADGE[post.platform ?? '']
                  return (
                    <Link
                      key={post.post_id ?? i}
                      to={post.post_id ? `/posts/${post.post_id}` : '#'}
                      className="block group"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 10,
                        padding: 12,
                        textDecoration: 'none',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div className="flex gap-2 items-center mb-2">
                        <span style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: badge?.bg ?? 'rgba(255,255,255,0.08)',
                          color: badge?.text ?? '#94a3b8',
                        }}>
                          {post.platform}
                        </span>
                        {post.qa_overall !== undefined && (
                          <span style={{
                            fontSize: 11,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            color: '#94a3b8',
                          }}>
                            QA {post.qa_overall.toFixed(1)}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#818CF8' }}>View →</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {post.content}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}

            {isDone && publishedPosts.length === 0 && !runStatus?.error && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10,
                padding: 12,
                color: '#fbbf24',
                fontSize: 14,
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No posts published for this run.</p>
                {(runStatus?.platform_posts_count ?? 0) > 0 && (
                  <p style={{ fontSize: 12, color: '#d97706', marginBottom: 4 }}>
                    {runStatus!.platform_posts_count} platform post{runStatus!.platform_posts_count !== 1 ? 's' : ''} were generated but rejected by QA.
                  </p>
                )}
                {runId && (
                  <Link to={`/dashboard/runs/${runId}`} style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none', display: 'block' }}>
                    View QA details in run log →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
