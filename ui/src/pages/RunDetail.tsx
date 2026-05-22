import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRunDetail, getPosts, getRunCalls } from '../lib/api'
import type { Post, RunResearchItem, RunTrendItem, RunBrief, RunDraft, RunApiCall, RunLlmCall } from '../lib/types'

const LEVEL_COLOR: Record<string, string> = {
  DEBUG:    'text-slate-500',
  INFO:     'text-emerald-400',
  WARNING:  'text-amber-400',
  ERROR:    'text-red-400',
  CRITICAL: 'text-red-600',
}

const STATUS_COLORS: Record<string, string> = {
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
}

const PLATFORM_BADGE: Record<string, string> = {
  twitter:      'bg-sky-100 text-sky-700',
  instagram:    'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube:      'bg-red-100 text-red-700',
  linkedin:     'bg-blue-100 text-blue-700',
}

function CollapsibleSection({ title, count, badge, defaultOpen = false, children }: {
  title: string; count: number; badge?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{count}</span>
          {badge && <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">{badge}</span>}
        </span>
        <span className="text-xs text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-slate-100 divide-y divide-slate-100">{children}</div>}
    </div>
  )
}

function ScoreBar({ value }: { value?: number | null }) {
  if (value == null) return null
  const pct = Math.min(100, (value / 10) * 100)
  const color = value >= 7 ? 'bg-green-400' : value >= 5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}

function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate()
  const isApproved = post.qa_decision === 'publish' || post.post_status === 'published'
  const isDraft = post.post_status === 'draft'
  const isDryRun = post.published_url === 'dry_run' || !post.published_url

  return (
    <div
      onClick={() => navigate(`/posts/${post.post_id}`)}
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_BADGE[post.platform] ?? 'bg-slate-100 text-slate-600'}`}>
          {post.platform}
        </span>
        {post.draft_type && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            post.draft_type === 'social' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
          }`}>{post.draft_type}</span>
        )}
        {isDraft ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Draft</span>
        ) : isApproved ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ QA Pass</span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">✕ QA Fail</span>
        )}
        {isDryRun && !isDraft && (
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">dry run</span>
        )}
        {post.trend_hashtag && (
          <span className="text-xs text-brand ml-auto">{post.trend_hashtag}</span>
        )}
      </div>

      <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">{post.content}</p>

      <div className="space-y-1.5">
        {post.qa_overall != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-20 flex-shrink-0">QA Overall</span>
            <ScoreBar value={post.qa_overall} />
          </div>
        )}
        {post.qa_re_relevance != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-20 flex-shrink-0">RE Relevance</span>
            <ScoreBar value={post.qa_re_relevance} />
          </div>
        )}
      </div>

      {post.pred_engagement_rate != null && (
        <div className="flex items-center gap-3 pt-1 border-t border-slate-100 text-xs text-slate-500">
          <span>ER <span className="font-semibold text-slate-700">{(post.pred_engagement_rate * 100).toFixed(1)}%</span></span>
          {post.pred_impressions != null && (
            <span>Impr <span className="font-semibold text-slate-700">
              {post.pred_impressions >= 1000 ? `${(post.pred_impressions / 1000).toFixed(1)}K` : post.pred_impressions}
            </span></span>
          )}
          {post.pred_likes != null && (
            <span>Likes <span className="font-semibold text-slate-700">{post.pred_likes}</span></span>
          )}
          {post.pred_confidence != null && (
            <span className="ml-auto text-slate-400">{(post.pred_confidence * 100).toFixed(0)}% conf</span>
          )}
        </div>
      )}

      {!isApproved && !isDraft && post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 space-y-0.5">
          {post.qa_rejection_reasons.slice(0, 2).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      <div className="text-xs text-brand hover:underline text-right">View details →</div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}

function PromptBlock({ label, text, defaultOpen = false }: { label: string; text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!text) return null
  return (
    <div className="border border-slate-100 rounded">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
      >
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 tabular-nums">{text.length.toLocaleString()} chars</span>
          {open && <CopyButton text={text} />}
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <pre className="px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-50 border-t border-slate-100 max-h-80 overflow-y-auto">{text}</pre>
      )}
    </div>
  )
}

