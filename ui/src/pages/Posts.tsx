import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getPosts, getRuns, submitFeedback, rejectPost } from '../lib/api'
import type { Post } from '../lib/types'

// 9 AM IST = 03:30 UTC, 6 PM IST = 12:30 UTC
const RUN_TIMES_UTC = [{ h: 3, m: 30 }, { h: 12, m: 30 }]
function nextRunCountdown(): string {
  const nowMs = Date.now()
  const candidates = RUN_TIMES_UTC.map(({ h, m }) => {
    const t = new Date(); t.setUTCHours(h, m, 0, 0)
    let diff = t.getTime() - nowMs
    if (diff <= 0) diff += 86_400_000
    return diff
  })
  const ms = Math.min(...candidates)
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

const PLATFORM_BADGE: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  instagram: 'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube: 'bg-red-100 text-red-700',
  linkedin: 'bg-blue-100 text-blue-700',
}

const ACTION_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  flagged: 'bg-yellow-100 text-yellow-700',
}

const POST_STATUS_BADGE: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  qa_rejected: 'bg-red-100 text-red-700',
  draft: 'bg-amber-100 text-amber-700',
}

const POST_STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  qa_rejected: 'QA Rejected',
  draft: 'Draft',
}

/** Render content with [text](url) markdown links as real <a> tags. */
function renderContent(content: string) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (m) {
      const href = m[2]
      const safeSrc = /^https?:\/\//i.test(href) ? href : '#'
      return (
        <a
          key={i}
          href={safeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline hover:text-brand-600"
          onClick={(e) => e.stopPropagation()}
        >
          {m[1]}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

const PLATFORMS = ['', 'twitter', 'instagram', 'housing_news', 'youtube', 'linkedin']
const ACTIONS = ['', 'approved', 'rejected', 'flagged']
const POST_STATUSES = ['', 'draft', 'published', 'qa_rejected']
const DRAFT_TYPES = ['', 'social', 'news', 'short']

function StarRating({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className={`text-lg ${star <= (value ?? 0) ? 'text-amber-400' : 'text-slate-300'} hover:text-amber-400 transition-colors`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/** Numbered pagination bar: shows first, last, current ± 1, with ellipsis */
function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: Array<number | '...'> = []
  const add = (n: number) => {
    if (!pages.includes(n)) pages.push(n)
  }

  add(1)
  if (page > 3) pages.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i)
  if (page < totalPages - 2) pages.push('...')
  if (totalPages > 1) add(totalPages)

  return (
    <div className="flex items-center gap-1.5 justify-center">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="text-sm px-1.5 text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`text-sm min-w-[2rem] px-2 py-1.5 rounded-lg border transition-colors ${
              p === page
                ? 'bg-brand text-white border-brand font-semibold'
                : 'border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
      >
        ›
      </button>
    </div>
  )
}

function PostCard({ post }: { post: Post }) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [imgError, setImgError] = useState(false)
  const qc = useQueryClient()

  const feedbackMut = useMutation({
    mutationFn: (data: Parameters<typeof submitFeedback>[1]) =>
      submitFeedback(post.post_id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }),
  })

  const rejectMut = useMutation({
    mutationFn: ({ reason }: { reason: string }) => rejectPost(post.post_id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      setShowReject(false)
    },
  })

  const handleAction = (action: string) => {
    if (action === 'rejected') {
      setShowReject(true)
    } else {
      feedbackMut.mutate({ action })
    }
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    const existing = post.user_tags ?? []
    feedbackMut.mutate({ tags: [...existing, tag] })
    setTagInput('')
  }

  const imageUrl = !imgError && post.media_urls?.[0]
    ? `/${post.media_urls[0]}`
    : null

  return (
    // Link wrapping enables Cmd+click to open in new tab
    <Link
      to={`/posts/${post.post_id}`}
      className="block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
    >
      {/* Image */}
      {imageUrl && (
        <div className="w-full aspect-square bg-slate-100 overflow-hidden">
          <img
            src={imageUrl}
            alt="post creative"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Top badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                PLATFORM_BADGE[post.platform] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {post.platform}
            </span>
            {post.draft_type && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {post.draft_type}
              </span>
            )}
            {post.post_status && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  POST_STATUS_BADGE[post.post_status] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {POST_STATUS_LABEL[post.post_status] ?? post.post_status}
              </span>
            )}
            {post.user_action && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  ACTION_BADGE[post.user_action] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                ✎ {post.user_action}
              </span>
            )}
          </div>
          <div className="flex gap-2 text-xs text-slate-400 flex-shrink-0">
            {post.qa_overall !== undefined && (
              <span className="bg-slate-100 rounded px-1.5 py-0.5">
                QA {post.qa_overall.toFixed(1)}
              </span>
            )}
            {post.pred_engagement_rate !== undefined && (
              <span className="bg-sky-50 text-sky-600 rounded px-1.5 py-0.5">
                ER {(post.pred_engagement_rate * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Source chip */}
        {(() => {
          const src = post.source_topic || post.trend_hashtag || post.creative_angle
          if (!src) return null
          const isManual = post.source_topic && !post.source_topic.startsWith('#') && !post.trend_hashtag
          return (
            <div className="flex items-start gap-1.5">
              <span className="text-slate-400 text-xs mt-0.5 shrink-0 select-none">
                {isManual ? '✍' : '↗'}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {src}
              </p>
            </div>
          )
        })()}

        {/* Full content */}
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {renderContent(post.content)}
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <p className="text-sm text-brand leading-relaxed">
              {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
            </p>
          )}
        </div>

        {/* QA rejection reasons */}
        {post.post_status === 'qa_rejected' && post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
          <div className="bg-red-50 rounded-lg px-3 py-2 space-y-1">
            <p className="text-xs font-medium text-red-700">QA Rejection Reasons:</p>
            <ul className="space-y-0.5">
              {post.qa_rejection_reasons.map((reason, i) => (
                <li key={i} className="text-xs text-red-600 flex gap-1">
                  <span className="shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manual rejection reason */}
        {post.user_action === 'rejected' && post.rejection_reason && (
          <p className="text-xs text-orange-600 italic bg-orange-50 rounded px-2 py-1">
            ✎ Manually rejected: {post.rejection_reason}
          </p>
        )}

        {/* Zomato hook */}
        {post.zomato_hook && (
          <div className="bg-slate-900 text-white rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-slate-400 mb-0.5">Card text</p>
            <p className="text-sm font-semibold leading-snug">{post.zomato_hook}</p>
          </div>
        )}

        {/* Actual vs predicted */}
        {post.actual_engagement_7d !== undefined && post.pred_engagement_rate !== undefined && (
          <div className="text-xs flex gap-2">
            <span className="text-slate-500">Actual 7d:</span>
            <span
              className={
                post.actual_engagement_7d >= post.pred_engagement_rate
                  ? 'text-green-600 font-medium'
                  : 'text-red-500 font-medium'
              }
            >
              {post.actual_engagement_7d >= post.pred_engagement_rate ? '▲' : '▼'}{' '}
              {(post.actual_engagement_7d * 100).toFixed(2)}%
            </span>
          </div>
        )}

        {/* Interactive section — stop propagation so clicks don't bubble to the Link */}
        <div onClick={(e) => e.stopPropagation()} className="space-y-3">
          {/* Star rating */}
          <StarRating
            value={post.user_rating}
            onChange={(v) => feedbackMut.mutate({ rating: v })}
          />

          {/* Tags */}
          <div className="flex flex-wrap gap-1 items-center">
            {(post.user_tags ?? []).map((tag) => (
              <span key={tag} className="text-xs bg-brand-50 text-brand px-2 py-0.5 rounded-full">{tag}</span>
            ))}
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="+ tag"
                className="text-xs border border-slate-200 rounded px-2 py-0.5 w-20 focus:outline-none focus:border-brand"
              />
              {tagInput && (
                <button onClick={handleAddTag} className="text-xs bg-brand text-white rounded px-2 py-0.5">Add</button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1 mt-auto">
            <button
              onClick={() => handleAction('approved')}
              className="flex-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
            >✓ Approve</button>
            <button
              onClick={() => handleAction('flagged')}
              className="flex-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors"
            >⚠ Flag</button>
            <button
              onClick={() => handleAction('rejected')}
              className="flex-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
            >✕ Reject</button>
          </div>

          {/* Rejection reason */}
          {showReject && (
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason..."
                rows={2}
                className="text-xs border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => rejectMut.mutate({ reason: rejectReason })}
                  disabled={!rejectReason.trim()}
                  className="text-xs font-medium bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >Confirm Reject</button>
                <button
                  onClick={() => setShowReject(false)}
                  className="text-xs font-medium bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-200 transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function Posts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [countdown, setCountdown] = useState(nextRunCountdown)
  const LIMIT = 20

  // All filter state lives in the URL — survives navigation back
  const live = searchParams.get('live') === '1'
  const platform = searchParams.get('platform') ?? ''
  const postStatus = searchParams.get('post_status') ?? ''
  const userAction = searchParams.get('user_action') ?? ''
  const draftType = searchParams.get('draft_type') ?? ''
  const runId = searchParams.get('run_id') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      next.set('page', '1')
      return next
    })
  }

  const setPage = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }

  useEffect(() => {
    const id = setInterval(() => setCountdown(nextRunCountdown()), 60_000)
    return () => clearInterval(id)
  }, [])

  const runsQ = useQuery({ queryKey: ['runs'], queryFn: getRuns })
  const runIds = (runsQ.data ?? []).map((r) => r.run_id)

  const effectivePostStatus = live ? 'published' : postStatus

  const { data, isLoading } = useQuery({
    queryKey: ['posts', platform, effectivePostStatus, userAction, draftType, runId, dateFrom, dateTo, search, page, live],
    queryFn: () =>
      getPosts({
        platform: platform || undefined,
        post_status: effectivePostStatus || undefined,
        status: userAction || undefined,
        draft_type: draftType || undefined,
        run_id: runId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
        page,
        limit: LIMIT,
      }),
    refetchInterval: live ? 30_000 : false,
  })

  const posts = data?.items ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT)

  const clearFilters = () => setSearchParams({})
  const hasFilters = live || platform || postStatus || userAction || draftType || runId || dateFrom || dateTo || search

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Live toggle */}
          <button
            onClick={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (live) { next.delete('live') } else { next.set('live', '1') }
                next.set('page', '1')
                return next
              })
            }}
            className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border transition-colors ${
              live
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
            Live
          </button>
          <select
            value={platform}
            onChange={(e) => setParam('platform', e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p ? p : 'All Platforms'}</option>
            ))}
          </select>
          <select
            value={postStatus}
            onChange={(e) => setParam('post_status', e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            {POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All QA Status' : s === 'published' ? 'QA Approved' : s === 'draft' ? 'Draft' : 'QA Rejected'}
              </option>
            ))}
          </select>
          <select
            value={userAction}
            onChange={(e) => setParam('user_action', e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a ? `✎ ${a}` : 'All User Actions'}</option>
            ))}
          </select>
          <select
            value={draftType}
            onChange={(e) => setParam('draft_type', e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            {DRAFT_TYPES.map((d) => (
              <option key={d} value={d}>{d ? d : 'All Types'}</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            placeholder="Search content..."
            className="flex-1 min-w-40 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          />
        </div>

        {/* Second row: run ID + date filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <input
              list="run-ids-list"
              value={runId}
              onChange={(e) => setParam('run_id', e.target.value)}
              placeholder="Filter by Run ID..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand font-mono"
            />
            <datalist id="run-ids-list">
              {runIds.map((id) => <option key={id} value={id} />)}
            </datalist>
            {runId && (
              <button
                onClick={() => setParam('run_id', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >✕</button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setParam('date_from', e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setParam('date_to', e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap"
            >
              Clear all
            </button>
          )}

          <span className="text-xs text-slate-400 ml-auto">
            {isLoading ? 'Loading...' : `${data?.total ?? 0} posts`}
            {live && !isLoading && (
              <span className="ml-2 text-green-600 font-medium">· next run in {countdown}</span>
            )}
          </span>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-slate-400 text-sm">No posts found.</div>
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
          {posts.map((post) => (
            <div key={post.post_id} className="break-inside-avoid mb-4">
              <PostCard post={post} />
            </div>
          ))}
        </div>
      )}

      {/* Numbered pagination */}
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}
