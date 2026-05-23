import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRunDetail, getPosts, getRunCalls } from '../lib/api'
import type { Post, RunResearchItem, RunTrendItem, RunBrief, RunDraft, RunApiCall, RunLlmCall } from '../lib/types'

const LEVEL_COLOR: Record<string, string> = {
  DEBUG:    '#64748b',
  INFO:     '#34d399',
  WARNING:  '#fbbf24',
  ERROR:    '#f87171',
  CRITICAL: '#ef4444',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  running:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  completed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  failed:    { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  twitter:      { bg: 'rgba(14,165,233,0.15)',  color: '#38BDF8' },
  instagram:    { bg: 'rgba(236,72,153,0.15)',  color: '#f472b6' },
  housing_news: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  youtube:      { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
  linkedin:     { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  overflow: 'hidden',
}

function CollapsibleSection({ title, count, badge, defaultOpen = false, children }: {
  title: string; count: number; badge?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={glassCard}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          <span style={{
            fontSize: 11, fontWeight: 400, color: '#64748b',
            background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '2px 8px',
          }}>{count}</span>
          {badge && <span style={{
            fontSize: 11, fontWeight: 500, color: '#fbbf24',
            background: 'rgba(245,158,11,0.1)', borderRadius: 999, padding: '2px 8px',
          }}>{badge}</span>}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ value }: { value?: number | null }) {
  if (value == null) return null
  const pct = Math.min(100, (value / 10) * 100)
  const color = value >= 7 ? '#34d399' : value >= 5 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: color, width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(1)}</span>
    </div>
  )
}

function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate()
  const isApproved = post.qa_decision === 'publish' || post.post_status === 'published'
  const isDraft = post.post_status === 'draft'
  const isDryRun = post.published_url === 'dry_run' || !post.published_url
  const badge = PLATFORM_BADGE[post.platform]

  return (
    <div
      onClick={() => navigate(`/dashboard/posts/${post.post_id}`)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.4)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(139,92,246,0.04)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.09)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
          background: badge?.bg ?? 'rgba(255,255,255,0.08)',
          color: badge?.color ?? '#94a3b8',
        }}>{post.platform}</span>
        {post.draft_type && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
            background: post.draft_type === 'social' ? 'rgba(139,92,246,0.15)' : 'rgba(20,184,166,0.15)',
            color: post.draft_type === 'social' ? '#a78bfa' : '#2dd4bf',
          }}>{post.draft_type}</span>
        )}
        {isDraft ? (
          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>⏳ Draft</span>
        ) : isApproved ? (
          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✓ QA Pass</span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>✕ QA Fail</span>
        )}
        {isDryRun && !isDraft && (
          <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '2px 8px' }}>dry run</span>
        )}
        {post.trend_hashtag && (
          <span style={{ fontSize: 12, color: '#818CF8', marginLeft: 'auto' }}>{post.trend_hashtag}</span>
        )}
      </div>

      <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: 12 }}>
        {post.content}
      </p>

      <div style={{ marginBottom: post.pred_engagement_rate != null ? 8 : 0 }}>
        {post.qa_overall != null && (
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 11, color: '#64748b', width: 80, flexShrink: 0 }}>QA Overall</span>
            <ScoreBar value={post.qa_overall} />
          </div>
        )}
        {post.qa_re_relevance != null && (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: '#64748b', width: 80, flexShrink: 0 }}>RE Relevance</span>
            <ScoreBar value={post.qa_re_relevance} />
          </div>
        )}
      </div>

      {post.pred_engagement_rate != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#64748b',
        }}>
          <span>ER <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{(post.pred_engagement_rate * 100).toFixed(1)}%</span></span>
          {post.pred_impressions != null && (
            <span>Impr <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
              {post.pred_impressions >= 1000 ? `${(post.pred_impressions / 1000).toFixed(1)}K` : post.pred_impressions}
            </span></span>
          )}
          {post.pred_likes != null && (
            <span>Likes <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{post.pred_likes}</span></span>
          )}
          {post.pred_confidence != null && (
            <span style={{ marginLeft: 'auto', color: '#64748b' }}>{(post.pred_confidence * 100).toFixed(0)}% conf</span>
          )}
        </div>
      )}

      {!isApproved && !isDraft && post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
        <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '6px 10px', marginTop: 8 }}>
          {post.qa_rejection_reasons.slice(0, 2).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#818CF8', textAlign: 'right', marginTop: 8 }}>View details →</div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{
        fontSize: 11,
        color: copied ? '#34d399' : '#64748b',
        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.06)',
        border: 'none',
        borderRadius: 4,
        padding: '2px 6px',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}

