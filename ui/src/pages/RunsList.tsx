import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRuns } from '../lib/api'

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  taken_down: 'bg-red-100 text-red-700',
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n) }
  add(1)
  if (page > 3) pages.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i)
  if (page < totalPages - 2) pages.push('...')
  if (totalPages > 1) add(totalPages)
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors">‹</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="text-sm px-1.5 text-slate-400">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)}
            className={`text-sm min-w-[2rem] px-2 py-1.5 rounded-lg border transition-colors ${
              p === page
                ? 'bg-brand text-white border-brand font-semibold'
                : 'border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}>{p}</button>
        )
      )}
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors">›</button>
    </div>
  )
}

const STATUSES = ['', 'running', 'completed', 'failed']
const PAGE_SIZE = 15

export default function RunsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter = searchParams.get('status') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) { next.set(key, value) } else { next.delete(key) }
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

  const runsQ = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
    refetchInterval: 15_000,
  })
  const allRuns = runsQ.data ?? []

  const filtered = useMemo(() => {
    let runs = allRuns
    if (statusFilter) runs = runs.filter((r) => r.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      runs = runs.filter(
        (r) => r.run_id.toLowerCase().includes(q) || (r.error ?? '').toLowerCase().includes(q)
      )
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      runs = runs.filter((r) => r.triggered_at && new Date(r.triggered_at).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000
      runs = runs.filter((r) => r.triggered_at && new Date(r.triggered_at).getTime() < to)
    }
    return runs
  }, [allRuns, statusFilter, search, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasFilters = statusFilter || dateFrom || dateTo || search

  const clearFilters = () => setSearchParams({})

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setParam('status', e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s || 'All Status'}</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            placeholder="Search run ID..."
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand flex-1 min-w-40"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setParam('date_from', e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">To</label>
            <input type="date" value={dateTo} onChange={(e) => setParam('date_to', e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 underline">
              Clear all
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {runsQ.isLoading ? 'Loading...' : `${filtered.length} run${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {runsQ.isLoading ? (
          <div className="p-6 text-slate-400 text-sm">Loading runs...</div>
        ) : paginated.length === 0 ? (
          <div className="p-6 text-slate-400 text-sm">No runs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs bg-slate-50">
                  <th className="text-left px-5 py-3">Run ID</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-right px-3 py-3">Research</th>
                  <th className="text-right px-3 py-3">Trends</th>
                  <th className="text-right px-3 py-3">Drafts</th>
                  <th className="text-right px-3 py-3">Approved</th>
                  <th className="text-right px-5 py-3">Triggered</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((run) => (
                  <tr
                    key={run.run_id}
                    onClick={() => navigate(`/runs/${run.run_id}`)}
                    className="border-b border-slate-50 hover:bg-brand-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">
                      {run.run_id}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[run.status] ?? 'bg-slate-100 text-slate-600'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-500">{run.research_count || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{run.trends_count || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{run.drafts_count || '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-medium ${run.posts_approved > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        {run.posts_approved}
                      </span>
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

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}
