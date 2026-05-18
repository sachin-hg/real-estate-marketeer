import { useQuery } from '@tanstack/react-query'
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
  const statsQ = useQuery({ queryKey: ['post-stats'], queryFn: getPostStats })
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: getRuns, refetchInterval: 10_000 })

  const stats = statsQ.data
  const runs = runsQ.data ?? []

  const pendingReview = runs.filter((r) => r.status === 'running').length

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Posts"
          value={statsQ.isLoading ? '...' : String(stats?.total ?? 0)}
          color="text-brand"
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
          label="Runs Running"
          value={runsQ.isLoading ? '...' : String(pendingReview)}
          color="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent runs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Recent Runs</h2>
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
                    <tr key={run.run_id} className="border-b border-slate-50 hover:bg-slate-50">
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
          </div>
          <div className="p-5 space-y-3">
            {statsQ.isLoading ? (
              <div className="text-slate-400 text-sm">Loading...</div>
            ) : !stats || Object.keys(stats.by_platform).length === 0 ? (
              <div className="text-slate-400 text-sm">No data yet.</div>
            ) : (
              Object.entries(stats.by_platform).map(([platform, count]) => {
                const total = stats.total || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={platform}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 capitalize">{platform}</span>
                      <span className="text-slate-500 font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
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
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}
