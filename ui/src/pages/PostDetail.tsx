import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPost, getRunDetail, submitFeedback, rejectPost, updatePost, uploadPostMedia, publishPost } from '../lib/api'
import { useMobile } from '../lib/useMobile'

// ── Design tokens ─────────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
}

const glassEdit: React.CSSProperties = {
  background: 'rgba(139,92,246,0.04)',
  border: '2px solid rgba(139,92,246,0.35)',
  borderRadius: 16,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
  fontFamily: 'monospace',
}

const PLATFORM_STYLE: Record<string, React.CSSProperties> = {
  twitter:      { background: 'rgba(56,189,248,0.08)',  color: '#7dd3fc',  border: '1px solid rgba(56,189,248,0.18)' },
  instagram:    { background: 'rgba(244,114,182,0.08)', color: '#f9a8d4',  border: '1px solid rgba(244,114,182,0.18)' },
  housing_news: { background: 'rgba(52,211,153,0.08)',  color: '#6ee7b7',  border: '1px solid rgba(52,211,153,0.18)' },
  youtube:      { background: 'rgba(248,113,113,0.08)', color: '#fca5a5',  border: '1px solid rgba(248,113,113,0.18)' },
  linkedin:     { background: 'rgba(96,165,250,0.08)',  color: '#93c5fd',  border: '1px solid rgba(96,165,250,0.18)' },
}

const LEVEL_COLOR: Record<string, string> = {
  DEBUG: '#64748b',
  INFO: '#34d399',
  WARNING: '#fbbf24',
  ERROR: '#f87171',
  CRITICAL: '#ef4444',
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 13,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 999,
}