function ApiCallRow({ call }: { call: RunApiCall }) {
  const [open, setOpen] = useState(false)
  const isErr = call.status !== 'ok'
  const costStr = call.estimated_cost_usd > 0 ? `~$${call.estimated_cost_usd.toFixed(4)}` : 'free'
  return (
    <div className="px-4 py-2.5 text-xs border-b border-slate-50 last:border-0">
      <button onClick={() => setOpen(v => !v)} className="w-full text-left flex items-center gap-2 flex-wrap">
        <span className={`font-mono font-bold shrink-0 ${isErr ? 'text-red-600' : 'text-emerald-600'}`}>
          {isErr ? '✕' : '✓'}
        </span>
        {/* Agent tag — who triggered the call */}
        <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-mono shrink-0 text-[10px]">
          {call.agent}
        </span>
        <span className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 font-mono shrink-0">{call.api_name}</span>
        <span className="text-slate-600 truncate flex-1">{call.use_case || call.endpoint}</span>
        <span className="shrink-0 text-slate-400 tabular-nums">{call.result_count ?? 0} results</span>
        <span className="shrink-0 text-slate-400 tabular-nums">{call.elapsed_ms}ms</span>
        <span className={`shrink-0 font-mono tabular-nums ${call.estimated_cost_usd > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{costStr}</span>
        <span className="text-slate-400 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 ml-2 space-y-2.5">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
            <span><span className="text-slate-400">Endpoint:</span> <span className="font-mono text-slate-600 break-all">{call.endpoint}</span></span>
            {call.http_status && <span><span className="text-slate-400">HTTP:</span> {call.http_status}</span>}
            {call.called_at && <span><span className="text-slate-400">At:</span> {new Date(call.called_at).toLocaleTimeString('en-IN', { hour12: false })}</span>}
          </div>

          {/* Request params */}
          {call.params && Object.keys(call.params).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-400 font-medium">Request Params</span>
                <CopyButton text={JSON.stringify(call.params, null, 2)} />
              </div>
              <pre className="bg-slate-50 border border-slate-100 rounded p-2 text-xs overflow-x-auto max-h-48">{JSON.stringify(call.params, null, 2)}</pre>
            </div>
          )}

          {/* API response */}
          {call.response_preview != null && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-400 font-medium">
                  Response {call.total_response_items > 5 ? `(first 5 of ${call.total_response_items} items)` : ''}
                </span>
                <CopyButton text={JSON.stringify(call.response_preview, null, 2)} />
              </div>
              <pre className="bg-emerald-50 border border-emerald-100 rounded p-2 text-xs overflow-x-auto max-h-64 text-emerald-900">{JSON.stringify(call.response_preview, null, 2)}</pre>
            </div>
          )}

          {isErr && call.error && (
            <div className="text-red-600 bg-red-50 rounded p-2">
              <span className="font-semibold">Error: </span>{call.error}
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
  const agentBg = isQaRevision ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : isRetry      ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'

  return (
    <div className={`border-b border-slate-50 last:border-0 ${isRetry ? 'border-l-2 border-l-orange-300 ml-2' : ''}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-2.5 text-xs text-left flex items-center gap-2 flex-wrap hover:bg-slate-50"
      >
        {isRetry && <span className="text-orange-500 shrink-0 font-mono text-[10px]">↩ retry</span>}
        {isQaRevision && <span className="text-amber-600 shrink-0 font-mono text-[10px]">✏ revise</span>}
        <span className={`rounded px-1.5 py-0.5 font-mono shrink-0 text-[10px] ${agentBg}`}>{shortModel}</span>
        <span className="text-slate-700 truncate flex-1">{call.agent}</span>
        {tokens && <span className="text-slate-400 shrink-0 tabular-nums">{tokens}</span>}
        {costStr && <span className="font-semibold text-violet-600 shrink-0">{costStr}</span>}
        <span className="text-slate-400 shrink-0 tabular-nums">{call.elapsed_ms}ms</span>
        <span className="text-slate-400 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {call.stop_reason && <span><span className="text-slate-400">Stop:</span> {call.stop_reason}</span>}
            {call.called_at && <span><span className="text-slate-400">At:</span> {new Date(call.called_at).toLocaleTimeString('en-IN', { hour12: false })}</span>}
            {call.attempt > 1 && <span className="text-orange-600 font-medium">Attempt #{call.attempt}</span>}
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

  if (isLoading) return <div className="text-slate-400 text-sm p-6">Loading run...</div>
  if (isError || !run) {
    return (
      <div className="text-red-500 text-sm p-6">
        Run not found. It may have been evicted from memory (server restart).{' '}
        <Link to="/" className="text-brand hover:underline">Back to dashboard</Link>
      </div>
    )
  }

  const isRunning = run.status === 'running'

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

  // Detect retry groups in LLM calls — same agent appearing >1 time means retry
  const _agentCount: Record<string, number> = {}
  const llmCallsWithRetry = (calls?.llm_calls ?? []).map(c => {
    _agentCount[c.agent] = (_agentCount[c.agent] ?? 0) + 1
    return { ...c, _seenCount: _agentCount[c.agent] }
  })
  const _agentTotal: Record<string, number> = {}
  for (const c of calls?.llm_calls ?? []) _agentTotal[c.agent] = (_agentTotal[c.agent] ?? 0) + 1

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div>
          <Link to="/" className="text-xs text-slate-400 hover:text-brand">← Dashboard</Link>
          <h2 className="font-semibold text-slate-800 font-mono mt-1">{run.run_id}</h2>
          {run.topic_hint && (
            <p className="text-sm text-slate-500 mt-0.5 italic">"{run.topic_hint}"</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {run.triggered_at
              ? new Date(run.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : ''}{' '}
            {run.triggered_at && <span className="text-slate-300">·</span>}{' '}
            {timeAgo(run.triggered_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {run.dry_run && (
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">dry run</span>
          )}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[run.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />}
            {run.status}
          </span>
        </div>
      </div>

      {/* ── Pipeline progress ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pipeline Progress</h3>
        <div className="flex flex-wrap gap-3">
          {STEPS.map(({ label, field }) => {
            const val = run[field] ?? 0
            const done = val > 0
            return (
              <div key={field} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                done
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : isRunning
                  ? 'bg-blue-50 border-blue-200 text-blue-500 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <span className="font-medium">{done ? val : '—'}</span>
                <span>{label}</span>
              </div>
            )
          })}
          {totalLlmCost > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm border bg-violet-50 border-violet-200 text-violet-700">
              <span className="font-medium">${totalLlmCost.toFixed(3)}</span>
              <span>LLM Cost</span>
            </div>
          )}
          {totalApiCost > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm border bg-amber-50 border-amber-200 text-amber-700">
              <span className="font-medium">~${totalApiCost.toFixed(3)}</span>
              <span>API Cost</span>
            </div>
          )}
          {totalCost > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm border bg-slate-50 border-slate-200 text-slate-600">
              <span className="font-medium">${totalCost.toFixed(3)}</span>
              <span>Total Cost</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Posts from this run ──────────────────────────────────────────── */}
      {(dbPosts.length > 0 || isRunning) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Posts Generated
              {dbPosts.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {dbPosts.length}
                </span>
              )}
            </h3>
            {postsQ.isFetching && (
              <span className="text-xs text-slate-400 animate-pulse">refreshing…</span>
            )}
          </div>

          {postsQ.isLoading ? (
            <div className="text-slate-400 text-sm">Loading posts…</div>
          ) : dbPosts.length === 0 && isRunning ? (
            <div className="text-slate-400 text-sm animate-pulse">Waiting for posts…</div>
          ) : (
            <div className="space-y-4">
              {approvedPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    ✓ Approved / Published — {approvedPosts.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {approvedPosts.map((p) => <PostCard key={p.post_id} post={p} />)}
                  </div>
                </div>
              )}

              {draftPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    ⏳ Pending Human Review — {draftPosts.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {draftPosts.map((p) => <PostCard key={p.post_id} post={p} />)}
                  </div>
                </div>
              )}

              {rejectedPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
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

      {/* ── Pipeline detail — research / trends / briefs / drafts ─────────── */}
      {hasPipelineData && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Pipeline Inputs</h3>

          {(run.research?.length ?? 0) > 0 && (
            <CollapsibleSection title="Research Items" count={run.research!.length}>
              {(run.research as RunResearchItem[]).map((item, i) => (
                <div key={i} className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{item.headline}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-brand hover:underline flex-shrink-0">↗</a>
                    )}
                  </div>
                  {item.source && <p className="text-xs text-slate-400">{item.source}</p>}
                  {item.summary && <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>}
                  {item.relevance && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                      <span className="font-medium">Why relevant: </span>{item.relevance}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {(run.trends?.length ?? 0) > 0 && (
            <CollapsibleSection title="Trend Signals" count={run.trends!.length}>
              {(run.trends as RunTrendItem[]).map((t, i) => (
                <div key={i} className="p-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-brand">{t.hashtag}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 capitalize">{t.platform}</span>
                    {t.volume && <span className="text-xs text-slate-400">vol: {t.volume}</span>}
                    {t.city_hint && <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{t.city_hint}</span>}
                  </div>
                  {t.context && <p className="text-xs text-slate-600">{t.context}</p>}
                  {t.creative_hook && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 italic">
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
                <div key={i} className="p-4 space-y-2">
                  {/* type + platforms row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      b.draft_type === 'social' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>{b.draft_type}</span>
                    {b.tone && <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{b.tone}</span>}
                    {b.target_platforms?.map((p) => (
                      <span key={p} className="text-xs bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5">{p}</span>
                    ))}
                    {b.city_hint && <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5">{b.city_hint}</span>}
                  </div>
                  {/* topic — always show if present */}
                  {b.topic && (
                    <p className="text-xs text-slate-500 font-medium border-l-2 border-slate-200 pl-2">
                      {b.topic}
                    </p>
                  )}
                  {/* angle — the RE hook the creative agent will use */}
                  <p className="text-sm font-medium text-slate-800 leading-snug">{b.angle}</p>
                  {b.source_summary && (
                    <p className="text-xs text-slate-500 italic leading-relaxed">{b.source_summary}</p>
                  )}
                  {b.urgency && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                      <span className="font-medium">Urgency: </span>{b.urgency}
                    </p>
                  )}
                  {b.seo_keywords?.length > 0 && (
                    <p className="text-xs text-slate-400">SEO: {b.seo_keywords.join(', ')}</p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {(run.creative_drafts?.length ?? 0) > 0 && (
            <CollapsibleSection title="Creative Drafts" count={run.creative_drafts!.length}>
              {(run.creative_drafts as RunDraft[]).map((d, i) => (
                <div key={i} className="p-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      d.draft_type === 'social' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>{d.draft_type}</span>
                    {d.media_format && <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{d.media_format}</span>}
                    {d.target_platforms.map((p) => (
                      <span key={p} className="text-xs bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5">{p}</span>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-slate-800">{d.angle || d.headline}</p>
                  {d.hook && <p className="text-xs text-slate-600 italic">"{d.hook}"</p>}
                  {d.trend_hashtag && <p className="text-xs text-brand">{d.trend_hashtag}</p>}
                  {d.hashtags?.length > 0 && (
                    <p className="text-xs text-slate-400">
                      {d.hashtags.slice(0, 6).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ── API + LLM Calls ──────────────────────────────────────────────── */}
      {calls && (calls.total_api_calls > 0 || calls.total_llm_calls > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">External Calls</h3>

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

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {run.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <span className="font-semibold">Error: </span>{run.error}
        </div>
      )}

      {/* ── Event log ───────────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
        <button
          onClick={() => setLogOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 transition-colors"
        >
          <span className="text-xs font-medium text-slate-300">
            Run Log
            {isRunning && <span className="ml-2 text-blue-400 animate-pulse">● live</span>}
            {!isRunning && (run.events?.length ?? 0) > 0 && (
              <span className="ml-2 text-slate-500 text-xs">(reconstructed from DB)</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{run.events?.length ?? 0} events</span>
            <span className="text-xs text-slate-500">{logOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        {logOpen && (
          <div
            ref={logRef}
            className="h-96 overflow-y-auto font-mono text-xs p-4 space-y-0.5 border-t border-slate-700"
          >
            {!run.events?.length ? (
              <span className="text-slate-600">No events captured for this run.</span>
            ) : (
              run.events.map((ev, i) => {
                const shortLogger = (ev.logger ?? '').replace(/^agents\.|^tools\.|^workflow\.|^scheduler\./, '')
                return (
                  <div key={i} className="flex gap-2 leading-5 hover:bg-slate-800 rounded px-1 -mx-1">
                    <span className="text-slate-500 flex-shrink-0 w-20">{formatTs(ev.ts)}</span>
                    <span className={`flex-shrink-0 w-16 font-semibold ${LEVEL_COLOR[ev.level] ?? 'text-slate-400'}`}>
                      {ev.level}
                    </span>
                    <span className="text-slate-400 flex-shrink-0 w-36 truncate" title={ev.logger}>{shortLogger}</span>
                    <span className="text-slate-200 break-words min-w-0">{ev.msg}</span>
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
