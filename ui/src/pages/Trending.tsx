import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLiveTrends, searchTrends } from '../lib/api'
import type { TrendItem, SearchResultItem } from '../lib/types'

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

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // fallback for non-secure contexts
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className={`flex-shrink-0 text-xs font-medium rounded px-2 py-1 transition-all ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
      }`}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ─── Modal field row ──────────────────────────────────────────────────────────

function ModalField({
  label,
  value,
  href,
  mono,
}: {
  label: string
  value: string
  href?: string
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-start gap-2">
        <div className={`flex-1 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words ${mono ? 'font-mono text-xs bg-slate-50 rounded p-2' : ''}`}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-brand underline hover:text-brand-600 break-all">
              {value}
            </a>
          ) : value}
        </div>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

interface SearchResultModalProps {
  item: SearchResultItem
  onClose: () => void
  onUse: () => void
}

function SearchResultModal({ item, onClose, onUse }: SearchResultModalProps) {
  const title = item.title ?? item.url ?? 'Result'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Search Result</p>
            <h2 className="text-base font-semibold text-slate-800 leading-snug">{title}</h2>
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <ModalField label="Title" value={item.title ?? ''} />
          {item.url && <ModalField label="URL" value={item.url} href={item.url} />}
          {item.content && <ModalField label="Content" value={item.content} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700">Close</button>
          <button onClick={onUse}
            className="text-sm font-medium bg-brand text-white rounded-lg px-4 py-2 hover:bg-brand-600 transition-colors">
            Use in Generate →
          </button>
        </div>
      </div>
    </div>
  )
}

interface TrendItemModalProps {
  item: TrendItem
  onClose: () => void
  onUse: () => void
}

function TrendItemModal({ item, onClose, onUse }: TrendItemModalProps) {
  const title = item.hashtag ?? item.title ?? 'Trend'
  const volume = String(item.volume ?? item.views ?? '')
  const context = item.context ?? item.description ?? ''

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Live Signal · {item.platform ?? 'Trend'}
            </p>
            <h2 className="text-base font-semibold text-slate-800 leading-snug">{title}</h2>
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <ModalField label="Hashtag / Title" value={title} />
          {item.url && <ModalField label="URL" value={item.url} href={item.url} />}
          {volume && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Volume / Views</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{volume}</span>
                <CopyButton text={volume} />
              </div>
            </div>
          )}
          {context && <ModalField label="Context" value={context} />}
          {item.creative_hook && <ModalField label="Creative Hook" value={item.creative_hook} />}
          {item.city_hint && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">City Hint</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{item.city_hint}</span>
                <CopyButton text={item.city_hint} />
              </div>
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span key={t} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700">Close</button>
          <button onClick={onUse}
            className="text-sm font-medium bg-brand text-white rounded-lg px-4 py-2 hover:bg-brand-600 transition-colors">
            Use in Generate →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Trending() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDomains, setSearchDomains] = useState('')
  const [maxResults, setMaxResults] = useState(10)
  const [activeTab, setActiveTab] = useState<TrendTab>('google')
  const [selectedSearch, setSelectedSearch] = useState<SearchResultItem | null>(null)
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null)
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

  const byPlatform: Record<TrendTab, TrendItem[]> = { google: [], youtube: [], reddit: [], twitter: [] }
  for (const item of liveTrends) {
    const plat = (item.platform ?? '').toLowerCase() as TrendTab
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

  const goGenerate = useCallback((topic: string) => {
    setSelectedSearch(null)
    setSelectedTrend(null)
    navigate(`/generate?topic=${encodeURIComponent(topic)}`)
  }, [navigate])

  return (
    <div className="space-y-6">
      {/* Modals */}
      {selectedSearch && (
        <SearchResultModal
          item={selectedSearch}
          onClose={() => setSelectedSearch(null)}
          onUse={() => goGenerate(selectedSearch.title ?? selectedSearch.url ?? '')}
        />
      )}
      {selectedTrend && (
        <TrendItemModal
          item={selectedTrend}
          onClose={() => setSelectedTrend(null)}
          onUse={() => goGenerate(selectedTrend.hashtag ?? selectedTrend.title ?? '')}
        />
      )}

      {/* Search Trends */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Search Trends</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMut.mutate()}
            placeholder="Query (optional if domain provided)"
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
            disabled={(!searchQuery.trim() && !searchDomains.trim()) || searchMut.isPending}
            className="bg-brand text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {searchMut.isPending ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchMut.isError && (
          <p className="text-red-500 text-xs">{String(searchMut.error)}</p>
        )}
        {searchMut.data && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {(searchMut.data.results ?? []).length} results for "{searchMut.data.query}"
            </div>
            {(searchMut.data.results ?? []).map((result: SearchResultItem, i) => (
              <div
                key={i}
                onClick={() => setSelectedSearch(result)}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate group-hover:text-brand transition-colors">
                    {result.title ?? result.url ?? `Result ${i + 1}`}
                  </div>
                  {result.content != null && (
                    <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {result.content}
                    </div>
                  )}
                  {result.url != null && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {result.url.slice(0, 70)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-400 group-hover:text-slate-500">View details</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/generate?topic=${encodeURIComponent(result.title ?? result.url ?? '')}`)
                    }}
                    className="text-xs font-medium bg-brand-50 text-brand rounded-lg px-2.5 py-1.5 hover:bg-brand-100 transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            ))}
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
        <div className="flex border-b border-slate-100 px-5" style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const }}>
          {(Object.keys(TAB_LABELS) as TrendTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ flexShrink: 0 }}
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
                const hashtag = item.hashtag ?? item.title ?? `Trend ${i + 1}`
                const volume = String(item.volume ?? item.views ?? '')
                const context = item.context ?? item.description ?? ''
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedTrend(item)}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 hover:shadow-sm transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate group-hover:text-brand transition-colors">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400 group-hover:text-slate-500">View details</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/generate?topic=${encodeURIComponent(hashtag)}`)
                        }}
                        className="text-xs font-medium bg-brand-50 text-brand rounded-lg px-2.5 py-1.5 hover:bg-brand-100 transition-colors"
                      >
                        Create Post
                      </button>
                    </div>
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
