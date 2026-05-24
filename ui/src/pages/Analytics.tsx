import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine,
} from 'recharts'
import { getAnalytics } from '../lib/api'
import type { AnalyticsData } from '../lib/api'

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#0ea5e9',
  instagram: '#ec4899',
  housing_news: '#10b981',
  youtube: '#ef4444',
  linkedin: '#3b82f6',
}

type Preset = '1W' | '1M' | '3M' | '6M' | '1Y' | 'custom'
const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'custom', label: 'Custom' },
]

function presetRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  if (preset === 'custom') {
    return {
      from: customFrom || '1970-01-01',
      to: customTo || new Date().toISOString().slice(0, 10),
    }
  }
  const to = new Date()
  const from = new Date()
  if (preset === '1W') from.setDate(from.getDate() - 7)
  else if (preset === '1M') from.setMonth(from.getMonth() - 1)
  else if (preset === '3M') from.setMonth(from.getMonth() - 3)
  else if (preset === '6M') from.setMonth(from.getMonth() - 6)
  else if (preset === '1Y') from.setFullYear(from.getFullYear() - 1)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function makeTick(preset: Preset) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return (d: string) => {
    const [, m, day] = d.split('-')
    return preset === '6M' || preset === '1Y'
      ? months[parseInt(m, 10) - 1]
      : `${day}/${m}`
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

type PlatRow = AnalyticsData['platform_over_time'][number]

/** Pivot (date, platform, value) rows into { date, platform1: v, platform2: v, … } for recharts */
function pivotPlatform(
  rows: PlatRow[],
  field: keyof PlatRow,
  from: string,
  to: string,
): { data: Array<Record<string, unknown>>; platforms: string[] } {
  const filtered = rows.filter((r) => r.date >= from && r.date <= to && r[field] != null)
  const platforms = [...new Set(filtered.map((r) => r.platform))].sort()
  const map: Record<string, Record<string, unknown>> = {}
  for (const r of filtered) {
    if (!map[r.date]) map[r.date] = { date: r.date }
    map[r.date][r.platform] = r[field]
  }
  const data = Object.values(map).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )
  return { data, platforms }
}

// ── Shared UI components ─────────────────────────────────────────────────────

