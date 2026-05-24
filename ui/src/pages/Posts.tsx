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

// ── Design tokens ────────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
}

const PLATFORM_STYLE: Record<string, React.CSSProperties> = {
  twitter:      { background: 'rgba(56,189,248,0.08)',  color: '#7dd3fc',  border: '1px solid rgba(56,189,248,0.18)' },
  instagram:    { background: 'rgba(244,114,182,0.08)', color: '#f9a8d4',  border: '1px solid rgba(244,114,182,0.18)' },
  housing_news: { background: 'rgba(52,211,153,0.08)',  color: '#6ee7b7',  border: '1px solid rgba(52,211,153,0.18)' },
  youtube:      { background: 'rgba(248,113,113,0.08)', color: '#fca5a5',  border: '1px solid rgba(248,113,113,0.18)' },
  linkedin:     { background: 'rgba(96,165,250,0.08)',  color: '#93c5fd',  border: '1px solid rgba(96,165,250,0.18)' },
}

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  approved: { background: 'rgba(52,211,153,0.08)',  color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.18)' },
  rejected: { background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.18)' },
  flagged:  { background: 'rgba(251,191,36,0.08)',  color: '#d4a855', border: '1px solid rgba(251,191,36,0.18)' },
}

const POST_STATUS_STYLE: Record<string, React.CSSProperties> = {
  published:   { background: 'rgba(52,211,153,0.08)',  color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.18)' },
  qa_rejected: { background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.18)' },
  draft:       { background: 'rgba(251,191,36,0.08)',  color: '#d4a855', border: '1px solid rgba(251,191,36,0.18)' },
}