function PromptBlock({ label, text, defaultOpen = false }: { label: string; text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!text) return null
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px', fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{text.length.toLocaleString()} chars</span>
          {open && <CopyButton text={text} />}
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <pre style={{
          padding: '8px 12px', fontSize: 11, color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.07)',
          maxHeight: 320, overflowY: 'auto', margin: 0,
        }}>{text}</pre>
      )}
    </div>
  )
}

function ApiCallRow({ call }: { call: RunApiCall }) {
  const [open, setOpen] = useState(false)
  const isErr = call.status !== 'ok'
  const costStr = call.estimated_cost_usd > 0 ? `~$${call.estimated_cost_usd.toFixed(4)}` : 'free'
  return (
    <div style={{ padding: '10px 16px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0, color: isErr ? '#f87171' : '#34d399' }}>
          {isErr ? '✕' : '✓'}
        </span>
        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
          {call.agent}
        </span>
        <span style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', flexShrink: 0 }}>{call.api_name}</span>
        <span style={{ color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.use_case || call.endpoint}</span>
        <span style={{ flexShrink: 0, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{call.result_count ?? 0} results</span>
        <span style={{ flexShrink: 0, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{call.elapsed_ms}ms</span>
        <span style={{ flexShrink: 0, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: call.estimated_cost_usd > 0 ? '#fbbf24' : '#64748b' }}>{costStr}</span>
        <span style={{ color: '#64748b', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12, marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', color: '#94a3b8', fontSize: 11 }}>
            <span><span style={{ color: '#64748b' }}>Endpoint:</span> <span style={{ fontFamily: 'monospace', color: '#cbd5e1', wordBreak: 'break-all' }}>{call.endpoint}</span></span>
            {call.http_status && <span><span style={{ color: '#64748b' }}>HTTP:</span> {call.http_status}</span>}
            {call.called_at && <span><span style={{ color: '#64748b' }}>At:</span> {new Date(call.called_at).toLocaleTimeString('en-IN', { hour12: false })}</span>}
          </div>

          {call.params && Object.keys(call.params).length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#64748b', fontWeight: 500, fontSize: 11 }}>Request Params</span>
                <CopyButton text={JSON.stringify(call.params, null, 2)} />
              </div>
              <pre style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 8, fontSize: 11, overflowX: 'auto', maxHeight: 192, color: '#cbd5e1', margin: 0 }}>{JSON.stringify(call.params, null, 2)}</pre>
            </div>
          )}

          {call.response_preview != null && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#64748b', fontWeight: 500, fontSize: 11 }}>
                  Response {call.total_response_items > 5 ? `(first 5 of ${call.total_response_items} items)` : ''}
                </span>
                <CopyButton text={JSON.stringify(call.response_preview, null, 2)} />
              </div>
              <pre style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 6, padding: 8, fontSize: 11, overflowX: 'auto', maxHeight: 256, color: '#34d399', margin: 0 }}>{JSON.stringify(call.response_preview, null, 2)}</pre>
            </div>
          )}

          {isErr && call.error && (
            <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 8, fontSize: 11 }}>
              <span style={{ fontWeight: 600 }}>Error: </span>{call.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LlmCallRow({ call, isRetry }: { call: RunLlmCall; isRetry?: boolean }) {
  const [open, setOpen] = useState(false)
  const costStr = call.cost_usd ? `$${call.cost_usd.toFixed(4)}` : ''
  const tokens = call.input_tokens != null
    ? `${call.input_tokens.toLocaleString()} in · ${(call.output_tokens ?? 0).toLocaleString()} out`
    : ''
  const shortModel = (call.model || '').replace('claude-', '').replace('-20251001', '').replace('gemini-', '')
  const isQaRevision = call.agent.includes('/revision/')
  const agentStyle = isQaRevision
    ? { background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }
    : isRetry
    ? { background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.2)' }
    : { background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: isRetry ? '2px solid rgba(249,115,22,0.5)' : 'none', marginLeft: isRetry ? 8 : 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'none', border: 'none', cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        {isRetry && <span style={{ color: '#fb923c', flexShrink: 0, fontFamily: 'monospace', fontSize: 10 }}>↩ retry</span>}
        {isQaRevision && <span style={{ color: '#fbbf24', flexShrink: 0, fontFamily: 'monospace', fontSize: 10 }}>✏ revise</span>}
        <span style={{ ...agentStyle, borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', flexShrink: 0, fontSize: 10 }}>{shortModel}</span>
        <span style={{ color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.agent}</span>
        {tokens && <span style={{ color: '#64748b', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{tokens}</span>}
        {costStr && <span style={{ fontWeight: 600, color: '#a78bfa', flexShrink: 0 }}>{costStr}</span>}
        <span style={{ color: '#64748b', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{call.elapsed_ms}ms</span>
        <span style={{ color: '#64748b', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: '#94a3b8' }}>
            {call.stop_reason && <span><span style={{ color: '#64748b' }}>Stop:</span> {call.stop_reason}</span>}
            {call.called_at && <span><span style={{ color: '#64748b' }}>At:</span> {new Date(call.called_at).toLocaleTimeString('en-IN', { hour12: false })}</span>}
            {call.attempt > 1 && <span style={{ color: '#fb923c', fontWeight: 500 }}>Attempt #{call.attempt}</span>}
          </div>
          <PromptBlock label="System Prompt" text={call.system_prompt} />
          <PromptBlock label="User Message" text={call.user_message} defaultOpen />
          <PromptBlock label="Response" text={call.response_text} defaultOpen />
        </div>
      )}
    </div>
  )
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-IN', { hour12: false })
}

const STEPS = [
  { label: 'Research',       field: 'research_count' as const },
  { label: 'Trends',         field: 'trends_count' as const },
  { label: 'Briefs',         field: 'briefs_count' as const },
  { label: 'Drafts',         field: 'drafts_count' as const },
  { label: 'Platform Posts', field: 'platform_posts_count' as const },
  { label: 'Approved',       field: 'posts_approved' as const },
]

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>()
  const logRef = useRef<HTMLDivElement>(null)
  const [logOpen, setLogOpen] = useState(false)

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ['run-detail', runId],
    queryFn: () => getRunDetail(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status
      if (!runId || status === 'completed' || status === 'failed') return false
      return 1500
    },
  })

  const postsQ = useQuery({
    queryKey: ['run-posts', runId],
    queryFn: () => getPosts({ run_id: runId!, limit: 100 }),
    enabled: !!runId,
    refetchInterval: run?.status === 'running' ? 5000 : false,
  })
  const dbPosts: Post[] = postsQ.data?.items ?? []

  const callsQ = useQuery({
    queryKey: ['run-calls', runId],
    queryFn: () => getRunCalls(runId!),
    enabled: !!runId && run?.status !== 'running',
  })

  useEffect(() => {
    if (run?.status === 'running') setLogOpen(true)
  }, [run?.status])

  useEffect(() => {
    if (logOpen && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logOpen, run?.events?.length])

  if (isLoading) return <div style={{ color: '#64748b', fontSize: 14, padding: 24 }}>Loading run...</div>
  if (isError || !run) {
    return (
      <div style={{ color: '#f87171', fontSize: 14, padding: 24 }}>
        Run not found. It may have been evicted from memory (server restart).{' '}
        <Link to="/dashboard" style={{ color: '#818CF8' }}>Back to dashboard</Link>
      </div>
    )
  }

  const isRunning = run.status === 'running'
  const st = STATUS_STYLE[run.status]

  const approvedPosts = dbPosts.filter((p) => p.post_status === 'published' || p.qa_decision === 'publish')
  const draftPosts    = dbPosts.filter((p) => p.post_status === 'draft')
  const rejectedPosts = dbPosts.filter((p) =>
    p.post_status === 'qa_rejected' || (p.qa_decision === 'reject' && p.post_status !== 'published' && p.post_status !== 'draft')
  )

  const hasPipelineData = (run.research?.length ?? 0) > 0 || (run.trends?.length ?? 0) > 0
    || (run.content_briefs?.length ?? 0) > 0 || (run.creative_drafts?.length ?? 0) > 0

  const calls = callsQ.data
  const totalLlmCost = calls?.total_llm_cost_usd ?? calls?.llm_calls?.reduce((s, c) => s + (c.cost_usd ?? 0), 0) ?? 0
  const totalApiCost = calls?.total_api_cost_usd ?? 0
  const totalCost = totalLlmCost + totalApiCost

  const _agentCount: Record<string, number> = {}
  const llmCallsWithRetry = (calls?.llm_calls ?? []).map(c => {
    _agentCount[c.agent] = (_agentCount[c.agent] ?? 0) + 1
    return { ...c, _seenCount: _agentCount[c.agent] }
  })
  const _agentTotal: Record<string, number> = {}
  for (const c of calls?.llm_calls ?? []) _agentTotal[c.agent] = (_agentTotal[c.agent] ?? 0) + 1

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Header */}
      <div style={{ ...glassCard, overflow: 'visible', padding: 20 }} className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/dashboard" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>← Dashboard</Link>
          <h2 style={{ fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace', marginTop: 4, fontSize: 15 }}>{run.run_id}</h2>
          {run.topic_hint && (
            <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>"{run.topic_hint}"</p>
          )}
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {run.triggered_at
              ? new Date(run.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : ''}{' '}
            {run.triggered_at && <span style={{ color: '#334155' }}>·</span>}{' '}
            {timeAgo(run.triggered_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {run.dry_run && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#64748b', borderRadius: 999, padding: '2px 8px' }}>dry run</span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 999,
            background: st?.bg ?? 'rgba(255,255,255,0.08)',
            color: st?.color ?? '#94a3b8',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {isRunning && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', animation: 'pulse 2s infinite' }} />}
            {run.status}
          </span>
        </div>
      </div>

      {/* Pipeline progress */}
      <div style={{ ...glassCard, overflow: 'visible', padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Pipeline Progress</h3>
        <div className="flex flex-wrap gap-3">
          {STEPS.map(({ label, field }) => {
            const val = run[field] ?? 0
            const done = val > 0
            return (
              <div key={field} style={{
                display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '8px 12px', fontSize: 13,
                background: done
                  ? 'rgba(16,185,129,0.1)'
                  : isRunning
                  ? 'rgba(59,130,246,0.1)'
                  : 'rgba(255,255,255,0.04)',
                border: done
                  ? '1px solid rgba(16,185,129,0.25)'
                  : isRunning
                  ? '1px solid rgba(59,130,246,0.25)'
                  : '1px solid rgba(255,255,255,0.07)',
                color: done ? '#34d399' : isRunning ? '#60a5fa' : '#64748b',
              }} className={!done && isRunning ? 'animate-pulse' : ''}>
                <span style={{ fontWeight: 600 }}>{done ? val : '—'}</span>
                <span>{label}</span>
              </div>
            )
          })}
          {totalLlmCost > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
              <span style={{ fontWeight: 600 }}>${totalLlmCost.toFixed(3)}</span>
              <span>LLM Cost</span>
            </div>
          )}
          {totalApiCost > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
              <span style={{ fontWeight: 600 }}>~${totalApiCost.toFixed(3)}</span>
              <span>API Cost</span>
            </div>
          )}
          {totalCost > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}>
              <span style={{ fontWeight: 600 }}>${totalCost.toFixed(3)}</span>
              <span>Total Cost</span>
            </div>
          )}
        </div>
      </div>

      {/* Posts from this run */}
      {(dbPosts.length > 0 || isRunning) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
              Posts Generated
              {dbPosts.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#64748b', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '2px 8px' }}>
                  {dbPosts.length}
                </span>
              )}
            </h3>
            {postsQ.isFetching && (
              <span style={{ fontSize: 12, color: '#64748b' }} className="animate-pulse">refreshing…</span>
            )}
          </div>

          {postsQ.isLoading ? (
            <div style={{ color: '#64748b', fontSize: 14 }}>Loading posts…</div>
          ) : dbPosts.length === 0 && isRunning ? (
            <div style={{ color: '#64748b', fontSize: 14 }} className="animate-pulse">Waiting for posts…</div>
          ) : (
            <div className="space-y-4">
              {approvedPosts.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✓ Approved / Published — {approvedPosts.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {approvedPosts.map((p) => <PostCard key={p.post_id} post={p} />)}
                  </div>
                </div>
              )}

              {draftPosts.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ⏳ Pending Human Review — {draftPosts.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {draftPosts.map((p) => <PostCard key={p.post_id} post={p} />)}
                  </div>
                </div>
              )}

              {rejectedPosts.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✕ QA Rejected — {rejectedPosts.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rejectedPosts.map((p) => <PostCard key={p.post_id} post={p} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pipeline detail */}
      {hasPipelineData && (
        <div className="space-y-2">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Pipeline Inputs</h3>

          {(run.research?.length ?? 0) > 0 && (
            <CollapsibleSection title="Research Items" count={run.research!.length}>
              {(run.research as RunResearchItem[]).map((item, i) => (
                <div key={i} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="last:border-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', lineHeight: 1.4 }}>{item.headline}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 12, color: '#818CF8', flexShrink: 0, textDecoration: 'none' }}>↗</a>
                    )}
                  </div>
                  {item.source && <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{item.source}</p>}
                  {item.summary && <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 4 }}>{item.summary}</p>}
                  {item.relevance && (
                    <p style={{ fontSize: 12, color: '#34d399', background: 'rgba(16,185,129,0.08)', borderRadius: 6, padding: '6px 8px' }}>
                      <span style={{ fontWeight: 500 }}>Why relevant: </span>{item.relevance}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {(run.trends?.length ?? 0) > 0 && (
            <CollapsibleSection title="Trend Signals" count={run.trends!.length}>
              {(run.trends as RunTrendItem[]).map((t, i) => (
                <div key={i} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="last:border-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#818CF8' }}>{t.hashtag}</span>
                    <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' }}>{t.platform}</span>
                    {t.volume && <span style={{ fontSize: 12, color: '#64748b' }}>vol: {t.volume}</span>}
                    {t.city_hint && <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 999, padding: '2px 8px' }}>{t.city_hint}</span>}
                  </div>
                  {t.context && <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t.context}</p>}
                  {t.creative_hook && (
                    <p style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '6px 8px', fontStyle: 'italic' }}>
                      Hook: "{t.creative_hook}"
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {(run.content_briefs?.length ?? 0) > 0 && (
            <CollapsibleSection title="Content Briefs (Planner Output)" count={run.content_briefs!.length}
              badge={`from ${run.research?.length ?? 0} research + ${run.trends?.length ?? 0} trends`}
            >
              {(run.content_briefs as RunBrief[]).map((b, i) => (
                <div key={i} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="last:border-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                      background: b.draft_type === 'social' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)',
                      color: b.draft_type === 'social' ? '#a78bfa' : '#34d399',
                    }}>{b.draft_type}</span>
                    {b.tone && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 999, padding: '2px 8px' }}>{b.tone}</span>}
                    {b.target_platforms?.map((p) => (
                      <span key={p} style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 999, padding: '2px 6px' }}>{p}</span>
                    ))}
                    {b.city_hint && <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', borderRadius: 999, padding: '2px 6px' }}>{b.city_hint}</span>}
                  </div>
                  {b.topic && (
                    <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, borderLeft: '2px solid rgba(255,255,255,0.12)', paddingLeft: 8, marginBottom: 4 }}>
                      {b.topic}
                    </p>
                  )}
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>{b.angle}</p>
                  {b.source_summary && (
                    <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 4 }}>{b.source_summary}</p>
                  )}
                  {b.urgency && (
                    <p style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '6px 8px', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>Urgency: </span>{b.urgency}
                    </p>
                  )}
                  {b.seo_keywords?.length > 0 && (
                    <p style={{ fontSize: 12, color: '#64748b' }}>SEO: {b.seo_keywords.join(', ')}</p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {(run.creative_drafts?.length ?? 0) > 0 && (
            <CollapsibleSection title="Creative Drafts" count={run.creative_drafts!.length}>
              {(run.creative_drafts as RunDraft[]).map((d, i) => (
                <div key={i} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="last:border-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                      background: d.draft_type === 'social' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)',
                      color: d.draft_type === 'social' ? '#a78bfa' : '#34d399',
                    }}>{d.draft_type}</span>
                    {d.media_format && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 999, padding: '2px 8px' }}>{d.media_format}</span>}
                    {d.target_platforms.map((p) => (
                      <span key={p} style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 999, padding: '2px 6px' }}>{p}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', marginBottom: 2 }}>{d.angle || d.headline}</p>
                  {d.hook && <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 2 }}>"{d.hook}"</p>}
                  {d.trend_hashtag && <p style={{ fontSize: 12, color: '#818CF8', marginBottom: 2 }}>{d.trend_hashtag}</p>}
                  {d.hashtags?.length > 0 && (
                    <p style={{ fontSize: 12, color: '#64748b' }}>
                      {d.hashtags.slice(0, 6).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* API + LLM Calls */}
      {calls && (calls.total_api_calls > 0 || calls.total_llm_calls > 0) && (
        <div className="space-y-2">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>External Calls</h3>

          {calls.api_calls.length > 0 && (
            <CollapsibleSection
              title="API Calls"
              count={calls.total_api_calls}
              badge={`${calls.api_calls.filter(c => c.status !== 'ok').length} errors`}
            >
              {calls.api_calls.map((c, i) => <ApiCallRow key={i} call={c} />)}
            </CollapsibleSection>
          )}

          {calls.llm_calls.length > 0 && (
            <CollapsibleSection
              title="LLM Calls"
              count={calls.total_llm_calls}
              badge={totalLlmCost > 0 ? `$${totalLlmCost.toFixed(4)} total` : undefined}
            >
              {llmCallsWithRetry.map((c, i) => {
                const { _seenCount, ...callData } = c
                return <LlmCallRow key={i} call={callData as RunLlmCall} isRetry={_agentTotal[c.agent] > 1 && _seenCount > 1} />
              })}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 16, fontSize: 14, color: '#f87171' }}>
          <span style={{ fontWeight: 600 }}>Error: </span>{run.error}
        </div>
      )}

      {/* Event log */}
      <div style={{ background: '#090918', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        <button
          onClick={() => setLogOpen((v) => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
            Run Log
            {isRunning && <span style={{ color: '#60a5fa' }} className="animate-pulse">● live</span>}
            {!isRunning && (run.events?.length ?? 0) > 0 && (
              <span style={{ color: '#64748b', fontSize: 11 }}>(reconstructed from DB)</span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{run.events?.length ?? 0} events</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{logOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {logOpen && (
          <div
            ref={logRef}
            style={{ height: 384, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, padding: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            {!run.events?.length ? (
              <span style={{ color: '#334155' }}>No events captured for this run.</span>
            ) : (
              run.events.map((ev, i) => {
                const shortLogger = (ev.logger ?? '').replace(/^agents\.|^tools\.|^workflow\.|^scheduler\./, '')
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, lineHeight: '20px', padding: '0 4px', borderRadius: 4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: '#475569', flexShrink: 0, width: 80 }}>{formatTs(ev.ts)}</span>
                    <span style={{ flexShrink: 0, width: 64, fontWeight: 700, color: LEVEL_COLOR[ev.level] ?? '#64748b' }}>
                      {ev.level}
                    </span>
                    <span style={{ color: '#475569', flexShrink: 0, width: 144, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.logger}>{shortLogger}</span>
                    <span style={{ color: '#cbd5e1', wordBreak: 'break-word', minWidth: 0 }}>{ev.msg}</span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
