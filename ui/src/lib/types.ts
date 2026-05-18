export interface Post {
  post_id: string
  run_id: string
  platform: string
  content: string
  hashtags: string[]
  published_at: string
  output_path?: string
  published_url?: string
  draft_type?: string
  zomato_hook?: string
  trend_hashtag?: string
  media_format?: string
  qa_overall?: number
  pred_engagement_rate?: number
  actual_engagement_7d?: number
  user_rating?: number
  user_tags?: string[]
  user_feedback?: string
  user_action?: string
  rejection_reason?: string
  creative_angle?: string
}

export interface Prompt {
  id: string
  event: string
  tags: string[]
  card: string
  caption?: string
  city_hint?: string
  media_format?: string
  meme_concept?: string
}

export interface TrendItem {
  hashtag: string
  volume: string
  platform: string
  context: string
}

export interface RunStatus {
  run_id: string
  status: string
  research_count: number
  trends_count: number
  drafts_count: number
  posts_approved: number
  published: unknown[]
  error?: string
}

export interface PostStats {
  total: number
  avg_qa: number
  avg_pred_er: number
  by_platform: Record<string, number>
  by_action: Record<string, number>
}