const POST_STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  qa_rejected: 'QA Rejected',
  draft: 'Draft',
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 999,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  padding: '6px 12px',
  outline: 'none',
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
          style={{ color: '#818CF8', textDecoration: 'underline' }}
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
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: star <= (value ?? 0) ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            padding: 0,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = star <= (value ?? 0) ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/** Numbered pagination bar */
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

  const btnBase: React.CSSProperties = {
    fontSize: 13,
    minWidth: 32,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'background 0.15s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{ ...btnBase, opacity: page <= 1 ? 0.4 : 1 }}
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} style={{ fontSize: 13, padding: '0 4px', color: '#64748b' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            style={{
              ...btnBase,
              ...(p === page
                ? { background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', color: '#fff', border: '1px solid transparent', fontWeight: 600 }
                : {}),
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        style={{ ...btnBase, opacity: page >= totalPages ? 0.4 : 1 }}
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

  const rawMedia = post.media_urls?.[0]
  const imageUrl = !imgError && rawMedia
    ? (rawMedia.startsWith('http') ? rawMedia : `/${rawMedia}`)
    : null

  return (
    <Link
      to={`/dashboard/posts/${post.post_id}`}
      style={{
        display: 'block',
        ...glass,
        overflow: 'hidden',
        textDecoration: 'none',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'translateY(-2px)'
        el.style.borderColor = 'rgba(129,140,248,0.3)'
        el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'translateY(0)'
        el.style.borderColor = 'rgba(255,255,255,0.09)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Image */}
      {imageUrl && (
        <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
          <img
            src={imageUrl}
            alt="post creative"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ ...badge, ...(PLATFORM_STYLE[post.platform] ?? { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }) }}>
              {post.platform}
            </span>
            {post.draft_type && (
              <span style={{ ...badge, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                {post.draft_type}
              </span>
            )}
            {post.post_status && (
              <span style={{ ...badge, ...(POST_STATUS_STYLE[post.post_status] ?? { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }) }}>
                {POST_STATUS_LABEL[post.post_status] ?? post.post_status}
              </span>
            )}
            {post.user_action && (
              <span style={{ ...badge, ...(ACTION_STYLE[post.user_action] ?? { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }) }}>
                ✎ {post.user_action}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11, flexShrink: 0 }}>
            {post.qa_overall !== undefined && (
              <span style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 6, padding: '2px 6px' }}>
                QA {post.qa_overall.toFixed(1)}
              </span>
            )}
            {post.pred_engagement_rate !== undefined && (
              <span style={{ background: 'rgba(56,189,248,0.07)', color: '#7dd3fc', borderRadius: 6, padding: '2px 6px' }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#64748b', fontSize: 11, marginTop: 2, flexShrink: 0 }}>
                {isManual ? '✍' : '↗'}
              </span>
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {src}
              </p>
            </div>
          )
        })()}

        {/* Full content */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
            {renderContent(post.content)}
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <p style={{ fontSize: 13, color: '#818CF8', lineHeight: 1.6, margin: 0 }}>
              {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
            </p>
          )}
        </div>

        {/* QA rejection reasons */}
        {post.post_status === 'qa_rejected' && post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '8px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#fca5a5', margin: '0 0 4px' }}>QA Rejection Reasons:</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {post.qa_rejection_reasons.map((reason, i) => (
                <li key={i} style={{ fontSize: 11, color: '#fca5a5', display: 'flex', gap: 4 }}>
                  <span>•</span><span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manual rejection reason */}
        {post.user_action === 'rejected' && post.rejection_reason && (
          <p style={{ fontSize: 11, color: '#fb923c', fontStyle: 'italic', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '4px 8px', margin: 0 }}>
            ✎ Manually rejected: {post.rejection_reason}
          </p>
        )}

        {/* Zomato hook */}
        {post.zomato_hook && (
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#64748b', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card text</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, margin: 0 }}>{post.zomato_hook}</p>
          </div>
        )}

        {/* Actual vs predicted */}
        {post.actual_engagement_7d !== undefined && post.pred_engagement_rate !== undefined && (
          <div style={{ fontSize: 11, display: 'flex', gap: 8 }}>
            <span style={{ color: '#64748b' }}>Actual 7d:</span>
            <span style={{ color: post.actual_engagement_7d >= post.pred_engagement_rate ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>
              {post.actual_engagement_7d >= post.pred_engagement_rate ? '▲' : '▼'}{' '}
              {(post.actual_engagement_7d * 100).toFixed(2)}%
            </span>
          </div>
        )}

        {/* Interactive section — stop propagation so clicks don't bubble to the Link */}
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Star rating */}
          <StarRating
            value={post.user_rating}
            onChange={(v) => feedbackMut.mutate({ rating: v })}
          />

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {(post.user_tags ?? []).map((tag) => (
              <span key={tag} style={{ fontSize: 11, background: 'rgba(129,140,248,0.12)', color: '#818CF8', padding: '2px 8px', borderRadius: 999 }}>{tag}</span>
            ))}
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="+ tag"
                style={{ ...inputStyle, fontSize: 11, padding: '2px 8px', width: 64 }}
              />
              {tagInput && (
                <button
                  onClick={handleAddTag}
                  style={{ fontSize: 11, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { action: 'approved', label: '✓ Approve', activeColor: '#6ee7b7', activeBg: 'rgba(52,211,153,0.1)', activeBorder: 'rgba(52,211,153,0.2)' },
              { action: 'flagged',  label: '⚠ Flag',    activeColor: '#d4a855', activeBg: 'rgba(251,191,36,0.1)', activeBorder: 'rgba(251,191,36,0.2)' },
              { action: 'rejected', label: '✕ Reject',  activeColor: '#fca5a5', activeBg: 'rgba(248,113,113,0.1)', activeBorder: 'rgba(248,113,113,0.2)' },
            ] as const).map(({ action, label, activeColor, activeBg, activeBorder }) => {
              const isActive = post.user_action === action
              return (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  style={{
                    flex: 1, fontSize: 11, fontWeight: 500, borderRadius: 8, padding: '6px 0', cursor: 'pointer', transition: 'background 0.15s',
                    background: isActive ? activeBg : 'rgba(255,255,255,0.04)',
                    color: isActive ? activeColor : '#64748b',
                    border: isActive ? `1px solid ${activeBorder}` : '1px solid rgba(255,255,255,0.08)',
                  }}
                >{label}</button>
              )
            })}
          </div>

          {/* Rejection reason */}
          {showReject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason..."
                rows={2}
                style={{ ...inputStyle, resize: 'none', fontSize: 11, padding: 8, lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => rejectMut.mutate({ reason: rejectReason })}
                  disabled={!rejectReason.trim()}
                  style={{ fontSize: 11, fontWeight: 500, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', opacity: rejectReason.trim() ? 1 : 0.5 }}
                >Confirm Reject</button>
                <button
                  onClick={() => setShowReject(false)}
                  style={{ fontSize: 11, fontWeight: 500, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
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
  const [filtersOpen, setFiltersOpen] = useState(() => !!(
    searchParams.get('live') || searchParams.get('platform') ||
    searchParams.get('post_status') || searchParams.get('user_action') ||
    searchParams.get('draft_type') || searchParams.get('run_id') ||
    searchParams.get('date_from') || searchParams.get('date_to') ||
    searchParams.get('search')
  ))

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filter bar */}
      <div style={{ ...glass, overflow: 'hidden' }}>
        {/* Header — always visible, tap to expand */}
        <div
          onClick={() => setFiltersOpen(v => !v)}
          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' as const }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Filters</span>
            {hasFilters && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', fontWeight: 600 }}>active</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {isLoading ? '…' : `${data?.total ?? 0} posts`}
              {live && !isLoading && <span style={{ marginLeft: 6, color: '#6ee7b7', fontWeight: 500 }}>· {countdown}</span>}
            </span>
            <span style={{ fontSize: 14, color: '#64748b', display: 'inline-block', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </div>
        </div>

        {/* Collapsible filter content */}
        {filtersOpen && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 12 }}>
              {/* Live toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    if (live) { next.delete('live') } else { next.set('live', '1') }
                    next.set('page', '1')
                    return next
                  })
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: '6px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  ...(live
                    ? { background: 'rgba(52,211,153,0.08)', color: '#6ee7b7', outline: '1px solid rgba(52,211,153,0.2)' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', outline: '1px solid rgba(255,255,255,0.1)' }),
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#6ee7b7' : '#64748b', ...(live ? { animation: 'pulse 2s infinite' } : {}) }} />
                Live
              </button>
              <select value={platform} onChange={(e) => setParam('platform', e.target.value)} style={selectStyle}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} style={{ background: '#0f172a' }}>{p ? p : 'All Platforms'}</option>
                ))}
              </select>
              <select value={postStatus} onChange={(e) => setParam('post_status', e.target.value)} style={selectStyle}>
                {POST_STATUSES.map((s) => (
                  <option key={s} value={s} style={{ background: '#0f172a' }}>
                    {s === '' ? 'All QA Status' : s === 'published' ? 'QA Approved' : s === 'draft' ? 'Draft' : 'QA Rejected'}
                  </option>
                ))}
              </select>
              <select value={userAction} onChange={(e) => setParam('user_action', e.target.value)} style={selectStyle}>
                {ACTIONS.map((a) => (
                  <option key={a} value={a} style={{ background: '#0f172a' }}>{a ? `✎ ${a}` : 'All User Actions'}</option>
                ))}
              </select>
              <select value={draftType} onChange={(e) => setParam('draft_type', e.target.value)} style={selectStyle}>
                {DRAFT_TYPES.map((d) => (
                  <option key={d} value={d} style={{ background: '#0f172a' }}>{d ? d : 'All Types'}</option>
                ))}
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setParam('search', e.target.value)}
                placeholder="Search content..."
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              />
            </div>

            {/* Second row: run ID + date filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 210 }}>
                <input
                  list="run-ids-list"
                  value={runId}
                  onChange={(e) => setParam('run_id', e.target.value)}
                  placeholder="Filter by Run ID..."
                  style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                <datalist id="run-ids-list">
                  {runIds.map((id) => <option key={id} value={id} />)}
                </datalist>
                {runId && (
                  <button
                    onClick={() => setParam('run_id', '')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
                  >✕</button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>From</label>
                <input type="date" value={dateFrom} onChange={(e) => setParam('date_from', e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>To</label>
                <input type="date" value={dateTo} onChange={(e) => setParam('date_to', e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>Loading posts…</div>
      ) : posts.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>No posts found.</div>
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
