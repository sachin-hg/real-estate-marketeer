import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRuns } from '../lib/api'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  running:    { bg: 'rgba(59,130,246,0.08)',  color: '#93c5fd' },
  completed:  { bg: 'rgba(16,185,129,0.08)',  color: '#6ee7b7' },
  failed:     { bg: 'rgba(239,68,68,0.08)',   color: '#fca5a5' },
  taken_down: { bg: 'rgba(239,68,68,0.08)',   color: '#fca5a5' },
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
        style={{
          fontSize: 13,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: '#94a3b8',
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          opacity: page <= 1 ? 0.4 : 1,
        }}>‹</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} style={{ fontSize: 13, padding: '0 6px', color: '#64748b' }}>…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)}
            style={{
              fontSize: 13,
              minWidth: 32,
              padding: '6px 8px',
              borderRadius: 8,
              border: p === page ? 'none' : '1px solid rgba(255,255,255,0.12)',
              background: p === page ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'rgba(255,255,255,0.04)',
              color: p === page ? '#fff' : '#94a3b8',
              fontWeight: p === page ? 600 : 400,
              cursor: 'pointer',
            }}>{p}</button>
        )
      )}
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        style={{
          fontSize: 13,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: '#94a3b8',
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          opacity: page >= totalPages ? 0.4 : 1,
        }}>›</button>
    </div>
  )
}

const STATUSES = ['', 'running', 'completed', 'failed']
const PAGE_SIZE = 15

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f1f5f9',
  outline: 'none',
}

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
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: '14px 16px',
      }}>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setParam('status', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} style={{ background: '#0f172a' }}>{s || 'All Status'}</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            placeholder="Search run ID..."
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <div className="flex items-center gap-2">
            <label style={{ fontSize: 12, color: '#64748b' }}>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setParam('date_from', e.target.value)}
              style={inputStyle} />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ fontSize: 12, color: '#64748b' }}>To</label>
            <input type="date" value={dateTo} onChange={(e) => setParam('date_to', e.target.value)}
              style={inputStyle} />
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          )}
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
            {runsQ.isLoading ? 'Loading...' : `${filtered.length} run${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        {runsQ.isLoading ? (
          <div style={{ padding: 24, color: '#64748b', fontSize: 14 }}>Loading runs...</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 24, color: '#64748b', fontSize: 14 }}>No runs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Run ID', 'Status', 'Research', 'Trends', 'Drafts', 'Approved', 'Triggered'].map((h, idx) => (
                    <th key={h} style={{
                      textAlign: idx > 1 ? 'right' : 'left',
                      padding: idx === 0 || idx === 6 ? '10px 20px' : '10px 12px',
                      color: '#64748b',
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((run) => {
                  const st = STATUS_STYLE[run.status]
                  return (
                    <tr
                      key={run.run_id}
                      onClick={() => navigate(`/dashboard/runs/${run.run_id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 20px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                        {run.run_id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 500,
                          background: st?.bg ?? 'rgba(255,255,255,0.08)',
                          color: st?.color ?? '#94a3b8',
                        }}>
                          {run.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{run.research_count || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{run.trends_count || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{run.drafts_count || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: run.posts_approved > 0 ? '#6ee7b7' : '#64748b' }}>
                          {run.posts_approved}
                        </span>
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', color: '#64748b', fontSize: 12 }}>
                        {timeAgo(run.triggered_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}