function renderContent(content: string) {
  return content.split(/(\[[^\]]+\]\([^)]+\))/).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (m) {
      const safeSrc = /^https?:\/\//i.test(m[2]) ? m[2] : '#'
      return (
        <a key={i} href={safeSrc} target="_blank" rel="noopener noreferrer"
          style={{ color: '#818CF8', textDecoration: 'underline' }}>{m[1]}</a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function ScoreBar({ label, value, max = 10 }: { label: string; value?: number; max?: number }) {
  if (value == null) return null
  const pct = Math.min(100, (value / max) * 100)
  const barColor = value >= 7 ? 'rgba(52,211,153,0.55)' : value >= 5 ? 'rgba(251,191,36,0.55)' : 'rgba(248,113,113,0.55)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{value.toFixed(1)}<span style={{ color: '#64748b', fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: barColor, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

function StarRating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: 0, transition: 'color 0.15s',
            color: star <= (value ?? 0) ? '#fbbf24' : 'rgba(255,255,255,0.15)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = star <= (value ?? 0) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}
        >★</button>
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
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      minHeight: 36, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
      padding: '6px 8px', background: 'rgba(255,255,255,0.03)',
    }}>
      {tags.map((tag) => (
        <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: 'rgba(129,140,248,0.15)', color: '#818CF8', borderRadius: 999, padding: '2px 8px' }}>
          #{tag}
          <button onClick={() => onChange(tags.filter((t) => t !== tag))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', fontSize: 14, lineHeight: 1, padding: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#818CF8' }}
          >×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="Add hashtag…"
        style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#f1f5f9', flex: 1, minWidth: 80 }}
      />
    </div>
  )
}

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isMobile = useMobile()
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

  if (postQ.isLoading) return <div style={{ color: '#64748b', fontSize: 13, padding: 24 }}>Loading post…</div>
  if (!post) return (
    <div style={{ color: '#f87171', fontSize: 13, padding: 24 }}>
      Post not found. <Link to="/dashboard/posts" style={{ color: '#818CF8' }}>← Back to Posts</Link>
    </div>
  )

  const rawMedia = post.media_urls?.[0]
  const imageUrl = !imgError && rawMedia
    ? (rawMedia.startsWith('http') ? rawMedia : `/${rawMedia}`)
    : null
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '100%' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)}
          style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#818CF8' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
        >← Back</button>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
        <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{post.post_id.slice(0, 12)}…</span>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ ...badge, ...(PLATFORM_STYLE[post.platform] ?? { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }) }}>
          {post.platform}
        </span>
        {post.draft_type && (
          <span style={{ ...badge, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>{post.draft_type}</span>
        )}
        {post.post_status === 'published' && (
          <span style={{ ...badge, background: 'rgba(52,211,153,0.08)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.18)' }}>Published</span>
        )}
        {post.post_status === 'draft' && (
          <span style={{ ...badge, background: 'rgba(251,191,36,0.08)', color: '#d4a855', border: '1px solid rgba(251,191,36,0.18)' }}>Draft — Awaiting Review</span>
        )}
        {post.post_status === 'qa_rejected' && (
          <span style={{ ...badge, background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.18)' }}>QA Rejected</span>
        )}
        {post.qa_decision === 'advisory' && (
          <span style={{ ...badge, background: 'rgba(56,189,248,0.08)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.18)' }} title="QA ran in advisory mode — quality scores are guidance only">QA Advisory</span>
        )}
        {post.user_action && (
          <span style={{ ...badge, background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>✎ {post.user_action}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {post.published_at
              ? new Date(post.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : ''}
          </span>
          {post.post_status === 'draft' && !isEditing && (
            <button
              onClick={() => { if (confirm('Publish this draft now?')) publishMut.mutate() }}
              disabled={publishMut.isPending}
              style={{ fontSize: 13, fontWeight: 500, background: 'rgba(52,211,153,0.08)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', opacity: publishMut.isPending ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {publishMut.isPending ? 'Publishing…' : '↑ Publish'}
            </button>
          )}
          {publishMut.isError && (
            <span style={{ fontSize: 12, color: '#f87171' }}>{(publishMut.error as Error).message}</span>
          )}
          {!isEditing ? (
            <button onClick={enterEdit}
              style={{ fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✎ Edit
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setIsEditing(false)}
                style={{ fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={updateMut.isPending}
                style={{ fontSize: 13, fontWeight: 500, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', opacity: updateMut.isPending ? 0.5 : 1 }}>
                {updateMut.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,3fr) minmax(0,2fr)', gap: 24 }}>

        {/* ── LEFT ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── EDIT MODE ─────────────────────────────────────────────── */}
          {isEditing ? (
            <div style={{ ...glassEdit, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Editing Post</h3>

              {/* Image / media */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Image / Media</label>

                {editMediaUrls.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editMediaUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}
                        onMouseEnter={(e) => { const btn = e.currentTarget.querySelector('button') as HTMLButtonElement | null; if (btn) btn.style.opacity = '1' }}
                        onMouseLeave={(e) => { const btn = e.currentTarget.querySelector('button') as HTMLButtonElement | null; if (btn) btn.style.opacity = '0' }}
                      >
                        <img src={`/${url}`} alt="media"
                          style={{ width: '100%', maxHeight: 256, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }} />
                        <button
                          onClick={() => setEditMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: 8, right: 8, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: 14 }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload drop zone */}
                <div
                  style={{ border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.5)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
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
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                      e.target.value = ''
                    }}
                  />
                  {isUploading ? (
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Uploading…</p>
                  ) : (
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Drop image here or <span style={{ color: '#818CF8', textDecoration: 'underline' }}>browse</span><br />
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>JPG, PNG, GIF, WebP, MP4 — max 20 MB</span>
                    </p>
                  )}
                </div>
                {uploadError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{uploadError}</p>}

                <div style={{ display: 'flex', gap: 8 }}>
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
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
                  Post Content
                  <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400 }}>{editContent.length} chars</span>
                  {post.platform === 'twitter' && editContent.length > 280 && (
                    <span style={{ marginLeft: 4, color: '#f87171' }}>· over 280</span>
                  )}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  style={textareaStyle}
                />
              </div>

              {/* Hashtags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Hashtags</label>
                <TagEditor tags={editHashtags} onChange={setEditHashtags} />
              </div>

              {/* Image card text */}
              {(post.zomato_hook || post.draft_type === 'social') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Image Card Text</label>
                  <textarea
                    value={editHook}
                    onChange={(e) => setEditHook(e.target.value)}
                    rows={2}
                    placeholder="Short punchy text for the visual card…"
                    style={{ ...textareaStyle, resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>
              )}

              {updateMut.isError && (
                <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>
                  Save failed: {String(updateMut.error)}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveEdit} disabled={updateMut.isPending}
                  style={{ flex: 1, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer', opacity: updateMut.isPending ? 0.5 : 1 }}>
                  {updateMut.isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => setIsEditing(false)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 14, fontWeight: 500, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Post output */}
              <div style={{ ...glass, overflow: 'hidden' }}>
                {imageUrl && (
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)' }}>
                    <img src={imageUrl} alt="Post creative" onError={() => setImgError(true)}
                      style={{ width: '100%', maxHeight: 384, objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Post Content</h3>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 14, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
                      {renderContent(post.content)}
                    </p>
                    {post.hashtags?.length > 0 && (
                      <p style={{ fontSize: 14, color: '#818CF8', lineHeight: 1.7, margin: 0 }}>
                        {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                      </p>
                    )}
                  </div>
                  {post.published_url && post.published_url !== 'dry_run' && (
                    <a href={post.published_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#818CF8', wordBreak: 'break-all' }}>
                      ↗ {post.published_url}
                    </a>
                  )}
                  {post.published_url === 'dry_run' && (
                    <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>dry run — not published live</span>
                  )}
                </div>
              </div>

              {/* Card text */}
              {post.zomato_hook && (
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Image Card Text</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.4, margin: 0 }}>{post.zomato_hook}</p>
                </div>
              )}

              {/* Creative context */}
              <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Creative Context</h3>
                <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,auto) 1fr', gap: '10px 16px', margin: 0 }}>
                  {post.source_topic && (
                    <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Source / Trigger</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{post.source_topic}</dd></>
                  )}
                  {post.creative_angle && (
                    <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Creative Angle</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{post.creative_angle}</dd></>
                  )}
                  {post.trend_hashtag && (
                    <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Trend Hashtag</dt><dd style={{ fontSize: 13, fontWeight: 500, color: '#818CF8', margin: 0, gridColumn: '2' }}>{post.trend_hashtag}</dd></>
                  )}
                  {post.trend_data && Object.keys(post.trend_data).length > 0 && (
                    <>
                      <dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1 / -1', marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontWeight: 600 }}>Trend Signals</dt>
                      {post.trend_data.platform && (
                        <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Trending on</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, textTransform: 'capitalize', gridColumn: '2' }}>{post.trend_data.platform}</dd></>
                      )}
                      {post.trend_data.volume && (
                        <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Volume</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{String(post.trend_data.volume)}</dd></>
                      )}
                      {post.trend_data.context && (
                        <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Context</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{post.trend_data.context}</dd></>
                      )}
                      {post.trend_data.city_hint && (
                        <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>City</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{post.trend_data.city_hint}</dd></>
                      )}
                      {post.trend_data.creative_hook && (
                        <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Creative Hook</dt><dd style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: 0, gridColumn: '2' }}>"{post.trend_data.creative_hook}"</dd></>
                      )}
                    </>
                  )}
                  {post.media_format && (
                    <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Media Format</dt><dd style={{ fontSize: 13, color: '#e2e8f0', margin: 0, gridColumn: '2' }}>{post.media_format}</dd></>
                  )}
                  {post.run_id && (
                    <><dt style={{ fontSize: 11, color: '#64748b', gridColumn: '1' }}>Run ID</dt><dd style={{ fontSize: 13, fontFamily: 'monospace', margin: 0, gridColumn: '2' }}>
                      <Link to={`/dashboard/runs/${post.run_id}`} style={{ color: '#818CF8', textDecoration: 'none' }}>
                        {post.run_id.slice(0, 16)}…
                      </Link>
                    </dd></>
                  )}
                </dl>
              </div>

              {/* Internal links */}
              {post.internal_links && post.internal_links.length > 0 && (
                <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Internal Links</h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {post.internal_links.map((link, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 6, padding: '2px 6px' }}>
                          {link.page_type ?? 'link'}
                        </span>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#818CF8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* ── RIGHT ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* QA Analysis */}
          <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>QA Analysis</h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                ...(post.qa_decision === 'publish'
                  ? { background: 'rgba(52,211,153,0.08)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.2)' }
                  : { background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.2)' }),
              }}>
                {post.qa_decision === 'publish' ? '✓ Approved by QA' : '✕ Rejected by QA'}
              </span>
              {post.qa_safety_passed != null && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  ...(post.qa_safety_passed
                    ? { background: 'rgba(52,211,153,0.06)', color: '#6ee7b7' }
                    : { background: 'rgba(248,113,113,0.06)', color: '#fca5a5' }),
                }}>
                  Safety {post.qa_safety_passed ? 'pass' : 'FAIL'}
                </span>
              )}
            </div>

            {post.qa_rejection_reasons && post.qa_rejection_reasons.length > 0 && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5', margin: '0 0 6px' }}>Rejection Reasons</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {post.qa_rejection_reasons.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#fca5a5', display: 'flex', gap: 4 }}>
                      <span>•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ScoreBar label="Overall Quality" value={post.qa_overall} />
              <ScoreBar label="RE Relevance" value={post.qa_re_relevance} />
              <ScoreBar label="Brand Voice" value={post.qa_brand_voice} />
              <ScoreBar label="Backlink / CTA" value={post.qa_backlink_score} />
            </div>

            {post.qa_quality_dimensions && Object.keys(post.qa_quality_dimensions).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Per-dimension</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

            {post.qa_critique && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 4px' }}>QA Critique</p>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{post.qa_critique}</p>
              </div>
            )}
          </div>

          {/* Predicted Performance */}
          {post.pred_engagement_rate != null && (
            <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Predicted Performance</h3>
                {post.pred_confidence != null && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {(post.pred_confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Why these numbers?</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{post.engagement_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Actual Performance */}
          {hasActuals && (
            <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Actual Performance</h3>

              {(post.actual_impressions_6h != null || post.actual_likes_6h != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>6 hours</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {post.actual_impressions_6h != null && (
                      <MetricCard label="Impressions" value={post.actual_impressions_6h.toLocaleString()} />
                    )}
                    {post.actual_likes_6h != null && (
                      <MetricCard label="Likes" value={String(post.actual_likes_6h)} />
                    )}
                  </div>
                </div>
              )}

              {(post.actual_impressions_24h != null || post.actual_likes_24h != null ||
                post.actual_shares_24h != null || post.actual_comments_24h != null ||
                post.actual_ctr_24h != null || post.actual_saves_24h != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>24 hours</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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

              {(post.actual_impressions_7d != null || post.actual_engagement_7d != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>7 days</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                    <div style={{
                      fontSize: 12, fontWeight: 500, padding: '8px 12px', borderRadius: 10,
                      ...(post.actual_engagement_7d >= post.pred_engagement_rate
                        ? { background: 'rgba(52,211,153,0.06)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.15)' }
                        : { background: 'rgba(248,113,113,0.06)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.15)' }),
                    }}>
                      {post.actual_engagement_7d >= post.pred_engagement_rate ? '▲ Beat prediction' : '▼ Below prediction'}{' '}
                      by {Math.abs((post.actual_engagement_7d - post.pred_engagement_rate) * 100).toFixed(2)}pp
                    </div>
                  )}
                </div>
              )}

              {(post.actual_housing_traffic != null || post.prediction_accuracy != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {post.actual_housing_traffic != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#94a3b8' }}>Platform Traffic</span>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{post.actual_housing_traffic.toLocaleString()}</span>
                    </div>
                  )}
                  {post.prediction_accuracy != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#94a3b8' }}>Prediction Accuracy</span>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{(post.prediction_accuracy * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Feedback */}
          <div style={{ ...glass, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Your Feedback</h3>

            <StarRating value={post.user_rating} onChange={(v) => feedbackMut.mutate({ rating: v })} />

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {(post.user_tags ?? []).map((tag) => (
                <span key={tag} style={{ fontSize: 12, background: 'rgba(129,140,248,0.12)', color: '#818CF8', padding: '2px 8px', borderRadius: 999 }}>{tag}</span>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      feedbackMut.mutate({ tags: [...(post.user_tags ?? []), tagInput.trim()] })
                      setTagInput('')
                    }
                  }}
                  placeholder="+ tag"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#f1f5f9', fontSize: 12, padding: '2px 8px', outline: 'none', width: 64 }} />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['approved', 'flagged'] as const).map((action) => (
                <button key={action} onClick={() => feedbackMut.mutate({ action })}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 500, borderRadius: 8, padding: '7px 4px', cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                    ...(post.user_action === action
                      ? action === 'approved'
                        ? { background: 'rgba(52,211,153,0.1)', color: '#6ee7b7', borderColor: 'rgba(52,211,153,0.25)' }
                        : { background: 'rgba(251,191,36,0.1)', color: '#d4a855', borderColor: 'rgba(251,191,36,0.25)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }),
                  }}>
                  {action === 'approved' ? '✓ Approve' : '⚠ Flag'}
                </button>
              ))}
              <button onClick={() => setShowReject((v) => !v)}
                style={{
                  flex: 1, fontSize: 12, fontWeight: 500, borderRadius: 8, padding: '7px 4px', cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                  ...(post.user_action === 'rejected'
                    ? { background: 'rgba(248,113,113,0.1)', color: '#fca5a5', borderColor: 'rgba(248,113,113,0.25)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }),
                }}>
                ✕ Reject
              </button>
            </div>

            {showReject && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason..." rows={2}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f1f5f9', fontSize: 12, padding: 8, resize: 'none', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => rejectMut.mutate(rejectReason)} disabled={!rejectReason.trim()}
                    style={{ fontSize: 12, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', opacity: rejectReason.trim() ? 1 : 0.5 }}>
                    Confirm
                  </button>
                  <button onClick={() => setShowReject(false)}
                    style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {post.user_action === 'rejected' && post.rejection_reason && (
              <p style={{ fontSize: 12, color: '#fb923c', fontStyle: 'italic', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '6px 10px', margin: 0 }}>
                ✎ {post.rejection_reason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Run Details ──────────────────────────────────────────────── */}
      {post.run_id && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Run Details</h2>

          {/* Run header */}
          <div style={{ ...glass, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Link to={`/dashboard/runs/${post.run_id}`}
                style={{ fontFamily: 'monospace', fontSize: 13, color: '#818CF8', textDecoration: 'none' }}>{post.run_id}</Link>
              {run?.status && (
                <span style={{
                  fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                  ...(run.status === 'completed'
                    ? { background: 'rgba(52,211,153,0.08)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.18)' }
                    : run.status === 'failed'
                    ? { background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.18)' }
                    : { background: 'rgba(96,165,250,0.08)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.18)' }),
                }}>{run.status}</span>
              )}
              {run?.dry_run && (
                <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 999, padding: '2px 8px' }}>dry run</span>
              )}
              {run?.triggered_at && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {new Date(run.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              )}
              {run?.topic_hint && (
                <span style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>"{run.topic_hint}"</span>
              )}
            </div>

            {runQ.isLoading ? (
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Loading run data…</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PIPELINE_STEPS.map(({ label, val }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '8px 12px', fontSize: 12, border: '1px solid',
                    ...(val > 0
                      ? { background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }
                      : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)', color: '#64748b' }),
                  }}>
                    <span style={{ fontWeight: 700 }}>{val > 0 ? val : '—'}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {run?.error && (
              <div style={{ marginTop: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#f87171' }}>
                <span style={{ fontWeight: 600 }}>Error: </span>{run.error}
              </div>
            )}
          </div>

          {/* Event log (collapsible) */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <button
              onClick={() => setShowLog((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                Run Log
                {run?.events?.length ? ` (${run.events.length} events)` : ''}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{showLog ? '▲ collapse' : '▼ expand'}</span>
            </button>

            {showLog && (
              <div ref={logRef} style={{ height: 320, overflow: 'auto', fontFamily: 'monospace', fontSize: 11, padding: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ minWidth: 480, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {!run?.events?.length ? (
                  <span style={{ color: '#64748b' }}>No events captured for this run.</span>
                ) : (
                  run.events.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
                      <span style={{ color: '#475569', flexShrink: 0, width: 72 }}>{formatTs(ev.ts)}</span>
                      <span style={{ flexShrink: 0, width: 16, fontWeight: 700, color: LEVEL_COLOR[ev.level] ?? '#64748b' }}>
                        {ev.level[0]}
                      </span>
                      <span style={{ color: '#475569', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.logger}</span>
                      <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>{ev.msg}</span>
                    </div>
                  ))
                )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Output File ──────────────────────────────────────────────── */}
      {post.output_path && (
        <div style={{ ...glass, overflow: 'hidden' }}>
          <button
            onClick={() => setShowOutput((v) => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9' }}>Raw Output File</span>
              <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.output_path}</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0, marginLeft: 12 }}>{showOutput ? '▲' : '▼'}</span>
          </button>

          {showOutput && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
              {outputQ.isLoading && <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Loading…</p>}
              {outputQ.data ? (
                <pre style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'pre-wrap', lineHeight: 1.6, overflowX: 'auto', margin: 0 }}>
                  {outputQ.data}
                </pre>
              ) : outputQ.isFetched && !outputQ.data ? (
                <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>File not available (server may have restarted).</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