function DateRangePicker({
  preset, onPreset, customFrom, onCustomFrom, customTo, onCustomTo,
}: {
  preset: Preset; onPreset: (p: Preset) => void
  customFrom: string; onCustomFrom: (v: string) => void
  customTo: string; onCustomTo: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onPreset(p.key)}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            preset === p.key
              ? 'bg-brand text-white border-brand'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input type="date" value={customFrom} onChange={(e) => onCustomFrom(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
          <span className="text-slate-400 text-xs">—</span>
          <input type="date" value={customTo} onChange={(e) => onCustomTo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand" />
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700">{title}</h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ msg }: { msg?: string }) {
  return (
    <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
      {msg ?? 'No data in this date range.'}
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

/** Standard line per platform */
function PlatformLines({ platforms }: { platforms: string[] }) {
  return (
    <>
      {platforms.map((p) => (
        <Line
          key={p}
          type="monotone"
          dataKey={p}
          name={p.replace(/_/g, ' ')}
          stroke={PLATFORM_COLORS[p] ?? '#94a3b8'}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      ))}
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<Preset>('3M')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalytics })

  const { from, to } = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  )
  const tick = makeTick(preset)

  // ── Posts generated ───────────────────────────────────────────────────────
  const filteredPosts = useMemo(
    () => (data?.posts_over_time ?? []).filter((d) => d.date >= from && d.date <= to),
    [data, from, to]
  )

  // ── Cost per run (aggregated by date) ─────────────────────────────────────
  const filteredCost = useMemo(() => {
    const map: Record<string, { date: string; llm_cost: number; api_cost: number; total_cost: number }> = {}
    for (const r of data?.cost_over_time ?? []) {
      if (!r.date || r.date < from || r.date > to) continue
      if (!map[r.date]) map[r.date] = { date: r.date, llm_cost: 0, api_cost: 0, total_cost: 0 }
      map[r.date].llm_cost = +(map[r.date].llm_cost + r.llm_cost).toFixed(4)
      map[r.date].api_cost = +(map[r.date].api_cost + r.api_cost).toFixed(4)
      map[r.date].total_cost = +(map[r.date].total_cost + r.total_cost).toFixed(4)
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [data, from, to])

  // ── Platform line charts (pivoted) ────────────────────────────────────────
  const platRows = data?.platform_over_time ?? []

  const { data: platCountData, platforms: platCountPlatforms } = useMemo(
    () => pivotPlatform(platRows, 'count', from, to),
    [platRows, from, to]
  )
  const { data: qaData, platforms: qaPlatforms } = useMemo(
    () => pivotPlatform(platRows, 'avg_qa', from, to),
    [platRows, from, to]
  )
  const { data: rejData, platforms: rejPlatforms } = useMemo(
    () => pivotPlatform(platRows, 'rejection_rate', from, to),
    [platRows, from, to]
  )

  // ── Engagement rate chart: pred (solid) + actual (dashed) per platform ───
  const { erData, erPlatforms } = useMemo(() => {
    const filtered = platRows.filter((r) => r.date >= from && r.date <= to)
    const platforms = [...new Set(filtered.map((r) => r.platform))].sort()
    const map: Record<string, Record<string, unknown>> = {}
    for (const r of filtered) {
      if (!map[r.date]) map[r.date] = { date: r.date }
      if (r.avg_pred_er != null) map[r.date][`${r.platform}_pred`] = +(r.avg_pred_er * 100).toFixed(3)
      if (r.avg_actual_er != null) map[r.date][`${r.platform}_actual`] = +(r.avg_actual_er * 100).toFixed(3)
    }
    const erData = Object.values(map).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
    const hasAnyActual = filtered.some((r) => r.avg_actual_er != null)
    return { erData, erPlatforms: platforms, hasAnyActual }
  }, [platRows, from, to])

  // Scatter data (no date filter — uses all data)
  const scatterData = useMemo(
    () =>
      (data?.engagement_data ?? [])
        .filter((d) => d.actual_er != null)
        .map((d) => ({
          pred: +(d.pred_er * 100).toFixed(2),
          actual: +(d.actual_er! * 100).toFixed(2),
        })),
    [data]
  )

  if (isLoading) return <div className="text-slate-400 text-sm">Loading analytics...</div>
  if (!data) return <div className="text-slate-400 text-sm">No analytics data available.</div>

  const { platform_performance, top_posts, totals } = data

  return (
    <div className="space-y-6">
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatChip label="Total Posts" value={String(totals.total_posts)} color="text-brand" />
        <StatChip label="Avg QA Score" value={`${totals.avg_qa.toFixed(1)} / 10`} color="text-emerald-600" />
        <StatChip label="Avg Predicted ER" value={`${(totals.avg_pred_er * 100).toFixed(2)}%`} color="text-sky-600" />
        <StatChip label="Total Cost" value={`$${totals.total_cost.toFixed(3)}`} color="text-violet-600" />
      </div>

      {/* Shared date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date range</span>
        <DateRangePicker
          preset={preset} onPreset={setPreset}
          customFrom={customFrom} onCustomFrom={setCustomFrom}
          customTo={customTo} onCustomTo={setCustomTo}
        />
      </div>

      {/* ── Posts Generated ──────────────────────────────────────────────── */}
      <ChartCard title="Posts Generated" sub="daily — published vs QA rejected">
        <div className="p-5">
          {filteredPosts.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={filteredPosts} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip labelFormatter={(l: unknown) => String(l)} formatter={(v: unknown, n: unknown) => [String(v), n as string]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="published" name="Published" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="qa_rejected" name="QA Rejected" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* ── Platform Performance (posts per platform per day) ────────────── */}
      <ChartCard title="Platform Performance" sub="posts generated per platform per day">
        <div className="p-5">
          {platCountData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={platCountData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip labelFormatter={(l: unknown) => String(l)} formatter={(v: unknown, n: unknown) => [String(v), n as string]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <PlatformLines platforms={platCountPlatforms} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {platform_performance.length > 0 && (
          <div className="px-5 pb-5 overflow-x-auto border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">All-time averages</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">Platform</th>
                  <th className="text-right py-2 font-medium">Posts</th>
                  <th className="text-right py-2 font-medium">Avg QA</th>
                  <th className="text-right py-2 font-medium">Avg Pred ER</th>
                  {platform_performance.some((p) => p.avg_actual_er != null) && (
                    <th className="text-right py-2 font-medium">Avg Actual ER</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {platform_performance.sort((a, b) => b.avg_pred_er - a.avg_pred_er).map((p) => (
                  <tr key={p.platform} className="border-b border-slate-50">
                    <td className="py-1.5 font-medium capitalize" style={{ color: PLATFORM_COLORS[p.platform] ?? '#64748b' }}>
                      {p.platform.replace('_', ' ')}
                    </td>
                    <td className="py-1.5 text-right text-slate-500">{p.count}</td>
                    <td className="py-1.5 text-right text-slate-500">{p.avg_qa.toFixed(1)}</td>
                    <td className="py-1.5 text-right text-sky-600">{(p.avg_pred_er * 100).toFixed(2)}%</td>
                    {platform_performance.some((x) => x.avg_actual_er != null) && (
                      <td className="py-1.5 text-right text-green-600">
                        {p.avg_actual_er != null ? `${(p.avg_actual_er * 100).toFixed(2)}%` : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* ── Avg QA Score over time ───────────────────────────────────────── */}
      <ChartCard title="Avg QA Score" sub="daily average QA score per platform (0 – 10 scale)">
        <div className="p-5">
          {qaData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={qaData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} width={28} tickFormatter={(v: unknown) => String(v)} />
                <Tooltip
                  labelFormatter={(l: unknown) => String(l)}
                  formatter={(v: unknown, n: unknown) => [Number(v).toFixed(1), n as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <PlatformLines platforms={qaPlatforms} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* ── QA Rejection Rate over time ──────────────────────────────────── */}
      <ChartCard title="QA Rejection Rate" sub="daily fraction of posts rejected by QA per platform">
        <div className="p-5">
          {rejData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rejData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 11 }}
                  width={40}
                  tickFormatter={(v: unknown) => `${Math.round(Number(v) * 100)}%`}
                />
                <Tooltip
                  labelFormatter={(l: unknown) => String(l)}
                  formatter={(v: unknown, n: unknown) => [`${(Number(v) * 100).toFixed(0)}%`, n as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0.5} stroke="#fca5a5" strokeDasharray="4 2" label={{ value: '50%', fontSize: 10, fill: '#f87171', position: 'right' }} />
                <PlatformLines platforms={rejPlatforms} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* ── Avg Predicted ER & Actual ER over time ───────────────────────── */}
      <ChartCard
        title="Avg Engagement Rate"
        sub="predicted ER (solid) vs actual 7d ER (dashed) per platform"
      >
        <div className="p-5">
          {erData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={erData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={44}
                  tickFormatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
                />
                <Tooltip
                  labelFormatter={(l: unknown) => String(l)}
                  formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(2)}%`, n as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {erPlatforms.map((p) => (
                  <>
                    <Line
                      key={`${p}_pred`}
                      type="monotone"
                      dataKey={`${p}_pred`}
                      name={`${p.replace(/_/g, ' ')} pred`}
                      stroke={PLATFORM_COLORS[p] ?? '#94a3b8'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                    <Line
                      key={`${p}_actual`}
                      type="monotone"
                      dataKey={`${p}_actual`}
                      name={`${p.replace(/_/g, ' ')} actual`}
                      stroke={PLATFORM_COLORS[p] ?? '#94a3b8'}
                      strokeWidth={1.5}
                      dot={{ r: 2 }}
                      strokeDasharray="4 2"
                      connectNulls
                    />
                  </>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* ── Cost per Run ─────────────────────────────────────────────────── */}
      <ChartCard title="Cost per Run" sub="LLM + API spend in USD — aggregated by day">
        <div className="p-5">
          {filteredCost.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={filteredCost} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: unknown) => `$${Number(v).toFixed(2)}`} width={48} />
                <Tooltip
                  labelFormatter={(l: unknown) => String(l)}
                  formatter={(v: unknown, n: unknown) => [`$${Number(v).toFixed(4)}`, n as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total_cost" name="Total" stroke="#64748b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="llm_cost" name="LLM" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="5 2" />
                <Line type="monotone" dataKey="api_cost" name="API" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="5 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* ── Bottom row: scatter + top posts ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Predicted vs Actual ER" sub="each dot is a post with 7-day actuals">
          <div className="p-5">
            {scatterData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <span>No actual engagement data yet.</span>
                <span className="text-xs">Populate actual_engagement_7d to see this chart.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="pred" name="Predicted" unit="%" tick={{ fontSize: 11 }}
                    label={{ value: 'Pred ER %', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="actual" name="Actual" unit="%" tick={{ fontSize: 11 }}
                    label={{ value: 'Actual ER %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v: unknown, n: unknown) => [`${v}%`, n === 'pred' ? 'Predicted' : 'Actual']} />
                  <ReferenceLine stroke="#cbd5e1" segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} strokeDasharray="4 2" />
                  <Scatter data={scatterData} fill="#0ea5e9" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Top Posts by Predicted ER" sub="highest predicted engagement — non-rejected posts">
          {top_posts.length === 0 ? (
            <div className="p-6 text-slate-400 text-sm">No posts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs bg-slate-50">
                    <th className="text-left px-5 py-3">Content</th>
                    <th className="text-left px-3 py-3">Platform</th>
                    <th className="text-right px-3 py-3">QA</th>
                    <th className="text-right px-5 py-3">Pred ER</th>
                  </tr>
                </thead>
                <tbody>
                  {top_posts.map((post) => (
                    <tr key={post.post_id} onClick={() => navigate(`/posts/${post.post_id}`)}
                      className="border-b border-slate-50 hover:bg-brand-50 cursor-pointer transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-600 max-w-xs">
                        <span className="line-clamp-2">{post.content_snippet}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-full"
                          style={{ background: `${PLATFORM_COLORS[post.platform] ?? '#94a3b8'}22`, color: PLATFORM_COLORS[post.platform] ?? '#64748b' }}>
                          {post.platform.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 text-xs">{post.qa_overall.toFixed(1)}</td>
                      <td className="px-5 py-3 text-right font-medium text-sky-600 text-xs">
                        {(post.pred_er * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
