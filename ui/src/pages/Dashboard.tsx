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

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  taken_down: 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const statsQ = useQuery({ queryKey: ['post-stats'], queryFn: getPostStats })
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: getRuns, refetchInterval: 10_000 })

  const stats = statsQ.data
  const runs = runsQ.data ?? []

  const pendingReview = runs.filter((r) => r.status === 'running').length

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Posts"
          value={statsQ.isLoading ? '...' : String(stats?.total ?? 0)}
          color="text-brand"
          onClick={() => navigate('/posts')}
        />
        <StatCard
          label="Avg QA Score"
          value={statsQ.isLoading ? '...' : `${(stats?.avg_qa ?? 0).toFixed(1)} / 10`}
          color="text-emerald-600"
        />
        <StatCard
          label="Avg Predicted ER"
          value={
            statsQ.isLoading
              ? '...'
              : `${((stats?.avg_pred_er ?? 0) * 100).toFixed(2)}%`
          }
          color="text-sky-600"
        />
        <StatCard
          label="QA Rejection Rate"
          value={
            statsQ.isLoading
              ? '...'
              : `${((stats?.qa_rejection_rate ?? 0) * 100).toFixed(0)}%`
          }
          color={(stats?.qa_rejection_rate ?? 0) > 0.4 ? 'text-rose-600' : 'text-slate-600'}
          onClick={() => navigate('/posts?post_status=qa_rejected')}
        />
        <StatCard
          label="Avg Cost / Post"
          value={
            statsQ.isLoading
              ? '...'
              : stats?.avg_cost_per_post != null
              ? `$${stats.avg_cost_per_post.toFixed(3)}`
              : '—'
          }
          sub={stats?.non_rejected_count != null ? `${stats.non_rejected_count} posts` : undefined}
          color="text-violet-600"
        />
        <StatCard
          label="Active Runs"
          value={runsQ.isLoading ? '...' : String(pendingReview)}
          color="text-amber-600"
          onClick={() => navigate('/runs')}
        />
        <StatCard
          label="Analytics"
          value="View →"
          color="text-indigo-600"
          onClick={() => navigate('/analytics')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent runs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Recent Runs</h2>
            <Link to="/runs" className="text-xs text-brand hover:underline">View all →</Link>
          </div>
          {runsQ.isLoading ? (
            <div className="p-6 text-slate-400 text-sm">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-slate-400 text-sm">No runs yet. Trigger one from Generate.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs">
                    <th className="text-left px-5 py-3">Run ID</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-right px-3 py-3">Posts</th>
                    <th className="text-right px-5 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 12).map((run) => (
                    <tr
                      key={run.run_id}
                      onClick={() => navigate(`/runs/${run.run_id}`)}
                      className="border-b border-slate-50 hover:bg-brand-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {run.run_id}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[run.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {run.posts_approved}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400 text-xs">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">By Platform</h2>
            <p className="text-xs text-slate-400 mt-0.5">published vs. QA rejected</p>
          </div>
          <div className="p-5 space-y-3">
            {statsQ.isLoading ? (
              <div className="text-slate-400 text-sm">Loading...</div>
            ) : !stats || Object.keys(stats.by_platform).length === 0 ? (
              <div className="text-slate-400 text-sm">No data yet.</div>
            ) : (
              Object.entries(stats.by_platform).map(([platform, count]) => {
                const total = stats.total || 1
                const rejected = stats.qa_rejected_by_platform?.[platform] ?? 0
                const rejPct = count > 0 ? Math.round((rejected / count) * 100) : 0
                const publishedPct = Math.max(0, Math.round(((count - rejected) / total) * 100))
                const rejectedPct = Math.max(0, Math.round((rejected / total) * 100))
                return (
                  <div key={platform}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 capitalize">{platform.replace('_', ' ')}</span>
                      <span className="text-slate-500 font-medium">
                        {count}
                        {rejected > 0 && (
                          <span className="ml-1 text-rose-400 text-xs">({rejPct}% rejected)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-brand rounded-l-full"
                        style={{ width: `${publishedPct}%` }}
                      />
                      {rejected > 0 && (
                        <div
                          className="h-full bg-rose-300"
                          style={{ width: `${rejectedPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {stats && (stats.by_post_status?.published || stats.by_post_status?.qa_rejected || stats.by_post_status?.draft) && (
            <div className="px-5 pb-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand inline-block" />
                Published: {stats.by_post_status.published ?? 0}
              </span>
              {(stats.by_post_status?.draft ?? 0) > 0 && (
                <span className="flex items-center gap-1 cursor-pointer hover:text-amber-600" onClick={() => navigate('/posts?post_status=draft')}>
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Drafts: {stats.by_post_status.draft}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-300 inline-block" />
                QA Rejected: {stats.by_post_status.qa_rejected ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  sub,
  onClick,
}: {
  label: string
  value: string
  color: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all' : ''}`}
    >
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
