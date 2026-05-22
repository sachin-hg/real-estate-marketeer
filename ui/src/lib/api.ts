import type { Post, Prompt, PostStats, RunStatus, TrendItem, SearchResultItem, RunPublishedPost, RunResearchItem, RunTrendItem, RunBrief, RunDraft } from './types'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export interface PostFilters {
  platform?: string
  status?: string
  post_status?: string
  run_id?: string
  draft_type?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

export const getPosts = (filters: PostFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.status) params.set('status', filters.status)
  if (filters.post_status) params.set('post_status', filters.post_status)
  if (filters.run_id) params.set('run_id', filters.run_id)
  if (filters.draft_type) params.set('draft_type', filters.draft_type)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  return fetchJson<{ total: number; page: number; limit: number; items: Post[] }>(
    `/api/posts/?${params.toString()}`
  )
}

export const getPostStats = () => fetchJson<PostStats>('/api/posts/stats')

export const getPost = (postId: string) => fetchJson<Post>(`/api/posts/${postId}`)

export const submitFeedback = (
  postId: string,
  data: { rating?: number; tags?: string[]; feedback?: string; action?: string; rejection_reason?: string }
) =>
  fetchJson<Post>(`/api/posts/${postId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const rejectPost = (postId: string, reason: string) =>
  fetchJson<Post>(`/api/posts/${postId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })

export const updatePost = (
  postId: string,
  data: { content?: string; hashtags?: string[]; zomato_hook?: string; media_urls?: string[] }
) =>
  fetchJson<Post>(`/api/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const uploadPostMedia = async (postId: string, file: File): Promise<{ path: string; url: string }> => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/posts/${postId}/media`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `Upload failed (${res.status})`)
  }
  return res.json()
}

export const publishPost = (postId: string) =>
  fetchJson<Post>(`/api/posts/${postId}/publish`, { method: 'POST' })

// ─── Prompts ──────────────────────────────────────────────────────────────────

export const getPrompts = () => fetchJson<Prompt[]>('/api/prompts/')

export const createPrompt = (data: Partial<Prompt>) =>
  fetchJson<Prompt>('/api/prompts/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updatePrompt = (id: string, data: Partial<Prompt>) =>
  fetchJson<Prompt>(`/api/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deletePrompt = (id: string) =>
  fetchJson<{ deleted: boolean; id: string }>(`/api/prompts/${id}`, {
    method: 'DELETE',
  })

// ─── Trends ───────────────────────────────────────────────────────────────────

export const getLiveTrends = () =>
  fetchJson<{ cached: boolean; fetched_at: number; trends: TrendItem[] }>('/api/trends/live')

export const searchTrends = (query: string, domains?: string[], maxResults?: number) =>
  fetchJson<{ query: string; results: SearchResultItem[] }>('/api/trends/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, domains, max_results: maxResults ?? 10 }),
  })

// ─── Runs ─────────────────────────────────────────────────────────────────────

export const triggerRun = (opts: {
  dry_run?: boolean
  topic_hint?: string
  target_platforms?: string[]
}) =>
  fetchJson<{ run_id: string; status: string }>('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })

export const triggerDirectRun = (
  topic: string,
  opts?: { dry_run?: boolean; target_platforms?: string[] }
) =>
  fetchJson<{ run_id: string; status: string }>('/api/runs/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slack_topic: topic, ...opts }),
  })

export const getRunStatus = (runId: string) => fetchJson<RunStatus>(`/api/runs/${runId}/status`)

export const getRuns = () =>
  fetchJson<
    Array<{
      run_id: string
      status: string
      triggered_at?: string
      research_count: number
      trends_count: number
      drafts_count: number
      posts_approved: number
      published_count: number
      error?: string
    }>
  >('/api/runs')

export const getRunDetail = (runId: string) =>
  fetchJson<{
    run_id: string
    status: string
    triggered_at?: string
    dry_run?: boolean
    topic_hint?: string
    research_count: number
    trends_count: number
    briefs_count: number
    drafts_count: number
    platform_posts_count: number
    posts_approved: number
    published: RunPublishedPost[]
    error?: string
    events: Array<{ ts: number; level: string; logger: string; msg: string }>
    research: RunResearchItem[]
    trends: RunTrendItem[]
    content_briefs: RunBrief[]
    creative_drafts: RunDraft[]
  }>(`/api/runs/${runId}`)

export interface RunApiCall {
  type: 'api'
  called_at?: string
  agent: string
  api_name: string
  endpoint: string
  params: Record<string, unknown>
  response_preview: unknown
  total_response_items: number
  result_count: number
  status: string
  http_status?: number
  error?: string
  elapsed_ms: number
  use_case: string
  estimated_cost_usd: number
}

export interface RunLlmCall {
  type: 'llm'
  called_at?: string
  agent: string
  model: string
  stop_reason?: string
  input_tokens?: number
  output_tokens?: number
  cost_usd?: number
  elapsed_ms: number
  attempt: number
  system_prompt: string
  user_message: string
  response_text: string
}

export const getRunCalls = (runId: string) =>
  fetchJson<{
    run_id: string
    api_calls: RunApiCall[]
    llm_calls: RunLlmCall[]
    total_api_calls: number
    total_llm_calls: number
    total_api_cost_usd: number
    total_llm_cost_usd: number
  }>(`/api/runs/${runId}/calls`)

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = () =>
  fetchJson<
    Record<
      string,
      { value: string; is_set: boolean; desc: string; section: string; type?: string }
    >
  >('/api/settings/')

export const updateSetting = (key: string, value: string) =>
  fetchJson<{ ok: boolean; key: string }>('/api/settings/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  posts_over_time: Array<{ date: string; total: number; published: number; qa_rejected: number }>
  cost_over_time: Array<{ run_id: string; date: string | null; llm_cost: number; api_cost: number; total_cost: number }>
  platform_over_time: Array<{
    date: string
    platform: string
    count: number
    avg_qa: number | null
    avg_pred_er: number | null
    avg_actual_er: number | null
    rejected_count: number
    rejection_rate: number
  }>
  engagement_data: Array<{ post_id: string; platform: string; pred_er: number; actual_er: number | null; qa_overall: number; published_at: string | null }>
  platform_performance: Array<{ platform: string; count: number; avg_pred_er: number; avg_actual_er: number | null; avg_qa: number }>
  top_posts: Array<{ post_id: string; platform: string; pred_er: number; actual_er: number | null; qa_overall: number; published_at: string | null; content_snippet: string }>
  totals: { total_posts: number; avg_qa: number; avg_pred_er: number; total_cost: number }
}

export const getAnalytics = () => fetchJson<AnalyticsData>('/api/analytics/')
