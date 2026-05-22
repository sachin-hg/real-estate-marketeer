export interface Post {
  post_id: string
  run_id: string
  platform: string
  platform_post_id?: string
  content: string
  hashtags: string[]
  published_at: string
  output_path?: string
  published_url?: string
  draft_type?: string
  zomato_hook?: string
  trend_hashtag?: string
  media_format?: string
  // QA dimension scores
  qa_safety_passed?: boolean
  qa_re_relevance?: number
  qa_backlink_score?: number
  qa_brand_voice?: number
  qa_overall?: number
  // QA system decision
  qa_decision?: string               // "publish" | "reject"
  post_status?: string               // "published" | "qa_rejected"
  qa_rejection_reasons?: string[]    // list of failing dims / safety violations
  // Predicted performance
  pred_impressions?: number
  pred_likes?: number
  pred_shares?: number
  pred_comments?: number
  pred_ctr?: number
  pred_engagement_rate?: number
  pred_confidence?: number
  // Actual performance
  actual_impressions_6h?: number
  actual_likes_6h?: number
  actual_impressions_24h?: number
  actual_likes_24h?: number
  actual_shares_24h?: number
  actual_comments_24h?: number
  actual_ctr_24h?: number
  actual_saves_24h?: number
  actual_impressions_7d?: number
  actual_engagement_7d?: number
  actual_housing_traffic?: number
  prediction_accuracy?: number
  // User feedback
  user_rating?: number
  user_tags?: string[]
  user_feedback?: string
  user_action?: string               // "approved" | "rejected" | "flagged" (manual)
  rejection_reason?: string          // manual rejection reason
  creative_angle?: string
  media_urls?: string[]
  internal_links?: Array<{ url: string; anchor_text?: string; page_type?: string }>
  source_topic?: string
  // QA reasoning (persisted from qa_agent output)
  qa_critique?: string
  qa_quality_dimensions?: Record<string, number>
  engagement_reasoning?: string
  // Full TrendItem that drove this post
  trend_data?: {
    hashtag?: string
    platform?: string
    volume?: string
    context?: string
    creative_hook?: string
    city_hint?: string
    tags?: string[]
  }
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
  hashtag?: string
  title?: string
  url?: string
  volume?: string | number
  views?: string | number
  platform?: string
  context?: string
  description?: string
  creative_hook?: string
  tags?: string[]
  city_hint?: string
}

export interface SearchResultItem {
  title?: string
  url?: string
  content?: string
}

export interface RunPublishedPost {
  post_id?: string
  platform?: string
  content?: string
  qa_overall?: number
  published_url?: string
  output_path?: string
}

export interface RunResearchItem {
  headline: string
  source: string
  url: string
  summary: string
  relevance: string
}

export interface RunTrendItem {
  hashtag: string
  platform: string
  volume: string
  context: string
  creative_hook: string
  city_hint?: string
  tags?: string[]
}

export interface RunBrief {
  topic: string
  angle: string
  draft_type: string
  target_platforms: string[]
  tone: string
  urgency: string
  source_summary: string
  city_hint?: string
  seo_keywords: string[]
}

export interface RunDraft {
  id: string
  draft_type: string
  angle: string
  hook: string
  headline: string
  hashtags: string[]
  trend_hashtag: string
  target_platforms: string[]
  media_format: string
}

export interface RunStatus {
  run_id: string
  status: string
  research_count: number
  trends_count: number
  briefs_count: number
  drafts_count: number
  platform_posts_count: number
  posts_approved: number
  published: RunPublishedPost[]
  error?: string
  triggered_at?: string
  dry_run?: boolean
  topic_hint?: string
  // Actual content (populated after each pipeline phase)
  research?: RunResearchItem[]
  trends?: RunTrendItem[]
  content_briefs?: RunBrief[]
  creative_drafts?: RunDraft[]
  events?: Array<{ ts: number; level: string; logger: string; msg: string }>
}

export type { RunApiCall, RunLlmCall } from './api'

export interface PostStats {
  total: number
  avg_qa: number
  avg_pred_er: number
  by_platform: Record<string, number>
  by_action: Record<string, number>
  by_post_status?: Record<string, number>
  qa_rejection_rate?: number
  qa_rejected_by_platform?: Record<string, number>
  avg_cost_per_post?: number
  total_cost?: number
  non_rejected_count?: number
}
