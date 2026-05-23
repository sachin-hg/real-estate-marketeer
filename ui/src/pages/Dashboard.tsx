import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { getPostStats, getRuns } from '../lib/api'

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Unknown'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  running: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' },
  completed: { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' },
  failed: { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
  taken_down: { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const statsQ = useQuery({ queryKey: ['post-stats'], queryFn: getPostStats })
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: getRuns, refetchInterval: 10_000 })

  const stats = statsQ.data
  const runs = runsQ.data ?? []

  const pendingReview = runs.filter((r) => r.status === 'running').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
        <StatCard
          label="Total Posts"
          value={statsQ.isLoading ? '…' : String(stats?.total ?? 0)}
          valueColor="#C4B5FD"
          onClick={() => navigate('/dashboard/posts')}
        />
        <StatCard
          label="Avg QA Score"
          value={statsQ.isLoading ? '…' : `${(stats?.avg_qa ?? 0).toFixed(1)} / 10`}
          valueColor="#34d399"
        />
        <StatCard
          label="Avg Predicted ER"
          value={statsQ.isLoading ? '…' : `${((stats?.avg_pred_er ?? 0) * 100).toFixed(2)}%`}
          valueColor="#38BDF8"
        />
        <StatCard
          label="QA Rejection Rate"
          value={statsQ.isLoading ? '…' : `${((stats?.qa_rejection_rate ?? 0) * 100).toFixed(0)}%`}
          valueColor={(stats?.qa_rejection_rate ?? 0) > 0.4 ? '#f87171' : '#94a3b8'}
          onClick={() => navigate('/dashboard/posts?post_status=qa_rejected')}
        />
        <StatCard
          label="Avg Cost / Post"
          value={statsQ.isLoading ? '…' : stats?.avg_cost_per_post != null ? `$${stats.avg_cost_per_post.toFixed(3)}` : '—'}
          sub={stats?.non_rejected_count != null ? `${stats.non_rejected_count} posts` : undefined}
          valueColor="#a78bfa"
        />
        <StatCard
          label="Active Runs"
          value={runsQ.isLoading ? '…' : String(pendingReview)}
          valueColor="#fbbf24"
          onClick={() => navigate('/dashboard/runs')}
        />
        <StatCard
          label="Analytics"
          value="View →"
          valueColor="#818CF8"
          onClick={() => navigate('/dashboard/analytics')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 24 }}>
          {/* Recent runs */}
          <div style={{ ...glass, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h2 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, margin: 0 }}>Recent Runs</h2>
              <Link to="/dashboard/runs" style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            {runsQ.isLoading ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>Loading…</div>
            ) : runs.length === 0 ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>No runs yet. Trigger one from Generate.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', color: '#64748b', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Run ID</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</th>
                      <th style={{ textAlign: 'right', padding: '10px 20px', color: '#64748b', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.slice(0, 12).map((run) => (
                      <tr
                        key={run.run_id}
                        onClick={() => navigate(`/runs/${run.run_id}`)}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(129,140,248,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '11px 20px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                          {run.run_id}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 500,
                            ...(STATUS_STYLE[run.status] ?? { background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }),
                          }}>
                            {run.status}
                          </span>
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', color: '#94a3b8' }}>
                          {run.posts_approved}
                        </td>
                        <td style={{ padding: '11px 20px', textAlign: 'right', color: '#64748b', fontSize: 11 }}>
                          {timeAgo(run.triggered_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Platform breakdown */}
          <div style={{ ...glass, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, margin: 0 }}>By Platform</h2>
              <p style={{ color: '#64748b', fontSize: 11, margin: '3px 0 0' }}>published vs. QA rejected</p>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {statsQ.isLoading ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>
              ) : !stats || Object.keys(stats.by_platform).length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>No data yet.</div>
              ) : (
                Object.entries(stats.by_platform).map(([platform, count]) => {
                  const total = stats.total || 1
                  const rejected = stats.qa_rejected_by_platform?.[platform] ?? 0
                  const rejPct = count > 0 ? Math.round((rejected / count) * 100) : 0
                  const publishedPct = Math.max(0, Math.round(((count - rejected) / total) * 100))
                  const rejectedPct = Math.max(0, Math.round((rejected / total) * 100))
                  return (
                    <div key={platform}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{platform.replace('_', ' ')}</span>
                        <span style={{ color: '#f1f5f9', fontWeight: 500 }}>
                          {count}
                          {rejected > 0 && (
                            <span style={{ marginLeft: 6, color: '#f87171', fontSize: 11 }}>({rejPct}% rejected)</span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                        <div style={{
                          width: `${publishedPct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg,#8B5CF6,#6366F1)',
                          borderRadius: rejected > 0 ? '999px 0 0 999px' : 999,
                        }} />
                        {rejected > 0 && (
                          <div style={{ width: `${rejectedPct}%`, height: '100%', background: '#f87171' }} />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {stats && (stats.by_post_status?.published || stats.by_post_status?.qa_rejected || stats.by_post_status?.draft) && (
              <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', display: 'inline-block' }} />
                  Published: {stats.by_post_status.published ?? 0}
                </span>
                {(stats.by_post_status?.draft ?? 0) > 0 && (
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', cursor: 'pointer' }}
                    onClick={() => navigate('/dashboard/posts?post_status=draft')}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                    Drafts: {stats.by_post_status.draft}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
                  QA Rejected: {stats.by_post_status.qa_rejected ?? 0}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueColor,
  sub,
  onClick,
}: {
  label: string
  value: string
  valueColor: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.borderColor = 'rgba(139,92,246,0.4)'
        el.style.boxShadow = '0 8px 24px rgba(139,92,246,0.12)'
      }}
      onMouseLeave={(e) => {
        if (!onClick) return
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.borderColor = 'rgba(255,255,255,0.09)'
        el.style.boxShadow = 'none'
      }}
    >
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
