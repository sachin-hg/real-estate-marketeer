import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPosts, submitFeedback, rejectPost } from '../lib/api'
import type { Post } from '../lib/types'

const PLATFORM_BADGE: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  instagram: 'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube: 'bg-red-100 text-red-700',
}

const ACTION_BADGE: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  flagged: 'bg-yellow-100 text-yellow-700',
}

const PLATFORMS = ['', 'twitter', 'instagram', 'housing_news', 'youtube']
const ACTIONS = ['', 'approved', 'rejected', 'flagged']
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

function PostCard({ post }: { post: Post }) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [tagInput, setTagInput] = useState('')
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
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
          {post.user_action && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                ACTION_BADGE[post.user_action] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {post.user_action}
            </span>
          )}
        </div>
        <div className="flex gap-2 text-xs text-slate-400">
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

      {/* Content preview */}
      <p className="text-sm text-slate-700 line-clamp-3">{post.content}</p>

      {/* Zomato hook */}
      {post.zomato_hook && (
        <p className="text-xs text-slate-500 italic">{post.zomato_hook}</p>
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

      {/* Star rating */}
      <StarRating
        value={post.user_rating}
        onChange={(v) => feedbackMut.mutate({ rating: v })}
      />

      {/* Tags */}
      <div className="flex flex-wrap gap-1 items-center">
        {(post.user_tags ?? []).map((tag) => (
          <span
            key={tag}
            className="text-xs bg-brand-50 text-brand px-2 py-0.5 rounded-full"
          >
            {tag}
          </span>
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
            <button
              onClick={handleAddTag}
              className="text-xs bg-brand text-white rounded px-2 py-0.5"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handleAction('approved')}
          className="flex-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => handleAction('flagged')}
          className="flex-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors"
        >
          ⚠ Flag
        </button>
        <button
          onClick={() => handleAction('rejected')}
          className="flex-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
        >
          ✕ Reject
        </button>
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
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="text-xs font-medium bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {post.rejection_reason && (
        <p className="text-xs text-red-500 italic">
          Rejected: {post.rejection_reason}
        </p>
      )}
    </div>
  )
}

export default function Posts() {
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [draftType, setDraftType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 20

  const { data, isLoading } = useQuery({
    queryKey: ['posts', platform, status, draftType, page],
    queryFn: () =>
      getPosts({
        platform: platform || undefined,
        status: status || undefined,
        draft_type: draftType || undefined,
        page,
        limit: LIMIT,
      }),
  })

  const posts = (data?.items ?? []).filter((p) =>
    search ? p.content.toLowerCase().includes(search.toLowerCase()) : true
  )

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT)

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p ? p : 'All Platforms'}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a ? a : 'All Actions'}
            </option>
          ))}
        </select>
        <select
          value={draftType}
          onChange={(e) => { setDraftType(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
        >
          {DRAFT_TYPES.map((d) => (
            <option key={d} value={d}>
              {d ? d : 'All Types'}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search content..."
          className="flex-1 min-w-40 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-slate-400 text-sm">No posts found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <PostCard key={post.post_id} post={post} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
          >
            Prev
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
