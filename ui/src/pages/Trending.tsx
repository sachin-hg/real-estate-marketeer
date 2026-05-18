import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLiveTrends, searchTrends } from '../lib/api'

type TrendTab = 'google' | 'youtube' | 'reddit' | 'twitter'

function timeAgo(ts: number): string {
  if (!ts) return 'Never'
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

export default function Trending() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDomains, setSearchDomains] = useState('')
  const [maxResults, setMaxResults] = useState(10)
  const [activeTab, setActiveTab] = useState<TrendTab>('google')
  const navigate = useNavigate()

  const trendsQ = useQuery({
    queryKey: ['live-trends'],
    queryFn: getLiveTrends,
    staleTime: 5 * 60 * 1000,
  })

  const searchMut = useMutation({
    mutationFn: () => {
      const domains = searchDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
      return searchTrends(searchQuery, domains.length ? domains : undefined, maxResults)
    },
  })

  const liveTrends = trendsQ.data?.trends ?? []

  // Group by platform
  const byPlatform: Record<string, unknown[]> = { google: [], youtube: [], reddit: [], twitter: [] }
  for (const item of liveTrends) {
    const obj = item as Record<string, unknown>
    const plat = String(obj.platform ?? '').toLowerCase()
    if (plat in byPlatform) {
      byPlatform[plat].push(item)
    } else {
      byPlatform.google.push(item)
    }
  }

  const TAB_LABELS: Record<TrendTab, string> = {
    google: 'Google',
    youtube: 'YouTube',
    reddit: 'Reddit',
    twitter: 'Twitter/X',
  }

  return (
    <div className="space-y-6">
      {/* Search Trends */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Search Trends</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMut.mutate()}
            placeholder="Query (e.g. housing loan rates)"
            className="flex-1 min-w-48 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
          />
          <input
            value={searchDomains}
            onChange={(e) => setSearchDomains(e.target.value)}
            placeholder="Domains (optional, comma-separated)"
            className="flex-1 min-w-48 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Results:</span>
            <input
              type="range"
              min={5}
              max={20}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-20 accent-brand"
            />
            <span className="text-xs font-medium text-slate-600 w-4">{maxResults}</span>
          </div>
          <button
            onClick={() => searchMut.mutate()}
            disabled={!searchQuery.trim() || searchMut.isPending}
            className="bg-brand text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {searchMut.isPending ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search results */}
        {searchMut.isError && (
          <p className="text-red-500 text-xs">{String(searchMut.error)}</p>
        )}
        {searchMut.data && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {(searchMut.data.results ?? []).length} results for "{searchMut.data.query}"
            </div>
            {(searchMut.data.results ?? []).map((r, i) => {
              const result = r as Record<string, unknown>
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {String(result.title ?? result.url ?? `Result ${i + 1}`)}
                    </div>
                    {result.content != null && (
                      <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                        {String(result.content)}
                      </div>
                    )}
                    {result.url != null && (
                      <a
                        href={String(result.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline"
                      >
                        {String(result.url).slice(0, 60)}...
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      navigate(
                        `/generate?topic=${encodeURIComponent(
                          String(result.title ?? result.url ?? '')
                        )}`
                      )
                    }
                    className="text-xs font-medium bg-brand-50 text-brand rounded-lg px-2.5 py-1.5 hover:bg-brand-100 transition-colors flex-shrink-0"
                  >
                    Use in Generate
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Live Signals */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Live Signals</h2>
          <div className="flex items-center gap-3">
            {trendsQ.data && (
              <span className="text-xs text-slate-400">
                {trendsQ.data.cached ? 'Cached · ' : ''}
                {timeAgo(trendsQ.data.fetched_at)}
              </span>
            )}
            <button
              onClick={() => trendsQ.refetch()}
              disabled={trendsQ.isFetching}
              className="text-sm font-medium bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              {trendsQ.isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5">
          {(Object.keys(TAB_LABELS) as TrendTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium px-3 py-3 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {TAB_LABELS[tab]}
              {byPlatform[tab].length > 0 && (
                <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                  {byPlatform[tab].length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {trendsQ.isLoading ? (
            <div className="text-slate-400 text-sm">Loading trends...</div>
          ) : byPlatform[activeTab].length === 0 ? (
            <div className="text-slate-400 text-sm">
              No {TAB_LABELS[activeTab]} trends. Click Refresh to fetch.
            </div>
          ) : (
            <div className="space-y-2">
              {byPlatform[activeTab].map((item, i) => {
                const t = item as Record<string, unknown>
                const hashtag = String(t.hashtag ?? t.title ?? `Trend ${i + 1}`)
                const volume = String(t.volume ?? t.views ?? '')
                const context = String(t.context ?? t.description ?? '')
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">
                        {hashtag}
                      </div>
                      {volume && (
                        <div className="text-xs text-slate-400">{volume}</div>
                      )}
                      {context && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {context}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/generate?topic=${encodeURIComponent(hashtag)}`)
                      }
                      className="text-xs font-medium bg-brand-50 text-brand rounded-lg px-2.5 py-1.5 hover:bg-brand-100 transition-colors flex-shrink-0"
                    >
                      Create Post
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
