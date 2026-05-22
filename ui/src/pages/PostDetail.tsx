import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPost, getRunDetail, submitFeedback, rejectPost, updatePost, uploadPostMedia, publishPost } from '../lib/api'

const PLATFORM_BADGE: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  instagram: 'bg-pink-100 text-pink-700',
  housing_news: 'bg-emerald-100 text-emerald-700',
  youtube: 'bg-red-100 text-red-700',
  linkedin: 'bg-blue-100 text-blue-700',
}

const LEVEL_COLOR: Record<string, string> = {
  DEBUG: 'text-slate-500',
  INFO: 'text-emerald-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-600',
}

function renderContent(content: string) {
  return content.split(/(\[[^\]]+\]\([^)]+\))/).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (m) {
      const safeSrc = /^https?:\/\//i.test(m[2]) ? m[2] : '#'
      return (
        <a key={i} href={safeSrc} target="_blank" rel="noopener noreferrer"
          className="text-brand underline hover:text-brand-600">{m[1]}</a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function ScoreBar({ label, value, max = 10 }: { label: string; value?: number; max?: number }) {
  if (value == null) return null
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= 7 ? 'bg-green-400' : value >= 5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{value.toFixed(1)}<span className="text-slate-400">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function StarRating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)}
          className={`text-xl ${star <= (value ?? 0) ? 'text-amber-400' : 'text-slate-200'} hover:text-amber-400 transition-colors`}>★</button>
      ))}
    </div>
  )
}

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-IN', { hour12: false })
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim().replace(/^#+/, '')
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-8 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus-within:border-brand">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 text-xs bg-brand-50 text-brand rounded-full px-2 py-0.5">
          #{tag}
          <button onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="text-brand hover:text-red-500 leading-none">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="Add hashtag…"
        className="text-xs outline-none flex-1 min-w-20 text-slate-700 placeholder:text-slate-300"
      />
    </div>
  )
}

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLog, setShowLog] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [imgError, setImgError] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editHashtags, setEditHashtags] = useState<string[]>([])
  const [editHook, setEditHook] = useState('')
  const [editMediaUrls, setEditMediaUrls] = useState<string[]>([])
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const postQ = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId!),
    enabled: !!postId,
  })
  const post = postQ.data

  const runQ = useQuery({
    queryKey: ['run-detail', post?.run_id],
    queryFn: () => getRunDetail(post!.run_id),
    enabled: !!post?.run_id,
  })
  const run = runQ.data

  // Fetch the output markdown file served by /output/...
  const outputQ = useQuery({
    queryKey: ['post-output', post?.output_path],
    queryFn: () =>
      fetch(`/${post!.output_path}`).then((r) => (r.ok ? r.text() : null)),
    enabled: !!post?.output_path && showOutput,
  })

  const feedbackMut = useMutation({
    mutationFn: (data: Parameters<typeof submitFeedback>[1]) =>
      submitFeedback(postId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', postId] }),
  })

  const rejectMut = useMutation({
    mutationFn: (reason: string) => rejectPost(postId!, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      setShowReject(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof updatePost>[1]) => updatePost(postId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      setIsEditing(false)
    },
  })

  const publishMut = useMutation({
    mutationFn: () => publishPost(postId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', postId] }),
  })

  const enterEdit = useCallback(() => {
    if (!post) return
    setEditContent(post.content ?? '')
    setEditHashtags((post.hashtags ?? []).map((h) => h.replace(/^#/, '')))
    setEditHook(post.zomato_hook ?? '')
    setEditMediaUrls(post.media_urls ?? [])
    setMediaUrlInput('')
    setUploadError('')
    setIsEditing(true)
  }, [post])

  const saveEdit = () => {
    updateMut.mutate({
      content: editContent,
      hashtags: editHashtags,
      zomato_hook: editHook,
      media_urls: editMediaUrls,
    })
  }

  const handleFileUpload = async (file: File) => {
    if (!postId) return
    setUploadError('')
    setIsUploading(true)
    try {
      const result = await uploadPostMedia(postId, file)
      setEditMediaUrls((prev) => [result.path, ...prev.filter((u) => u !== result.path)])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    if (showLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [showLog, run?.events?.length])

  if (postQ.isLoading) return <div className="text-slate-400 text-sm p-6">Loading post...</div>
  if (!post) return (
    <div className="text-red-500 text-sm p-6">
      Post not found. <Link to="/posts" className="text-brand hover:underline">← Back to Posts</Link>
    </div>
  )

  const imageUrl = !imgError && post.media_urls?.[0] ? `/${post.media_urls[0]}` : null
  const hasActuals = post.actual_impressions_6h != null || post.actual_impressions_24h != null ||
    post.actual_likes_24h != null || post.actual_engagement_7d != null ||
    post.actual_impressions_7d != null || post.actual_housing_traffic != null

  const PIPELINE_STEPS = run ? [
    { label: 'Research items', val: run.research_count },
    { label: 'Trends', val: run.trends_count },
    { label: 'Briefs', val: run.briefs_count },
    { label: 'Drafts', val: run.drafts_count },
    { label: 'Platform posts', val: run.platform_posts_count },
    { label: 'Approved', val: run.posts_approved },
  ] : []

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-brand">← Back</button>
        <span className="text-slate-200">/</span>
        <span className="text-xs text-slate-500 font-mono">{post.post_id.slice(0, 12)}…</span>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${PLATFORM_BADGE[post.platform] ?? 'bg-slate-100 text-slate-600'}`}>
          {post.platform}
        </span>
        {post.draft_type && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{post.draft_type}</span>
        )}
        {post.post_status === 'published' && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Published</span>
        )}
        {post.post_status === 'draft' && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Draft — Awaiting Review</span>
        )}
        {post.post_status === 'qa_rejected' && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">QA Rejected</span>
        )}
        {post.qa_decision === 'advisory' && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-sky-100 text-sky-700" title="QA ran in advisory mode — quality scores are guidance only">QA Advisory</span>
        )}
        {post.user_action && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">✎ {post.user_action}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {post.published_at
              ? new Date(post.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : ''}
          </span>
          {post.post_status === 'draft' && !isEditing && (
            <button
              onClick={() => { if (confirm('Publish this draft now?')) publishMut.mutate() }}
              disabled={publishMut.isPending}
              className="text-sm font-medium bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {publishMut.isPending ? 'Publishing…' : '↑ Publish'}
            </button>
          )}
          {publishMut.isError && (
            <span className="text-xs text-red-500">{(publishMut.error as Error).message}</span>
          )}
          {!isEditing ? (
            <button onClick={enterEdit}
              className="text-sm font-medium bg-slate-800 text-white rounded-lg px-3 py-1.5 hover:bg-slate-700 transition-colors flex items-center gap-1.5">
              ✎ Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsEditing(false)}
                className="text-sm font-medium bg-white text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={updateMut.isPending}
                className="text-sm font-medium bg-brand text-white rounded-lg px-3 py-1.5 hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {updateMut.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Content + creative context ──────────────────── */}
        <div className="lg:col-span-3 space-y-5">

          {/* ── EDIT MODE ────────────────────────────────────────── */}
          {isEditing ? (
            <div className="bg-white rounded-xl border-2 border-brand shadow-sm p-5 space-y-5">
              <h3 className="text-xs font-semibold text-brand uppercase tracking-wide">Editing Post</h3>

              {/* Image / media */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Image / Media</label>

                {/* Current images */}
                {editMediaUrls.length > 0 && (
                  <div className="space-y-2">
                    {editMediaUrls.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={`/${url}`} alt="media"
                          className="w-full max-h-64 object-contain rounded-lg bg-slate-100" />
                        <button
                          onClick={() => setEditMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-2 right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload drop zone */}
                <div
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-brand transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileUpload(file)
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/mp4"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                      e.target.value = ''
                    }}
                  />
                  {isUploading ? (
                    <p className="text-xs text-slate-400 animate-pulse">Uploading…</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Drop image here or <span className="text-brand underline">browse</span>
                      <br />
                      <span className="text-slate-300">JPG, PNG, GIF, WebP, MP4 — max 20 MB</span>
                    </p>
                  )}
                </div>
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

                {/* URL input for external images */}
                <div className="flex gap-2">
                  <input
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mediaUrlInput.trim()) {
                        setEditMediaUrls((prev) => [mediaUrlInput.trim(), ...prev])
                        setMediaUrlInput('')
                      }
                    }}
                    placeholder="Or paste image URL and press Enter"
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Post Content
                  <span className="ml-2 text-slate-400 font-normal">{editContent.length} chars</span>
                  {post.platform === 'twitter' && editContent.length > 280 && (
                    <span className="ml-1 text-red-500">· over 280</span>
                  )}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-y focus:outline-none focus:border-brand leading-relaxed font-mono"
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Hashtags</label>
                <TagEditor tags={editHashtags} onChange={setEditHashtags} />
              </div>

              {/* Image card text (zomato hook) */}
              {(post.zomato_hook || post.draft_type === 'social') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Image Card Text</label>
                  <textarea
                    value={editHook}
                    onChange={(e) => setEditHook(e.target.value)}
                    rows={2}
                    placeholder="Short punchy text for the visual card…"
                    className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:border-brand"
                  />
                </div>
              )}

              {/* Save error */}
              {updateMut.isError && (
                <p className="text-xs text-red-500">
                  Save failed: {String(updateMut.error)}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={saveEdit} disabled={updateMut.isPending}
                  className="flex-1 bg-brand text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-600 disabled:opacity-50 transition-colors">
                  {updateMut.isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="flex-1 bg-white text-slate-600 border border-slate-200 text-sm font-medium rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>

          {/* Post output */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {imageUrl && (
              <div className="w-full bg-slate-100">
                <img src={imageUrl} alt="Post creative" onError={() => setImgError(true)}
                  className="w-full max-h-96 object-contain" />
              </div>
            )}
            <div className="p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Post Content</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {renderContent(post.content)}
                </p>
                {post.hashtags?.length > 0 && (
                  <p className="text-sm text-brand leading-relaxed">
                    {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                  </p>
                )}
              </div>
              {post.published_url && post.published_url !== 'dry_run' && (
                <a href={post.published_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand hover:underline break-all">
                  ↗ {post.published_url}
                </a>
              )}
              {post.published_url === 'dry_run' && (
                <span className="text-xs text-slate-400 italic">dry run — not published live</span>
              )}
            </div>
          </div>

          {/* Card text (zomato hook) */}
          {post.zomato_hook && (
            <div className="bg-slate-900 text-white rounded-xl p-5 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Image Card Text</p>
              <p className="text-base font-semibold leading-snug">{post.zomato_hook}</p>
            </div>
          )}

          {/* Creative context */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Creative Context</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {post.source_topic && (
                <>
                  <dt className="text-xs text-slate-400">Source / Trigger</dt>
                  <dd className="text-sm text-slate-800">{post.source_topic}</dd>
                </>
              )}
              {post.creative_angle && (
                <>
                  <dt className="text-xs text-slate-400">Creative Angle</dt>
                  <dd className="text-sm text-slate-800">{post.creative_angle}</dd>
                </>
              )}
              {post.trend_hashtag && (
                <>
                  <dt className="text-xs text-slate-400">Trend Hashtag</dt>
                  <dd className="text-sm font-medium text-brand">{post.trend_hashtag}</dd>
                </>
              )}
              {post.trend_data && Object.keys(post.trend_data).length > 0 && (
                <>
                  <dt className="text-xs text-slate-400 col-span-2 mt-1 pt-2 border-t border-slate-100 font-semibold">Trend Signals</dt>
                  {post.trend_data.platform && (
                    <>
                      <dt className="text-xs text-slate-400">Trending on</dt>
                      <dd className="text-sm text-slate-700 capitalize">{post.trend_data.platform}</dd>
                    </>
                  )}
                  {post.trend_data.volume && (
                    <>
                      <dt className="text-xs text-slate-400">Volume</dt>
                      <dd className="text-sm text-slate-700">{String(post.trend_data.volume)}</dd>
                    </>
                  )}
                  {post.trend_data.context && (
                    <>
                      <dt className="text-xs text-slate-400">Context</dt>
                      <dd className="text-sm text-slate-700 col-span-1">{post.trend_data.context}</dd>
                    </>
                  )}
                  {post.trend_data.city_hint && (
                    <>
                      <dt className="text-xs text-slate-400">City</dt>
                      <dd className="text-sm text-slate-700">{post.trend_data.city_hint}</dd>
                    </>
                  )}
                  {post.trend_data.creative_hook && (
                    <>
                      <dt className="text-xs text-slate-400">Creative Hook</dt>
                      <dd className="text-sm text-slate-600 italic">"{post.trend_data.creative_hook}"</dd>
                    </>
                  )}
                </>
              )}
              {post.media_format && (
                <>
                  <dt className="text-xs text-slate-400">Media Format</dt>
                  <dd className="text-sm text-slate-800">{post.media_format}</dd>
                </>
              )}
              {post.run_id && (
                <>
                  <dt className="text-xs text-slate-400">Run ID</dt>
                  <dd className="text-sm font-mono">
                    <Link to={`/runs/${post.run_id}`} className="text-brand hover:underline">
                      {post.run_id.slice(0, 16)}…
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {/* Internal links */}
          {post.internal_links && post.internal_links.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Links</h3>
              <ul className="space-y-2">
                {post.internal_links.map((link, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                      {link.page_type ?? 'link'}
                    </span>
                    <a href={link.url} target="_blank" rel="noopener noreferrer"
                      className="text-brand hover:underline truncate">
                      {link.anchor_text || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

            </>
          )}
        </div>

        {/* ── RIGHT: QA + metrics + feedback ──────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* QA Analysis */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">QA Analysis</h3>

            {/* Decision */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                post.qa_decision === 'publish' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {post.qa_decision === 'publish' ? '✓ Approved by QA' : '✕ Rejected by QA'}
              </span>
              {post.qa_safety_passed != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  post.qa_safety_passed ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  Safety {post.qa_safety_passed ? 'pass' : 'FAIL'}
                </span>
              )}
            </div>

            {/* Rejection reasons */}
            {post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700">Rejection Reasons</p>
                <ul className="space-y-0.5">
                  {post.qa_rejection_reasons.map((r, i) => (
                    <li key={i} className="text-xs text-red-600 flex gap-1">
                      <span className="shrink-0">•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dimension scores — aggregate */}
            <div className="space-y-3">
              <ScoreBar label="Overall Quality" value={post.qa_overall} />
              <ScoreBar label="RE Relevance" value={post.qa_re_relevance} />
              <ScoreBar label="Brand Voice" value={post.qa_brand_voice} />
              <ScoreBar label="Backlink / CTA" value={post.qa_backlink_score} />
            </div>

            {/* Per-platform dimension breakdown */}
            {post.qa_quality_dimensions && Object.keys(post.qa_quality_dimensions).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Per-dimension</p>
                <div className="space-y-2">
                  {Object.entries(post.qa_quality_dimensions)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dim, score]) => (
                      <ScoreBar
                        key={dim}
                        label={dim.replace(/_/g, ' ')}
                        value={typeof score === 'number' ? score : undefined}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* QA critique */}
            {post.qa_critique && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700">QA Critique</p>
                <p className="text-xs text-amber-800 leading-relaxed">{post.qa_critique}</p>
              </div>
            )}
          </div>

          {/* Predicted Performance */}
          {post.pred_engagement_rate != null && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Predicted Performance</h3>
                {post.pred_confidence != null && (
                  <span className="text-xs text-slate-400">
                    {(post.pred_confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Engagement Rate"
                  value={`${((post.pred_engagement_rate ?? 0) * 100).toFixed(2)}%`} />
                {post.pred_impressions != null && (
                  <MetricCard label="Impressions"
                    value={post.pred_impressions >= 1000
                      ? `${(post.pred_impressions / 1000).toFixed(1)}K`
                      : String(post.pred_impressions)} />
                )}
                {post.pred_likes != null && (
                  <MetricCard label="Likes" value={String(post.pred_likes)} />
                )}
                {post.pred_shares != null && (
                  <MetricCard label="Shares" value={String(post.pred_shares)} />
                )}
                {post.pred_comments != null && (
                  <MetricCard label="Comments" value={String(post.pred_comments)} />
                )}
                {post.pred_ctr != null && (
                  <MetricCard label="CTR"
                    value={`${((post.pred_ctr ?? 0) * 100).toFixed(2)}%`} />
                )}
              </div>
              {post.engagement_reasoning && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700">Why these numbers?</p>
                  <p className="text-xs text-blue-800 leading-relaxed">{post.engagement_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Actual Performance */}
          {hasActuals && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actual Performance</h3>

              {/* 6h metrics */}
              {(post.actual_impressions_6h != null || post.actual_likes_6h != null) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">6 hours</p>
                  <div className="grid grid-cols-2 gap-2">
                    {post.actual_impressions_6h != null && (
                      <MetricCard label="Impressions" value={post.actual_impressions_6h.toLocaleString()} />
                    )}
                    {post.actual_likes_6h != null && (
                      <MetricCard label="Likes" value={String(post.actual_likes_6h)} />
                    )}
                  </div>
                </div>
              )}

              {/* 24h metrics */}
              {(post.actual_impressions_24h != null || post.actual_likes_24h != null ||
                post.actual_shares_24h != null || post.actual_comments_24h != null ||
                post.actual_ctr_24h != null || post.actual_saves_24h != null) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">24 hours</p>
                  <div className="grid grid-cols-2 gap-2">
                    {post.actual_impressions_24h != null && (
                      <MetricCard label="Impressions" value={post.actual_impressions_24h.toLocaleString()} />
                    )}
                    {post.actual_likes_24h != null && (
                      <MetricCard label="Likes" value={String(post.actual_likes_24h)} />
                    )}
                    {post.actual_shares_24h != null && (
                      <MetricCard label="Shares" value={String(post.actual_shares_24h)} />
                    )}
                    {post.actual_comments_24h != null && (
                      <MetricCard label="Comments" value={String(post.actual_comments_24h)} />
                    )}
                    {post.actual_saves_24h != null && (
                      <MetricCard label="Saves" value={String(post.actual_saves_24h)} />
                    )}
                    {post.actual_ctr_24h != null && (
                      <MetricCard label="CTR" value={`${(post.actual_ctr_24h * 100).toFixed(2)}%`} />
                    )}
                  </div>
                </div>
              )}

              {/* 7d metrics */}
              {(post.actual_impressions_7d != null || post.actual_engagement_7d != null) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">7 days</p>
                  <div className="grid grid-cols-2 gap-2">
                    {post.actual_impressions_7d != null && (
                      <MetricCard label="Impressions" value={post.actual_impressions_7d.toLocaleString()} />
                    )}
                    {post.actual_engagement_7d != null && (
                      <MetricCard
                        label="Engagement Rate"
                        value={`${(post.actual_engagement_7d * 100).toFixed(2)}%`}
                        sub={post.pred_engagement_rate != null
                          ? `pred ${(post.pred_engagement_rate * 100).toFixed(2)}%`
                          : undefined}
                      />
                    )}
                  </div>
                  {post.actual_engagement_7d != null && post.pred_engagement_rate != null && (
                    <div className={`text-xs font-medium px-3 py-2 rounded-lg ${
                      post.actual_engagement_7d >= post.pred_engagement_rate
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {post.actual_engagement_7d >= post.pred_engagement_rate ? '▲ Beat prediction' : '▼ Below prediction'}{' '}
                      by {Math.abs((post.actual_engagement_7d - post.pred_engagement_rate) * 100).toFixed(2)}pp
                    </div>
                  )}
                </div>
              )}

              {/* Bonus metrics */}
              {(post.actual_housing_traffic != null || post.prediction_accuracy != null) && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {post.actual_housing_traffic != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Housing.com Traffic</span>
                      <span className="font-medium">{post.actual_housing_traffic.toLocaleString()}</span>
                    </div>
                  )}
                  {post.prediction_accuracy != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Prediction Accuracy</span>
                      <span className="font-medium">{(post.prediction_accuracy * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Feedback */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your Feedback</h3>

            <StarRating value={post.user_rating} onChange={(v) => feedbackMut.mutate({ rating: v })} />

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(post.user_tags ?? []).map((tag) => (
                <span key={tag} className="text-xs bg-brand-50 text-brand px-2 py-0.5 rounded-full">{tag}</span>
              ))}
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      feedbackMut.mutate({ tags: [...(post.user_tags ?? []), tagInput.trim()] })
                      setTagInput('')
                    }
                  }}
                  placeholder="+ tag" className="text-xs border border-slate-200 rounded px-2 py-0.5 w-20 focus:outline-none focus:border-brand" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {(['approved', 'flagged'] as const).map((action) => (
                <button key={action} onClick={() => feedbackMut.mutate({ action })}
                  className={`flex-1 text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors ${
                    post.user_action === action
                      ? action === 'approved' ? 'bg-green-600 text-white border-green-600'
                        : 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  {action === 'approved' ? '✓ Approve' : '⚠ Flag'}
                </button>
              ))}
              <button onClick={() => setShowReject((v) => !v)}
                className={`flex-1 text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors ${
                  post.user_action === 'rejected'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}>
                ✕ Reject
              </button>
            </div>

            {showReject && (
              <div className="space-y-2">
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason..." rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-red-400" />
                <div className="flex gap-2">
                  <button onClick={() => rejectMut.mutate(rejectReason)} disabled={!rejectReason.trim()}
                    className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                    Confirm
                  </button>
                  <button onClick={() => setShowReject(false)}
                    className="text-xs bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}

            {post.user_action === 'rejected' && post.rejection_reason && (
              <p className="text-xs text-orange-600 italic bg-orange-50 rounded px-2 py-1.5">
                ✎ {post.rejection_reason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Run Details ─────────────────────────────────────────────────── */}
      {post.run_id && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Run Details</h2>

          {/* Run header */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Link to={`/runs/${post.run_id}`}
                className="font-mono text-sm text-brand hover:underline">{post.run_id}</Link>
              {run?.status && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  run.status === 'completed' ? 'bg-green-100 text-green-700'
                    : run.status === 'failed' ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>{run.status}</span>
              )}
              {run?.dry_run && (
                <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">dry run</span>
              )}
              {run?.triggered_at && (
                <span className="text-xs text-slate-400">
                  {new Date(run.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              )}
              {run?.topic_hint && (
                <span className="text-sm text-slate-500 italic">"{run.topic_hint}"</span>
              )}
            </div>

            {/* Pipeline steps */}
            {runQ.isLoading ? (
              <p className="text-slate-400 text-sm">Loading run data…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {PIPELINE_STEPS.map(({ label, val }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${
                    val > 0
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <span className="font-semibold">{val > 0 ? val : '—'}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {run?.error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <span className="font-semibold">Error: </span>{run.error}
              </div>
            )}
          </div>

          {/* Event log (collapsible) */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <button
              onClick={() => setShowLog((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <span className="text-xs font-semibold">
                Run Log
                {run?.events?.length ? ` (${run.events.length} events)` : ''}
              </span>
              <span className="text-slate-500 text-xs">{showLog ? '▲ collapse' : '▼ expand'}</span>
            </button>

            {showLog && (
              <div ref={logRef} className="h-80 overflow-y-auto font-mono text-xs p-4 space-y-0.5 border-t border-slate-700">
                {!run?.events?.length ? (
                  <span className="text-slate-500">No events captured for this run.</span>
                ) : (
                  run.events.map((ev, i) => (
                    <div key={i} className="flex gap-2 leading-5">
                      <span className="text-slate-600 flex-shrink-0 w-20">{formatTs(ev.ts)}</span>
                      <span className={`flex-shrink-0 w-8 font-bold ${LEVEL_COLOR[ev.level] ?? 'text-slate-400'}`}>
                        {ev.level[0]}
                      </span>
                      <span className="text-slate-500 flex-shrink-0 w-28 truncate">{ev.logger}</span>
                      <span className="text-slate-200 break-all">{ev.msg}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Output File ─────────────────────────────────────────────────── */}
      {post.output_path && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowOutput((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-slate-700">Raw Output File</span>
              <span className="ml-2 text-xs text-slate-400 font-mono">{post.output_path}</span>
            </div>
            <span className="text-slate-400 text-xs">{showOutput ? '▲ collapse' : '▼ expand'}</span>
          </button>

          {showOutput && (
            <div className="border-t border-slate-100 p-5">
              {outputQ.isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
              {outputQ.data ? (
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {outputQ.data}
                </pre>
              ) : outputQ.isFetched && !outputQ.data ? (
                <p className="text-slate-400 text-sm">File not available (server may have restarted).</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
