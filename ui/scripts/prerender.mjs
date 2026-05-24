/**
 * SSG prerender script — runs after `vite build` via `npm run build:ssg`.
 *
 * For every public (non-dashboard) route it:
 *  1. Reads dist/index.html (the Vite-built SPA shell)
 *  2. Injects route-specific <title>, <meta>, canonical, OG tags,
 *     noindex where needed, JSON-LD structured data, and CWV hints into <head>
 *  3. Writes dist/{route}/index.html
 *
 * It also generates:
 *  - dist/manifest.json  (brand-name aware web app manifest)
 *  - dist/sitemap.xml    (canonical URL list for search engines)
 *
 * Environment variables (all optional, sensible defaults):
 *  VITE_APP_NAME        Brand name (default: NAVA)
 *  VITE_BASE_URL        CDN origin for static assets (og:image, icons), e.g. https://pub-xxx.r2.dev/ui
 *  VITE_SITE_URL        Canonical site domain for SEO (canonical link, sitemap), e.g. https://nava.up.railway.app
 *  VITE_SOCIAL_TWITTER  Twitter/X profile URL
 *  VITE_SOCIAL_INSTAGRAM  Instagram profile URL
 *  VITE_SOCIAL_LINKEDIN   LinkedIn profile URL
 *  VITE_CONTACT_EMAIL   Contact / business email
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir   = resolve(__dirname, '..', 'dist')
const publicDir = resolve(__dirname, '..', 'public')

// ── Brand + environment config ───────────────────────────────────────────────
const BRAND    = process.env.VITE_APP_NAME  || 'NAVA'
// CDN_BASE: R2/CDN origin for static assets (og:image, versioned icons).
// Leave empty → assets served from origin at relative paths.
const CDN_BASE = (process.env.VITE_BASE_URL  || '').replace(/\/$/, '')
// SITE_URL: canonical site domain for SEO (canonical link, sitemap, schema @id).
// Leave empty → canonical tags are omitted until a real domain is configured.
const SITE_URL = (process.env.VITE_SITE_URL  || '').replace(/\/$/, '')

const SOCIAL_TWITTER   = process.env.VITE_SOCIAL_TWITTER   || ''
const SOCIAL_INSTAGRAM = process.env.VITE_SOCIAL_INSTAGRAM || ''
const SOCIAL_LINKEDIN  = process.env.VITE_SOCIAL_LINKEDIN  || ''
const CONTACT_EMAIL    = process.env.VITE_CONTACT_EMAIL    || ''

const SAME_AS = [SOCIAL_TWITTER, SOCIAL_INSTAGRAM, SOCIAL_LINKEDIN].filter(Boolean)

// ── Static asset versioning ───────────────────────────────────────────────────
// Content-hash static assets so CDN can cache them immutably.
// Only done when CDN_BASE is configured (otherwise plain paths are fine).
const ASSET_HASHES = {}

if (CDN_BASE) {
  const sha8 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 8)
  for (const name of ['og.png', 'og.webp', 'apple-touch-icon.png', 'favicon.svg']) {
    const src = resolve(distDir, name)
    if (!existsSync(src)) continue
    const data = readFileSync(src)
    const h    = sha8(data)
    const dot  = name.lastIndexOf('.')
    const versioned = `${name.slice(0, dot)}.${h}${name.slice(dot)}`
    writeFileSync(resolve(distDir, versioned), data)
    ASSET_HASHES[name] = versioned
  }
  writeFileSync(resolve(distDir, 'asset-hashes.json'), JSON.stringify(ASSET_HASHES, null, 2))
}

// Returns CDN URL for a named asset (versioned when CDN is configured).
function cdnAsset(name) {
  if (!CDN_BASE) return `/${name}`
  return `${CDN_BASE}/${ASSET_HASHES[name] || name}`
}

const OG_IMAGE = cdnAsset('og.png')

// ── Shared structured data ───────────────────────────────────────────────────

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': SITE_URL ? `${SITE_URL}/#organization` : undefined,
  name: BRAND,
  url: SITE_URL || undefined,
  logo: CDN_BASE ? cdnAsset('favicon.svg') : undefined,
  description: `${BRAND} is an AI-powered trend-jacking engine that turns any trending moment into brand buzz — autonomously, in under 90 seconds, for any brand in any industry.`,
  foundingDate: '2026',
  parentOrganization: { '@type': 'Organization', name: 'Housing.com' },
  ...(CONTACT_EMAIL && { contactPoint: { '@type': 'ContactPoint', email: CONTACT_EMAIL, contactType: 'customer support' } }),
  ...(SAME_AS.length && { sameAs: SAME_AS }),
  knowsAbout: [
    'Trend-jacking', 'Social media automation', 'AI content generation',
    'Brand marketing', 'Content strategy', 'Influencer marketing',
    'Viral marketing', 'Multi-language content', 'Multi-region publishing',
  ],
}

const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': SITE_URL ? `${SITE_URL}/#software` : undefined,
  name: `${BRAND} — AI #TrendJack Engine`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: ['en', 'hi', 'ar', 'es', 'fr', 'de', 'pt', 'id', 'ja', 'zh'],
  description: `Multi-agent AI engine that detects trending topics, crafts platform-native posts aligned to your brand, and publishes across Twitter/X, Instagram, LinkedIn, YouTube Shorts and more — in under 90 seconds. Supports multi-language and multi-region publishing.`,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '31',
    highPrice: '449',
    priceCurrency: 'USD',
    offerCount: '4',
    offers: [
      { '@type': 'Offer', name: 'Spark (monthly)', price: '39', priceCurrency: 'USD', description: '~150 posts/month. 14-day free trial.' },
      { '@type': 'Offer', name: 'Spark (yearly)', price: '31', priceCurrency: 'USD', description: '~150 posts/month billed yearly. Best value entry plan.' },
      { '@type': 'Offer', name: 'Growth', price: '129', priceCurrency: 'USD', description: '~500 posts/month. 14-day free trial.' },
      { '@type': 'Offer', name: 'Scale', price: '449', priceCurrency: 'USD', description: '~2,000 posts/month + API access.' },
    ],
  },
  featureList: [
    'Real-time trend detection across 15+ sources (X/Twitter, Google Trends, YouTube, Reddit, News)',
    'Multi-agent AI pipeline: Trend Detection → Research → Strategy → Creative → QA → Publish',
    'Platform-native posts for Twitter/X, Instagram (Feed, Reels, Stories, Carousels), LinkedIn, YouTube Shorts',
    'Text-only, image-overlaid, meme-format, and video-overlaid content types',
    'Autonomous publishing in under 90 seconds',
    'Multi-language support: English, Hindi, Arabic, Spanish, French, German, Portuguese, Indonesian, Japanese, Chinese',
    'Multi-region publishing with localised tone and cultural context',
    'Engagement feedback loop — gets smarter with every published post',
    'Human-in-the-loop approval mode',
    'Multi-layer safety: sensitive topic filtering, brand-safety guardrails, hallucination checks',
    'Deep SEO: context-aware deeplinks injected from client CRM/CMS',
    'API access for CMS/CDP/CRM integration',
    'Flexible add-ons: API access, extra platforms, custom brand voice packs, white-label',
    'Competitor banter, authority tagging, and celeb crossover features for virality',
  ],
}

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SITE_URL ? `${SITE_URL}/#website` : undefined,
  name: BRAND,
  url: SITE_URL || '/',
  description: `${BRAND} turns any trending moment into brand buzz in 90 seconds.`,
  ...(SAME_AS.length && { sameAs: SAME_AS }),
  potentialAction: SITE_URL ? {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  } : undefined,
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', 'h2', '[data-speakable]'],
  },
}

const COMPREHENSIVE_FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [

    // ── What / How ─────────────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `What is ${BRAND}?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} is an AI-powered trend-jacking engine for brands, startups, SMBs, influencers, and enterprises of any size in any industry. It monitors 15+ real-time sources — X/Twitter, Google Trends, YouTube, Reddit, breaking news — detects moments that matter, crafts platform-native content aligned to your brand voice, and publishes autonomously across Twitter/X, Instagram, LinkedIn, YouTube Shorts, and more. All in under 90 seconds. ${BRAND} supports multi-language and multi-region publishing, making it effective for global brands as well as regional players.` },
    },
    {
      '@type': 'Question',
      name: `How is ${BRAND} different from other social media tools?`,
      acceptedAnswer: { '@type': 'Answer', text: `Most tools help you schedule content you've already created. ${BRAND} does something fundamentally different: it watches the pulse of the internet, finds the moments that are relevant to your brand, creates culturally-resonant, platform-native posts, and publishes them before your competitors even notice the trend. It's not a scheduler — it's an autonomous content engine that runs 24/7 without human input, and it adapts to your brand's unique voice, audience, and regional context.` },
    },
    {
      '@type': 'Question',
      name: 'What is trend-jacking?',
      acceptedAnswer: { '@type': 'Answer', text: `Trend-jacking is inserting your brand into a cultural conversation at the moment it peaks — a celebrity moment, a sports result, a viral meme, a policy change, a breaking news story. ${BRAND} automates this end-to-end: detecting the trend, researching the context, mapping it to your brand's voice, crafting a post that feels native to the platform, and publishing it while the moment is hot.` },
    },
    {
      '@type': 'Question',
      name: `What is ${BRAND}'s product, exactly?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} is a SaaS platform with a 5-stage multi-agent AI pipeline: (1) Trend Detection — continuous surveillance of 15+ real-time sources; (2) Deep Research — verifying facts, pulling brand-relevant angles, sourcing data; (3) Content Strategy — mapping the trend to your brand voice, platform, and hook; (4) AI Creative — generating drafts with platform-native tone (wit for Twitter, visual copy for Instagram, authority for LinkedIn), QA-verified for accuracy, safety, and engagement; (5) Auto-Publish — simultaneous publishing across all configured platforms. The whole cycle completes in under 90 seconds.` },
    },
    {
      '@type': 'Question',
      name: `Which companies has ${BRAND} worked with?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} was first deployed at Housing.com, one of India's largest real estate and home-services platforms with 50M+ monthly users. The pilot generated 200+ autonomous posts, achieved a 3.8× engagement lift over manual content, and reached 48K impressions on a single trend-jacked thread. ${BRAND} is now available to brands across all industries globally.` },
    },
    {
      '@type': 'Question',
      name: `How does the ${BRAND} system work under the hood?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} runs a graph-based multi-agent workflow: a Trend Monitor agent polls 15+ sources in real time. When a signal crosses the relevance threshold, it fires a Research agent and a Strategy agent (brand-voice calibration, angle selection). These feed a Creative agent that writes platform-native drafts, followed by a QA agent that checks factual accuracy, brand safety, community guidelines compliance, and tone. Approved posts are handed to a Publisher agent that handles OAuth, media formatting, timing optimisation, and hashtag injection. The entire pipeline is orchestrated via LangGraph with checkpointing and human-in-the-loop support.` },
    },
    {
      '@type': 'Question',
      name: `How intelligent is ${BRAND}?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} improves continuously. Every published post feeds real engagement signals — likes, shares, reach, click-through, saves — back into the pipeline's feedback loop. It tracks what resonates for your specific audience and autonomously refines hooks, timing, tone, hashtag strategy, and content format. The longer it runs for your brand, the sharper its output becomes. It also adapts to platform algorithm changes and emerging content formats without manual retraining.` },
    },

    // ── Multi-language / Multi-region ──────────────────────────────────────
    {
      '@type': 'Question',
      name: `Does ${BRAND} support multiple languages and regions?`,
      acceptedAnswer: { '@type': 'Answer', text: `Yes. ${BRAND} generates platform-native content in English, Hindi, Arabic, Spanish, French, German, Portuguese, Indonesian, Japanese, Chinese, and more. Multi-region publishing means the same trend can be adapted with culturally relevant references, local tone, and region-specific hashtags simultaneously — so your brand can be first to a trend in Mumbai, Dubai, London, and São Paulo at the same time. Language and region are configurable per brand account or per campaign.` },
    },

    // ── Audience segments ──────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `How can ${BRAND} help small businesses?`,
      acceptedAnswer: { '@type': 'Answer', text: `For small businesses with no dedicated content team, ${BRAND} acts as a full-stack social media manager — detecting relevant trends, crafting on-brand posts in your tone, and publishing without any human effort. Starting at $31/month (yearly) or $39/month (monthly), it replaces expensive freelancers or agency retainers. You set up your brand voice once; ${BRAND} handles the rest, 24/7.` },
    },
    {
      '@type': 'Question',
      name: `How can ${BRAND} help influencers and creators?`,
      acceptedAnswer: { '@type': 'Answer', text: `Influencers live and die by relevance. ${BRAND} ensures you're always the first to respond to what's trending — with posts that feel authentic to your voice and audience, not generic AI copy. It handles the high-velocity, reactive content so you can focus on the premium, personal moments. Built-in competitor banter, authority tagging, and celeb crossover features help you grow reach through viral mechanics.` },
    },
    {
      '@type': 'Question',
      name: `How can ${BRAND} help startups?`,
      acceptedAnswer: { '@type': 'Answer', text: `Startups need traction and visibility fast, with almost no budget. ${BRAND} plugs directly into the cultural conversation and positions your brand at the centre of moments that matter — building top-of-mind recall without a dedicated marketing team. With Pay As You Go credits starting from $0.26/post, you only pay for what you publish. Think of it as a growth hacker, copywriter, and social media manager — fully automated.` },
    },
    {
      '@type': 'Question',
      name: `How can ${BRAND} help medium-scale businesses and corporates?`,
      acceptedAnswer: { '@type': 'Answer', text: `For established brands, ${BRAND} adds an always-on reactive layer to your existing social strategy. Your brand team sets the voice, guidelines, and approval rules; ${BRAND} handles the high-velocity, real-time execution — connecting every relevant trend to your brand narrative at a fraction of the cost of a content team. Human-in-the-loop mode lets your team review and approve posts before publishing, keeping full creative control.` },
    },
    {
      '@type': 'Question',
      name: `How can ${BRAND} help enterprises?`,
      acceptedAnswer: { '@type': 'Answer', text: `Enterprise customers get dedicated onboarding, custom brand voice calibration, multi-brand management, human-in-the-loop approval workflows with Slack/email notifications, API access for CMS/CDP/CRM integration, webhook triggers, SLA-backed uptime, SSO, and priority support. ${BRAND}'s Command plan provides unlimited API calls, custom agent configurations, white-glove deployment, multi-language and multi-region publishing at scale, and custom integrations with your CRM or CMS for deep-link automation. We build the integration your stack needs.` },
    },

    // ── Investment ─────────────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `Is ${BRAND} looking for investors?`,
      acceptedAnswer: { '@type': 'Answer', text: `Yes. ${BRAND} is currently raising its seed round. With a proven pilot at Housing.com, validated engagement metrics (3.8× lift, 48K impressions on a single post), a working product, and a clear SaaS monetisation model, we're seeking investors who understand the future of autonomous brand communications. Visit our /invest page or reach out directly to connect with the founding team.` },
    },

    // ── Hiring ─────────────────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `Is ${BRAND} hiring?`,
      acceptedAnswer: { '@type': 'Answer', text: `Yes — we're actively hiring across Engineering, Design, Growth, Operations, and Partnerships. We're a small, high-velocity team building what we believe is the future of brand communications. If the intersection of AI, content, and culture excites you, we want to hear from you. No formal process — just say hi.` },
    },

    // ── Pricing ────────────────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `What are ${BRAND}'s pricing models?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} offers two models. (1) Subscription — Spark ($31/mo yearly or $39/mo monthly, ~150 posts/month), Growth ($129/mo, ~500 posts/month), Scale ($449/mo, ~2,000 posts + API access), Command (custom enterprise). All subscription plans include a 14-day free trial with no credit card required. (2) Pay As You Go — buy credits anytime at $0.26–$0.45/credit depending on volume; credits never expire. You can mix both: top up your subscription with PAYG credits whenever needed.` },
    },
    {
      '@type': 'Question',
      name: `Is ${BRAND} flexible with pricing and plans?`,
      acceptedAnswer: { '@type': 'Answer', text: `Yes. You can upgrade or downgrade at any time (upgrades are prorated; downgrades credited to next invoice). PAYG credits never expire. Growth customers can unlock API access for +$49/mo. Other available add-ons include: extra social platform connections, custom brand voice packs, dedicated content calendar management, white-label deployment for agencies, priority support SLA, and advanced analytics. Enterprises can request fully custom arrangements — pricing by post volume, platform count, custom SLA, or dedicated deployment. No lock-in contracts on any standard plan. Annual billing saves up to 20%.` },
    },
    {
      '@type': 'Question',
      name: `How customised are ${BRAND}'s solutions for client needs?`,
      acceptedAnswer: { '@type': 'Answer', text: `Deeply. Every ${BRAND} deployment is shaped around the client: your brand voice is calibrated via an onboarding session; content guidelines, blocklists, and approval rules are configured to your standards; platform selection and content types are chosen for your audience. Enterprise clients can integrate ${BRAND} with their existing CRM, CMS, or CDP via API — enabling context-aware deeplinks in every post that connect social trends to specific pages, products, or listings in your system. For agencies, ${BRAND} supports multi-brand management from a single dashboard with white-label output. We don't believe in one-size-fits-all; every brand has its own voice and every market has its own pulse.` },
    },

    // ── Platforms & content types ──────────────────────────────────────────
    {
      '@type': 'Question',
      name: `What platforms does ${BRAND} support?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} currently supports: Twitter/X (threads, single posts), Instagram (Feed posts, Stories, Carousels, Reels), LinkedIn (Posts, Articles), YouTube Shorts (scripts + metadata), and Housing News (a proprietary channel reaching 50M+ monthly users on Housing.com). Additional platforms including Threads, Snapchat, and Pinterest are on the roadmap. Clients can request priority access to specific platforms.` },
    },
    {
      '@type': 'Question',
      name: `What content types can ${BRAND} generate?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} generates: Twitter/X single posts and threads; Instagram static images with text overlay, carousels (multi-slide), Reels scripts, and Stories; LinkedIn long-form posts and short-form updates; YouTube Short scripts with captions and description metadata. Content can be text-only, text-overlaid image, meme-format (trend image + brand copy overlay), video-overlay (brand copy on trending clip frame), and carousel slide sequences. All content types are available in multiple languages and can be adapted for different regional markets simultaneously.` },
    },

    // ── Brand recall strategies ────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `How does ${BRAND} boost brand recall and virality?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} uses four brand recall strategies: (1) Trend-jacking — latching onto viral cultural moments with a brand-relevant angle, timing the post at peak conversation velocity; (2) Competitor banter — crafting posts that playfully tag competitors, triggering their audiences to engage with your brand; (3) Authority and celeb tagging — mentioning relevant authorities, celebrities, or verified accounts to drive reach through their follower bases; (4) Topic ownership — publishing consistently on high-relevance topics to build topical authority and appear in discovery feeds across multiple platforms and regions.` },
    },
    {
      '@type': 'Question',
      name: `What is ${BRAND}'s deep SEO feature?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} integrates with your CRM, CMS, or product database to inject context-aware deeplinks directly into posts. When a trend is relevant to a specific product, listing, article, or offer in your system, ${BRAND} automatically adds the right deeplink — connecting trending social content to revenue-generating pages. This turns social engagement into measurable organic traffic and SEO authority, and creates a feedback loop between social performance and content strategy. Deeplinks are localised for multi-region deployments, pointing to region-specific landing pages.` },
    },

    // ── Safety & compliance ────────────────────────────────────────────────
    {
      '@type': 'Question',
      name: `What validation checkpoints does ${BRAND} use before publishing?`,
      acceptedAnswer: { '@type': 'Answer', text: `Every post passes through a dedicated QA agent that runs: (1) Factual accuracy check — claims cross-referenced against verified sources; (2) Brand voice alignment — tone, vocabulary, and style compared against your brand guidelines; (3) Platform guidelines compliance — checked against Twitter/X, Instagram, LinkedIn, and YouTube community standards; (4) Character and formatting validation — correct length, hashtag count, link placement for each platform; (5) Link validation — all deeplinks resolved and verified live; (6) Safety scan — sensitive topics, regulatory content, and brand-safety flags reviewed before queuing; (7) Language and regional compliance — content checked for cultural appropriateness and local regulatory requirements.` },
    },
    {
      '@type': 'Question',
      name: `How does ${BRAND} prevent embarrassing, controversial, or illegal content?`,
      acceptedAnswer: { '@type': 'Answer', text: `${BRAND} uses a multi-layer safety system: (1) Sensitive topic filtering — political, religious, or legally sensitive content is flagged or blocked based on configurable rules; (2) Regulatory compliance — especially important for regulated industries (finance, real estate, healthcare, legal); factual claims in these domains require source citation; (3) Brand safety guardrails — customisable blocklists for topics, keywords, competitors, or events you never want associated with your brand; (4) Hallucination checks — AI-generated facts are cross-referenced against real-time verified sources before inclusion; (5) Controversy detection — viral moments with divisive or reputational-risk angles are flagged for human review even in autonomous mode; (6) Regional sensitivity — content is checked for cultural and regional appropriateness when publishing to specific markets.` },
    },
    {
      '@type': 'Question',
      name: `Is there a human-in-the-loop option in ${BRAND}?`,
      acceptedAnswer: { '@type': 'Answer', text: `Yes. Human-in-the-loop (HITL) mode is available on Scale and Command plans. When enabled, all generated posts are held in a review queue before publishing. Approvers receive a Slack message or email with the post preview and context (why this trend, what angle, which platforms). They can approve, edit copy inline, or reject with one click — all from a clean review dashboard. The AI handles all the creative heavy lifting; humans retain the final call. HITL adds typically less than 5 minutes of latency to the publish cycle.` },
    },

  ],
}

// ── Route definitions ────────────────────────────────────────────────────────

const NAV_LINKS = [
  { name: 'Home', url: SITE_URL || '/' },
  { name: 'Pricing', url: SITE_URL ? `${SITE_URL}/pricing` : '/pricing' },
  { name: 'Demo', url: SITE_URL ? `${SITE_URL}/demo` : '/demo' },
  { name: 'Invest', url: SITE_URL ? `${SITE_URL}/invest` : '/invest' },
]

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

const ROUTES = [
  {
    path: '/',
    title: `${BRAND} — The AI #TrendJack Engine`,
    description: `Turn any trending moment into brand buzz in 90 seconds. ${BRAND} is a multi-agent AI engine that detects trends, crafts platform-native posts, and publishes across Twitter, Instagram, LinkedIn and more — autonomously.`,
    keywords: 'AI trend-jacking engine, social media automation, brand buzz, content AI, Instagram automation, Twitter automation, LinkedIn automation, viral marketing AI, multi-language social media AI',
    schemas: [WEBSITE_SCHEMA, ORGANIZATION_SCHEMA, SOFTWARE_SCHEMA, COMPREHENSIVE_FAQ_SCHEMA],
    speakable: true,
  },
  {
    path: '/pricing',
    title: `${BRAND} Pricing — From $31/month · AI TrendJack Engine`,
    description: `Affordable plans for every brand. From $31/month (yearly) or $39/month. Flexible add-ons, Pay As You Go credits, and custom enterprise plans. 14-day free trial. No credit card required.`,
    keywords: `${BRAND} pricing, AI social media pricing, content automation plans, trend-jacking SaaS pricing, yearly plan, pay as you go`,
    schemas: [
      breadcrumb([{ name: 'Home', url: SITE_URL || '/' }, { name: 'Pricing', url: (SITE_URL || '') + '/pricing' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: COMPREHENSIVE_FAQ_SCHEMA.mainEntity.filter(q =>
          ['pricing', 'plan', 'flexible', 'trial', 'credits', 'api', 'switch', 'customis', 'add-on', 'yearly'].some(k => q.name.toLowerCase().includes(k))
        ),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${BRAND} Pricing Plans`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Spark (yearly)', description: `$31/month billed yearly — ~150 posts/month. Best value entry plan.` },
          { '@type': 'ListItem', position: 2, name: 'Spark (monthly)', description: `$39/month — ~150 posts/month. 14-day free trial.` },
          { '@type': 'ListItem', position: 3, name: 'Growth', description: `$129/month — ~500 posts/month. 14-day free trial.` },
          { '@type': 'ListItem', position: 4, name: 'Scale', description: `$449/month — ~2,000 posts/month. API access included.` },
          { '@type': 'ListItem', position: 5, name: 'Pay As You Go', description: `Buy credits anytime from $0.26/post. Credits never expire.` },
        ],
      },
    ],
  },
  {
    path: '/demo',
    title: `${BRAND} Live Demo — Watch AI Turn a Trend into 5 Posts in 90s`,
    description: `See the multi-agent pipeline in action. Trigger a real run and watch trend detection, research, content strategy, AI creative, and cross-platform publishing happen live.`,
    keywords: `${BRAND} demo, AI content demo, trend-jacking demo, social media AI live demo`,
    schemas: [
      breadcrumb([{ name: 'Home', url: SITE_URL || '/' }, { name: 'Demo', url: (SITE_URL || '') + '/demo' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${BRAND} Live Demo`,
        url: SITE_URL ? `${SITE_URL}/demo` : undefined,
        description: `Interactive live demo of the ${BRAND} AI pipeline. Watch trend detection → research → content strategy → AI creative → publishing in real time.`,
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', 'h2'],
        },
      },
    ],
  },
  {
    path: '/invest',
    title: `Invest in ${BRAND} — The AI Engine Turning Trends into Brand Equity`,
    description: `${BRAND} is raising its seed round. 3.8× engagement lift, 170× cheaper than agencies, 200+ posts generated. Proven at Housing.com. Built for every brand in every language.`,
    keywords: `${BRAND} investment, AI content startup, seed funding, trend-jacking AI, brand automation investment`,
    schemas: [
      breadcrumb([{ name: 'Home', url: SITE_URL || '/' }, { name: 'Invest', url: (SITE_URL || '') + '/invest' }]),
      ORGANIZATION_SCHEMA,
    ],
  },
  {
    path: '/login',
    title: `Login — ${BRAND}`,
    description: `Sign in to your ${BRAND} dashboard to manage your AI content pipeline, review posts, and track performance.`,
    noIndex: true,
    schemas: [],
  },
]

// ── Build helpers ─────────────────────────────────────────────────────────────

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildMetaBlock(route) {
  const canonical = SITE_URL ? `${SITE_URL}${route.path}` : undefined
  const lines = [
    `  <!-- SSG: ${route.path} -->`,
    `  <title>${esc(route.title)}</title>`,
    `  <meta name="description" content="${esc(route.description)}" />`,
    route.keywords ? `  <meta name="keywords" content="${esc(route.keywords)}" />` : '',
    route.noIndex ? `  <meta name="robots" content="noindex,nofollow" />` : `  <meta name="robots" content="index,follow" />`,
    canonical ? `  <link rel="canonical" href="${canonical}" />` : '',

    // Open Graph
    `  <meta property="og:title" content="${esc(route.title)}" />`,
    `  <meta property="og:description" content="${esc(route.description)}" />`,
    `  <meta property="og:type" content="${route.path === '/' ? 'website' : 'webpage'}" />`,
    `  <meta property="og:site_name" content="${esc(BRAND)}" />`,
    canonical ? `  <meta property="og:url" content="${canonical}" />` : '',
    `  <meta property="og:image" content="${OG_IMAGE}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:type" content="image/png" />`,
    `  <meta property="og:locale" content="en_US" />`,
    `  <meta property="og:locale:alternate" content="en_IN" />`,
    `  <meta property="og:locale:alternate" content="hi_IN" />`,
    `  <meta property="og:locale:alternate" content="ar_AE" />`,

    // Twitter
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${esc(route.title)}" />`,
    `  <meta name="twitter:description" content="${esc(route.description)}" />`,
    `  <meta name="twitter:image" content="${OG_IMAGE}" />`,
    SOCIAL_TWITTER ? `  <meta name="twitter:site" content="${SOCIAL_TWITTER.replace(/.*twitter\.com\//, '@').replace(/\/$/, '')}" />` : '',

    // Versioned icon links (CDN if configured, else plain paths from origin)
    `  <link rel="icon" type="image/svg+xml" href="${cdnAsset('favicon.svg')}" />`,
    `  <link rel="apple-touch-icon" href="${cdnAsset('apple-touch-icon.png')}" />`,
    `  <link rel="manifest" href="${CDN_BASE ? `${CDN_BASE}/manifest.json` : '/manifest.json'}" />`,

    // Preload OG image on the home page only
    route.path === '/' ? `  <link rel="preload" as="image" href="${OG_IMAGE}" fetchpriority="low" />` : '',

    // Structured data
    ...(route.schemas || []).map(
      s => `  <script type="application/ld+json">${JSON.stringify(s)}</script>`
    ),
  ].filter(Boolean)
  return lines.join('\n')
}

// ── Manifest ──────────────────────────────────────────────────────────────────

function writeManifest() {
  const manifest = {
    name: `${BRAND} — AI #TrendJack Engine`,
    short_name: BRAND,
    description: 'Turn any trending moment into brand buzz in 90 seconds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07071a',
    theme_color: '#8B5CF6',
    categories: ['business', 'productivity', 'social'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: cdnAsset('favicon.svg'), type: 'image/svg+xml', sizes: 'any', purpose: 'any maskable' },
      { src: cdnAsset('apple-touch-icon.png'), type: 'image/png', sizes: '180x180' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/dashboard', description: 'Open your content dashboard' },
      { name: 'Pricing', url: '/pricing', description: 'View pricing plans' },
    ],
    related_applications: [],
  }
  writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('✓  manifest.json')
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

// Robots.txt is static in public/ — we only append the Sitemap directive when
// VITE_SITE_URL is known so the URL is absolute (required by the robots.txt spec).
function writeRobots() {
  const base = resolve(distDir, 'robots.txt')
  if (!existsSync(base)) return
  let content = readFileSync(base, 'utf-8').trimEnd()
  if (SITE_URL) {
    content += `\n\n# Sitemap\nSitemap: ${SITE_URL}/sitemap.xml\n`
    writeFileSync(base, content)
    console.log('✓  robots.txt  (Sitemap directive added)')
  }
}

function writeSitemap() {
  if (!SITE_URL) { console.log('⚠  sitemap skipped (VITE_SITE_URL not set)'); return }
  const publicRoutes = ROUTES.filter(r => !r.noIndex).map(r => r.path)
  const now = new Date().toISOString().split('T')[0]
  const urls = publicRoutes.map(p => `
  <url>
    <loc>${SITE_URL}${p}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`
  writeFileSync(resolve(distDir, 'sitemap.xml'), xml)
  console.log('✓  sitemap.xml')
}

// ── Main ──────────────────────────────────────────────────────────────────────

const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
// Strip template defaults that prerender.mjs will re-inject per-route
const cleanTemplate = template
  .replace(/<title>[^<]*<\/title>/, '')
  .replace(/<meta name="robots"[^>]*>/g, '')
  .replace(/<meta property="og:type"[^>]*>/g, '')
  .replace(/<meta property="og:site_name"[^>]*>/g, '')
  .replace(/<meta property="og:image"[^>]*>/g, '')
  .replace(/<meta property="og:image:width"[^>]*>/g, '')
  .replace(/<meta property="og:image:height"[^>]*>/g, '')
  .replace(/<meta property="og:image:type"[^>]*>/g, '')
  .replace(/<meta name="twitter:card"[^>]*>/g, '')
  .replace(/<meta name="twitter:image"[^>]*>/g, '')
  .replace(/<meta name="apple-mobile-web-app-title"[^>]*>/, `<meta name="apple-mobile-web-app-title" content="${BRAND}" />`)
  // Strip icon/manifest links — re-added per-route with versioned CDN paths
  .replace(/<link rel="icon"[^>]*>/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>/g, '')
  .replace(/<link rel="manifest"[^>]*>/g, '')

for (const route of ROUTES) {
  const metaBlock = buildMetaBlock(route)
  const html = cleanTemplate.replace('</head>', `${metaBlock}\n  </head>`)

  if (route.path === '/') {
    writeFileSync(resolve(distDir, 'index.html'), html)
    console.log(`✓  /  →  dist/index.html`)
  } else {
    const slug = route.path.replace(/^\//, '')
    const outDir = resolve(distDir, slug)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'index.html'), html)
    console.log(`✓  ${route.path}  →  dist/${slug}/index.html`)
  }
}

writeManifest()
writeSitemap()
writeRobots()

console.log('\nSSG pre-render complete.')
