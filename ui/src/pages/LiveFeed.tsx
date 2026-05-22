import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPosts, rejectPost } from '../lib/api'
import type { Post } from '../lib/types'

const PLATFORM_BADGE: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  instagram: 'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube: 'bg-red-100 text-red-700',
}

// 9 AM IST = 03:30 UTC, 6 PM IST = 12:30 UTC
const RUN_TIMES_UTC = [{ h: 3, m: 30 }, { h: 12, m: 30 }]
const MS_PER_DAY = 86_400_000

function nextRunCountdown(): string {
  const nowMs = Date.now()
  const candidates = RUN_TIMES_UTC.map(({ h, m }) => {
    const target = new Date()
    target.setUTCHours(h, m, 0, 0)
    let diff = target.getTime() - nowMs
    if (diff <= 0) diff += MS_PER_DAY
    return diff
  })
  const ms = Math.min(...candidates)
  const hrs = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  return `${hrs}h ${mins}m`
}

function useCountdown(): string {
  const [countdown, setCountdown] = useState(nextRunCountdown)
  useEffect(() => {
    const id = setInterval(() => setCountdown(nextRunCountdown()), 60_000)
    return () => clearInterval(id)
  }, [])
  return countdown
}

function LivePostCard({ post }: { post: Post }) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const qc = useQueryClient()

  const rejectMut = useMutation({
    mutationFn: ({ r }: { r: string }) => rejectPost(post.post_id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-posts'] })
      setShowReject(false)
    },
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              PLATFORM_BADGE[post.platform] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {post.platform}
          </span>
          {post.user_action === 'rejected' && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              rejected
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {post.published_at
            ? new Date(post.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            : ''}
        </span>
      </div>

      <p className="text-sm text-slate-700 line-clamp-3">{post.content}</p>

      {post.published_url && post.published_url !== 'dry_run' && (
        <a
          href={post.published_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand hover:underline"
        >
          {post.published_url}
        </a>
      )}

      {post.output_path && (
        <p className="text-xs text-slate-400 font-mono">{post.output_path}</p>
      )}

      {/* Reject button */}
      {post.user_action !== 'rejected' && (
        <div>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              className="text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
            >
              Reject / Takedown
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Takedown reason..."
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => rejectMut.mutate({ r: reason })}
                  disabled={!reason.trim()}
                  className="text-xs font-medium bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Confirm Takedown
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
        </div>
      )}
    </div>
  )
}

export default function LiveFeed() {
  const [platform, setPlatform] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['live-posts', platform, 'published'],
    queryFn: () => getPosts({ platform: platform || undefined, limit: 50, post_status: 'published' }),
    refetchInterval: 30_000,
  })

  const posts = data?.items ?? []
  const countdown = useCountdown()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div>
          <h2 className="font-semibold text-slate-800">Published Posts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-refresh every 30s. Next scheduled run in{' '}
            <span className="font-semibold text-brand">{countdown}</span> (9 AM / 6 PM IST)
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            <option value="">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="instagram">Instagram</option>
            <option value="housing_news">Housing News</option>
            <option value="youtube">YouTube</option>
          </select>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-slate-400 text-sm">No published posts yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <LivePostCard key={post.post_id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
