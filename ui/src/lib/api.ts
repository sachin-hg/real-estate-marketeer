import type { Post, Prompt, PostStats, RunStatus } from './types'

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
  run_id?: string
  draft_type?: string
  page?: number
  limit?: number
}

export const getPosts = (filters: PostFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.status) params.set('status', filters.status)
  if (filters.run_id) params.set('run_id', filters.run_id)
  if (filters.draft_type) params.set('draft_type', filters.draft_type)
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
  fetchJson<{ cached: boolean; fetched_at: number; trends: unknown[] }>('/api/trends/live')

export const searchTrends = (query: string, domains?: string[], maxResults?: number) =>
  fetchJson<{ query: string; results: unknown[] }>('/api/trends/search', {
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
  fetchJson<{ run_id: string; status: string }>('/run', {
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

export const getRunStatus = (runId: string) => fetchJson<RunStatus>(`/runs/${runId}`)

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

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = () =>
  fetchJson<
    Record<
      string,
      { value: string; is_set: boolean; desc: string; section: string }
    >
  >('/api/settings/')

export const updateSetting = (key: string, value: string) =>
  fetchJson<{ ok: boolean; key: string }>('/api/settings/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
