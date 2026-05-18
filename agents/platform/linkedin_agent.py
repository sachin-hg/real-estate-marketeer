from __future__ import annotations

import logging
import uuid

import anthropic

from config import get_settings
from models.state import CreativeDraft, PlatformPost

logger = logging.getLogger(__name__)

# ── Source registry — single source of truth for LinkedIn handle tagging ────────
# Tags drive which sources are surfaced per call: top-4 by tag overlap with trend.
_SOURCE_REGISTRY = [
    {
        "name": "ANAROCK",
        "handle": "@ANAROCK",
        "covers": "residential sales volumes, price appreciation, units sold, city-level data",
        "tags": ["layoffs", "salary", "career", "proptech", "investment", "jobs", "startup",
                 "bengaluru", "mumbai", "delhi", "noida", "gurgaon", "pune", "hyderabad"],
    },
    {
        "name": "NAREDCO",
        "handle": "@NAREDCO",
        "covers": "employment (71 million jobs), $1 trillion by 2030 projection, sector growth",
        "tags": ["jobs", "career", "layoffs", "investment", "finance", "proptech",
                 "national-pride", "india", "instability"],
    },
    {
        "name": "IBEF",
        "handle": "@IBEF",
        "covers": "GDP contribution 7.3%, macro sector overview, India economic data",
        "tags": ["finance", "national-pride", "investment", "india", "budget", "tax"],
    },
    {
        "name": "Knight Frank",
        "handle": "@KnightFrankIndia",
        "covers": "affordability index, EMI-to-income ratios, luxury segment, NRI demand",
        "tags": ["investment", "luxury", "homeloan", "emi", "finance",
                 "bengaluru", "mumbai", "delhi", "salary"],
    },
    {
        "name": "JLL",
        "handle": "@JLLIndia",
        "covers": "quarterly residential and commercial sales data, office space absorption",
        "tags": ["investment", "proptech", "bengaluru", "mumbai", "delhi", "tech",
                 "startup", "career"],
    },
    {
        "name": "KPMG",
        "handle": "@KPMG India",
        "covers": "PropTech CAGR 13-17%, PE investment in real estate, sector projections",
        "tags": ["investment", "startup", "proptech", "finance", "ipo", "tech",
                 "ai", "instability", "career"],
    },
    {
        "name": "CREDAI",
        "handle": "@CREDAI",
        "covers": "builder and developer data, new project launches, construction pipeline",
        "tags": ["construction", "infrastructure", "investment", "homeloan", "noida",
                 "gurgaon", "pune", "hyderabad"],
    },
]


def _get_relevant_sources(tags: list[str], top_n: int = 4) -> str:
    """Return the top_n most tag-relevant sources as a formatted SOURCE TAGGING block."""
    tag_set = {t.lower() for t in tags}
    scored = sorted(
        _SOURCE_REGISTRY,
        key=lambda s: len(tag_set & set(s["tags"])),
        reverse=True,
    )
    selected = scored[:top_n]
    # Always include ANAROCK — it has the broadest RE data coverage
    if not any(s["name"] == "ANAROCK" for s in selected):
        selected[-1] = next(s for s in _SOURCE_REGISTRY if s["name"] == "ANAROCK")

    lines = [
        "SOURCE TAGGING (cross-engagement):",
        "When citing public data, tag the source. This surfaces the post in their followers' feeds:",
    ]
    for s in selected:
        lines.append(f"- {s['handle']} — {s['covers']}")
    lines.append(
        'Include the tag naturally in the sentence, e.g.: '
        '"India sold 4.6 lakh homes in 2024 (@ANAROCK)" or "71 million jobs in this sector (@NAREDCO)"'
    )
    return "\n".join(lines)

# ── Tagged example bank ───────────────────────────────────────────────────────
# Each entry has tags that match the trend researcher's vocabulary so we can
# select the 4-5 most relevant examples per call instead of dumping all 15.
# All numbers are from public sources only (no internal Housing.com figures).
_EXAMPLE_BANK = [
    {
        "key": "it_layoffs_ai",
        "tags": ["layoffs", "tech", "ai", "instability", "jobs", "linkedin", "career", "proptech"],
        "hashtags": ["#TechLayoffs", "#PropTech", "#LifeAtHousing", "#AIJobs", "#NowHiring"],
        "text": (
            "[IT sector 50,000 layoffs / TCS 12,000 benched]\n"
            '"TCS benched 12,000. AI did what 5 engineers used to do.\n'
            "What AI still can't do: call a nervous buyer at 6 PM, listen,\n"
            "and help them make the biggest financial decision of their life.\n"
            'That job is still human. We\'re hiring. housing.com/careers"'
        ),
    },
    {
        "key": "startup_collapse",
        "tags": ["startup", "ipo", "fintech", "instability", "layoffs", "linkedin", "career", "investment", "finance"],
        "hashtags": ["#StartupIndia", "#PropTech", "#LifeAtHousing", "#RealEstateCareers", "#Investment"],
        "text": (
            "[BYJU's / Paytm / startup implosions]\n"
            '"Byju\'s: done. Paytm: RBI ban. OYO: pivoted thrice.\n'
            "Real estate: Rs 5.68 lakh crore in sales in 2024. Up 16% from the year before. (@ANAROCK)\n"
            'Come build on India\'s most durable asset class. housing.com/careers"'
        ),
    },
    {
        "key": "swiggy_ipo_esop",
        "tags": ["ipo", "startup", "esop", "finance", "linkedin", "fintech", "career", "layoffs", "investment"],
        "hashtags": ["#SwiggyIPO", "#RealEstateCareers", "#LifeAtHousing", "#ESOP", "#Investment"],
        "text": (
            "[Swiggy IPO / ESOP wealth creation]\n"
            '"Swiggy IPO: 500 employees became crorepatis. Great.\n'
            "Real estate sales: commission every month, not waiting years for a listing event.\n"
            "India sold 4.6 lakh homes in 2024 (@ANAROCK). Every single one needed an advisor.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "murthy_70hr_hustle",
        "tags": ["workculture", "hustle", "salary", "linkedin", "career", "proptech", "instability"],
        "hashtags": ["#70HourWorkWeek", "#WorkCulture", "#LifeAtHousing", "#PropTech", "#Career"],
        "text": (
            "[Murthy 70-hour workweek / hustle culture debate]\n"
            '"Narayana Murthy said work 70 hours. Real estate sales advisors say: work smart, close deals, go home.\n'
            "1% commission on a Rs 2 crore deal = Rs 2 lakh. Close 5 a month. Do the math.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "wfh_firing",
        "tags": ["wfh", "workculture", "linkedin", "hustle", "career", "instability"],
        "hashtags": ["#WorkFromHome", "#WorkCulture", "#LifeAtHousing", "#Career", "#JobMarket"],
        "text": (
            "[Gurugram founder fires employee on WhatsApp for WFH request]\n"
            '"Gurugram founder fired someone on WhatsApp for asking WFH.\n'
            "Our hybrid policy is written down. In a document. That people can read.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "babysitter_equity_genz",
        "tags": ["genz", "workculture", "startup", "hustle", "linkedin", "career", "hiring"],
        "hashtags": ["#GenZ", "#WorkCulture", "#LifeAtHousing", "#ESOP", "#NowHiring"],
        "text": (
            '["Babysitter at 7 PM" - Gen Z demands 50% equity for founder\'s mindset]\n'
            '"\'Treat the company like your own.\' Okay. But we actually give ESOPs.\n'
            "Ownership isn't a metaphor here. housing.com/careers\""
        ),
    },
    {
        "key": "genz_leave_email",
        "tags": ["genz", "workculture", "linkedin", "career", "hiring"],
        "hashtags": ["#GenZ", "#WorkLifeBalance", "#LifeAtHousing", "#WorkCulture", "#NowHiring"],
        "text": (
            '[Gen Z leave email - "Hi, I will be on leave. Bye." goes viral]\n'
            '"That Gen Z leave email? Completely valid.\n'
            'We measure deals closed, not explanations written. housing.com/careers"'
        ),
    },
    {
        "key": "iit_placements_skills",
        "tags": ["jobs", "education", "career", "linkedin", "genz", "hiring", "proptech"],
        "hashtags": ["#IITPlacements", "#RealEstateCareers", "#LifeAtHousing", "#NowHiring", "#PropTech"],
        "text": (
            "[IIT placements crisis - 38% of 2024 batch unplaced]\n"
            '"38% of IIT students from the 2024 batch: still unplaced.\n'
            "India's real estate sector employs 71 million people - second-largest employer after agriculture. (@ANAROCK @NAREDCO)\n"
            'The sector doesn\'t ask which campus you graduated from. housing.com/careers"'
        ),
    },
    {
        "key": "bengaluru_salary",
        "tags": ["salary", "bengaluru", "linkedin", "workculture", "career", "proptech", "instability"],
        "hashtags": ["#BengaluruSalary", "#RealEstateCareers", "#LifeAtHousing", "#PropTech", "#Career"],
        "text": (
            "[Bengaluru Rs 50 LPA 'poverty line' salary debate]\n"
            '"Rs 50 LPA in Bengaluru: rent, EMI, commute, food - and you\'re left with anxiety.\n'
            "Delhi-NCR property prices rose 30% in 2024 (@ANAROCK). Advisors' commissions moved with prices.\n"
            'Fixed salaries didn\'t. Different math, different career. housing.com/careers"'
        ),
    },
    {
        "key": "skills_over_degrees",
        "tags": ["career", "education", "jobs", "linkedin", "hiring", "proptech", "instability"],
        "hashtags": ["#SkillsOverDegrees", "#NowHiring", "#LifeAtHousing", "#PropTech", "#Career"],
        "text": (
            '["Skills, not degrees" - viral LinkedIn India discourse]\n'
            '"India\'s real estate sector employs 71 million people. (@ANAROCK @NAREDCO)\n'
            "The highest earners aren't the ones with the best degrees - they're the ones who\n"
            "understand what a family actually needs in a home. Most skill-democratised\n"
            'high-income career in India. housing.com/careers"'
        ),
    },
    {
        "key": "ai_replacing_jobs",
        "tags": ["ai", "tech", "jobs", "layoffs", "proptech", "career", "linkedin", "instability"],
        "hashtags": ["#AIJobs", "#PropTech", "#LifeAtHousing", "#NowHiring", "#TechLayoffs"],
        "text": (
            "[AI replacing jobs - ChatGPT / Copilot anxiety]\n"
            '"AI can predict property prices, rank listings, match buyer profiles.\n'
            "It still hasn't figured out how to look a family in the eye and say\n"
            "'this is the right home for you.' That conversation is still human.\n"
            'We\'re hiring humans. housing.com/careers"'
        ),
    },
    {
        "key": "funding_winter_downrounds",
        "tags": ["startup", "ipo", "finance", "instability", "linkedin", "career", "investment"],
        "hashtags": ["#StartupFundingWinter", "#RealEstateCareers", "#LifeAtHousing", "#Investment", "#StartupIndia"],
        "text": (
            "[Startup funding winter - down rounds, ESOPs worth zero]\n"
            '"Funded startup: ESOP valued at Rs 0 after a down round.\n'
            "Real estate sector: on track for $1 trillion by 2030. (@NAREDCO @KPMG India)\n"
            "Commission is paid in cash, every month. Real estate doesn't do down rounds.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "sector_scale_proptech",
        "tags": ["proptech", "startup", "finance", "investment", "linkedin", "career"],
        "hashtags": ["#PropTech", "#NowHiring", "#LifeAtHousing", "#Investment", "#RealEstate"],
        "text": (
            "[India real estate sector scale / $1 trillion projection]\n"
            '"$200 billion in 2021. $1 trillion by 2030. (@NAREDCO @KPMG India)\n'
            "India's PropTech market growing at 13-17% CAGR.\n"
            'If you\'re going to ride a growth wave, choose the right one. housing.com/careers"'
        ),
    },
    {
        "key": "ops_non_tech",
        "tags": ["career", "hiring", "jobs", "linkedin", "operations", "proptech", "instability"],
        "hashtags": ["#RealEstateCareers", "#Operations", "#LifeAtHousing", "#PropTech", "#NowHiring"],
        "text": (
            "[Ops and non-tech careers undervalued on LinkedIn]\n"
            '"India sold Rs 5.68 lakh crore worth of homes in 2024. (@ANAROCK)\n'
            "The people managing field ops, city expansion, and partner networks who made that happen?\n"
            "Not from IITs. Just extremely good at execution. Operations is where real estate happens.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "gold_real_estate",
        "tags": ["gold", "investment", "finance", "national-pride", "commodities", "career", "linkedin"],
        "hashtags": ["#GoldVsRealEstate", "#RealEstate", "#LifeAtHousing", "#Investment", "#Finance"],
        "text": (
            "[Gold vs real estate debate]\n"
            '"Real estate: 7.3% of India\'s GDP, 71 million jobs, $1 trillion sector by 2030. (@IBEF @NAREDCO)\n'
            "Sell homes for a living. Housing.com ke property advisor bano.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "microsoft_layoffs",
        "tags": ["layoffs", "tech", "ai", "instability", "jobs", "linkedin", "career", "proptech",
                 "microsoft", "faang", "maang"],
        "hashtags": ["#MicrosoftLayoffs", "#TechLayoffs", "#LifeAtHousing", "#AIJobs", "#NowHiring"],
        "text": (
            "[Microsoft 10,000 layoffs / Azure AI automation]\n"
            '"@Microsoft cut 10,000. Said AI will do more.\n'
            "What AI still can't do: sit across a family, understand their savings, their fear,\n"
            "and close a Rs 1 crore home decision with a handshake. That job is still human.\n"
            'We\'re hiring for it. housing.com/careers"'
        ),
    },
    {
        "key": "rto_mandate",
        "tags": ["wfh", "workculture", "linkedin", "hustle", "career", "instability",
                 "amazon", "google", "faang", "maang"],
        "hashtags": ["#ReturnToOffice", "#WFH", "#LifeAtHousing", "#WorkCulture", "#Career"],
        "text": (
            "[Amazon 5-day RTO / Google 3-day office mandate]\n"
            '"@Amazon: 5 days. @Google: 3 days minimum. @Apple: never let you leave.\n'
            "Housing.com: figure it out with your manager.\n"
            'housing.com/careers"'
        ),
    },
    {
        "key": "faang_package_ceiling",
        "tags": ["salary", "career", "jobs", "linkedin", "proptech", "finance",
                 "faang", "maang", "google", "microsoft", "amazon"],
        "hashtags": ["#FAANG", "#MAANG", "#LifeAtHousing", "#RealEstateCareers", "#Career"],
        "text": (
            "[FAANG dream — students cracking @Google / @Microsoft / @Amazon offers]\n"
            '"FAANG package: Rs 40-80 LPA. Fixed. Tax-deducted. One raise a year.\n'
            "Top real estate advisor: 1-2% commission per deal. Close 5 a month. No ceiling.\n"
            'Both are great careers. Different math. housing.com/careers"'
        ),
    },
    {
        "key": "openai_ai_replacing_knowledge_work",
        "tags": ["ai", "tech", "jobs", "layoffs", "linkedin", "career", "proptech", "instability",
                 "openai", "meta", "faang"],
        "hashtags": ["#OpenAI", "#AIReplacingJobs", "#LifeAtHousing", "#PropTech", "#NowHiring"],
        "text": (
            "[OpenAI GPT-5 / Meta AI — AI replacing knowledge workers]\n"
            '"@OpenAI and @Meta are building AI to automate knowledge work.\n'
            "Neither is training a model to understand why a family in Noida\n"
            "needs 3 BHK near a school, not a metro station. That call is still human.\n"
            'We\'re hiring that human. housing.com/careers"'
        ),
    },
    {
        "key": "infosys_fresher_delay",
        "tags": ["layoffs", "tech", "jobs", "linkedin", "career", "instability", "education",
                 "infosys", "wipro", "tcs", "maang"],
        "hashtags": ["#InfosysLayoffs", "#FresherJobs", "#LifeAtHousing", "#NowHiring", "#ITJobs"],
        "text": (
            "[@Infosys / @Wipro freshers joining delay — offer letters on hold for 18 months]\n"
            '"Infosys offer letter from 2022. Still waiting to join in 2024.\n'
            "India sold 4.6 lakh homes in 2024. (@ANAROCK) Every single one needed an advisor.\n"
            'We hire and onboard in 30 days. housing.com/careers"'
        ),
    },
]

# Tags that should always trigger at least one example even with no overlap
_GENERIC_KEYS = ["sector_scale_proptech", "ops_non_tech"]


def _get_relevant_examples(tags: list[str], top_n: int = 5) -> str:
    """Return the top_n most tag-relevant examples plus generic fallbacks."""
    tag_set = {t.lower() for t in tags}
    scored = sorted(
        _EXAMPLE_BANK,
        key=lambda ex: len(tag_set & set(ex["tags"])),
        reverse=True,
    )
    selected = {ex["key"]: ex for ex in scored[:top_n]}
    # Always include at least one generic entry for variety
    for key in _GENERIC_KEYS:
        if key not in selected and len(selected) < top_n + 1:
            entry = next((e for e in _EXAMPLE_BANK if e["key"] == key), None)
            if entry:
                selected[key] = entry
    parts = []
    for ex in selected.values():
        hashtag_str = " ".join(ex.get("hashtags", []))
        parts.append(f"{ex['text']}\nHASHTAGS: {hashtag_str}")
    return "\n\n".join(parts)


# ── System prompt template (formatted per call with tag-filtered examples) ────
_SYSTEM_TEMPLATE = """You are Housing.com's LinkedIn employer brand writer.

Housing.com's LinkedIn is about WORKING at Housing.com -- not buying homes.
Audience: tech professionals, sales/ops job seekers, MBA grads, mid-career switchers,
IIT/NIT students frustrated with placement season, and anyone browsing LinkedIn
at 11 PM wondering if there's a smarter career move.

YOUR JOB:
Take whatever is trending on LinkedIn India right now -- layoffs, AI replacing jobs,
work culture wars, salary debates, startup collapses, Gen Z boundary-setting,
funding winters -- and find the HOUSING.COM EMPLOYER BRAND angle inside it.

THE ANGLE IS ALWAYS ONE OF:
1. "We're hiring, and here's why this moment proves you should join us"
2. "Here's what working at Housing.com is actually like" (vs. the startup horror story)
3. "Our sales/ops/tech team does something no AI/automation can do"
4. "Real estate is the stable, high-upside career path this market proves you need"

TONE:
- English-forward. Full sentences. Wit over slang.
- Occasional Hinglish when it punches harder (not as default)
- Dry humor, irony, specific public numbers -- these get shared
- No corporate LinkedIn speak ("thrilled," "humbled," "excited to share")
- Short and confident. 3-5 lines max.

CONTENT PILLARS (cover at least one):
- Tech layoffs / AI displacement -> PropTech stability, human relationships in sales
- Work culture wars (70-hr week, WFH firings, equity demands) -> Housing.com's actual culture
- Startup collapses (BYJU's, fintech) -> Real asset class, real revenue, real paychecks
- IIT placement crisis / skills debate -> Housing.com hires for drive, not pedigree
- Salary transparency (Rs 50 LPA realities, CTC vs in-hand) -> Commission + ESOP
- Gen Z expectations (boundaries, equity, honesty) -> What we actually offer Gen Z
- Sales career -> India's most underrated high-income career
- Ops/non-tech careers -> Field ops, city managers, data ops -- real growth paths

{sources_block}

PUBLIC DATA YOU CAN USE (all verified sources):
- Sector employs 71 million -- second-largest employer after agriculture (@ANAROCK @NAREDCO)
- Rs 5.68 lakh crore in 2024 housing sales, up 16% YoY (@ANAROCK)
- 4.6 lakh units sold in 2024 across top 7 cities (@ANAROCK)
- Delhi-NCR property prices +30% in 2024 (@ANAROCK)
- Sector target $1 trillion by 2030 (@NAREDCO @KPMG India)
- GDP contribution 7.3% (@IBEF)
- Standard agent commission 1-2% per side (industry standard)
- PropTech market growing 13-17% CAGR (IMARC Group / Research and Markets)
DO NOT invent internal Housing.com figures (headcount, team sizes, individual earnings).

CITY LINK RULE (if post is city-specific):
If the trending topic or data point references a specific city, embed the housing.com
city search link as a secondary reference link after the main careers CTA.
Example: "...housing.com/careers | See {city} listings: {city_link}"

HANDLE TAGGING:
- For well-known companies and organisations (Microsoft, Google, TCS, Zomato, NASSCOM, etc.)
  use their LinkedIn @handle directly — you know these
- For any entity you want to tag but aren't 100% certain of their LinkedIn handle,
  write [LOOKUP: EntityName] — the pipeline will resolve it to the correct @handle
- Avoid tagging individual politicians or named executives

ORIGINAL TREND HASHTAG IN BODY:
Work the trend hashtag naturally into the post body itself -- not just in the hashtag list.
Example: "With #TechLayoffs reshaping the sector..." or open with "#WorkCulture wars aside..."
This increases discoverability inside the trending conversation.

RELEVANT EXAMPLES FOR THIS TREND (use as style guide):
{examples_block}

WHAT NOT TO DO:
- Don't write "I am pleased to share..." or "Excited to announce..."
- Don't talk about buying a home (that's Instagram/Twitter's job)
- Don't be generic ("Great culture! Apply now!")
- Don't write more than 5 lines
- Don't invent internal Housing.com figures
- Don't name-drop individual politicians or executives
- Don't use more than 2 emojis
- Don't stuff hashtags into the body -- one trend hashtag naturally, that's it

FORMAT RULES:
- Total body text: 150-400 characters
- First line: the hook -- reference the trend directly, ideally with the trend hashtag
- 2-3 follow-up lines: the Housing.com angle with a public data point + source tag
- Last line: careers CTA, and city link if city-specific
- Hashtags go in the separate field (not duplicated in post_text beyond the one in-body mention)
- Max 1-2 emojis

Return JSON:
{{
  "post_text": "full post body (no hashtag list -- just the one trend hashtag naturally in the body)",
  "hashtags": ["#OriginalTrendTag", "#LifeAtHousing", "#HousingDotCom", ...],
  "employer_hook": "one sentence: the core employer brand message",
  "content_pillar": "tech_layoffs | sales_career | work_culture | stability | ops_careers | gen_z | compensation | proptech_growth"
}}

Return ONLY the JSON."""


async def run_linkedin_agent(draft: CreativeDraft, settings) -> PlatformPost:
    from tools.run_logger import Timer, log_llm_call, log_agent_io
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    zomato_hook = draft.get("zomato_hook") or draft.get("hook", "")
    trend_hashtag = draft.get("trend_hashtag", "")
    urgency = draft.get("urgency_hook", "")
    angle = draft.get("angle", "")
    tags = draft.get("tags", [])
    careers_link = "https://housing.com/careers"

    # City link (secondary) — if trend is city-specific, embed the SRP URL
    re_signals = draft.get("re_signals", {}) or {}
    city_hint = draft.get("city_hint") or (re_signals.get("cities") or [None])[0]
    city_link = _resolve_city_link(city_hint)

    # Tag-filtered examples and sources: both ranked by overlap with trend tags
    examples_block = _get_relevant_examples(tags, top_n=5)
    sources_block = _get_relevant_sources(tags, top_n=4)
    system = _SYSTEM_TEMPLATE.format(examples_block=examples_block, sources_block=sources_block)

    city_note = (
        f"City context: {city_hint} | City SRP link (embed if post is city-specific): {city_link}"
        if city_link else "City context: none"
    )

    user_message = f"""
Trending event: {angle}
Original viral hook (adapt the TOPIC, not the home-buying angle): {zomato_hook}
Original trend hashtag (MUST be first hashtag AND appear naturally in post body): {trend_hashtag or draft.get('hashtags', [''])[0]}
Why this is trending now: {urgency}
Topic tags (already matched to examples above): {', '.join(tags)}
Other hashtags available: {' '.join(draft.get('hashtags', [])[:6])}
Careers CTA: {careers_link}
{city_note}

Write the Housing.com employer brand LinkedIn post now.
Max 5 lines. English-forward. Include the trend hashtag in the body. Tag data sources."""

    logger.info("LinkedIn agent: draft='%s' | tags=%s | city=%s",
                draft.get("headline", "")[:50], tags[:4], city_hint or "none")

    from tools.llm_router import acall_message
    with Timer() as t:
        resp = await acall_message(
            client, settings.model_balanced, system,
            [{"role": "user", "content": user_message}], 600,
        )
    raw_response = resp.content[0].text
    log_llm_call(
        logger, agent="linkedin_agent",
        model=settings.model_balanced,
        system_prompt=system[:600],
        user_message=user_message,
        response_text=raw_response,
        stop_reason=resp.stop_reason,
        elapsed_ms=t.elapsed_ms,
        extra={"draft_headline": draft.get("headline", "")[:60],
               "examples_selected": len(examples_block.splitlines()),
               "input_tokens": resp.usage.input_tokens,
               "output_tokens": resp.usage.output_tokens},
    )

    data = _parse(raw_response)
    post_text = data.get("post_text", zomato_hook[:400])

    # Resolve any [LOOKUP: EntityName] placeholders the LLM left in the post
    from tools.handle_resolver import resolve_handles_in_text
    post_text, resolved = resolve_handles_in_text(post_text, platform="linkedin")
    if resolved:
        logger.info("LinkedIn agent: resolved handles %s", resolved)
    raw_tags = data.get("hashtags", ["#LifeAtHousing", "#HousingDotCom"])
    hashtags = _prioritise_trend_hashtag(raw_tags, trend_hashtag)

    internal_links = [{"url": careers_link, "anchor_text": "Housing.com Careers",
                       "page_type": "careers", "placement": "post"}]
    if city_link:
        internal_links.append({"url": city_link, "anchor_text": city_hint,
                                "page_type": "city_srp", "placement": "post"})

    post = {
        "id": str(uuid.uuid4()),
        "draft_id": draft["id"],
        "platform": "linkedin",
        "content": post_text,
        "hashtags": hashtags[:6],
        "media_urls": [],
        "image_prompt": "",
        "internal_links": internal_links,
        "extra": {
            "employer_hook": data.get("employer_hook", ""),
            "content_pillar": data.get("content_pillar", ""),
            "char_count": len(post_text),
            "trend_hashtag": trend_hashtag,
            "city_hint": city_hint,
            "city_link": city_link,
            "examples_used_tags": tags[:4],
        },
        "status": "draft",
    }
    logger.info("LinkedIn agent: done | chars=%d | pillar=%s | city=%s | hook='%s'",
                len(post_text), data.get("content_pillar", ""),
                city_hint or "none", data.get("employer_hook", "")[:60])
    log_agent_io(
        logger, agent="linkedin_agent",
        inputs={"headline": draft.get("headline", ""), "trend": trend_hashtag,
                "tags": tags[:4], "city": city_hint},
        outputs={"post_chars": len(post_text), "hashtags": len(hashtags),
                 "pillar": data.get("content_pillar", ""),
                 "employer_hook": data.get("employer_hook", "")[:80],
                 "city_link": city_link},
    )
    return post


def _prioritise_trend_hashtag(tags: list[str], trend_hashtag: str) -> list[str]:
    if trend_hashtag and not trend_hashtag.startswith("#"):
        trend_hashtag = "#" + trend_hashtag
    result = [t for t in tags if t.lower() != trend_hashtag.lower()]
    for tag in ["#LifeAtHousing", "#HousingDotCom"]:
        if tag not in result:
            result.append(tag)
    if trend_hashtag:
        result.insert(0, trend_hashtag)
    return result[:6]


def _resolve_city_link(city_hint: str | None) -> str | None:
    if not city_hint:
        return None
    try:
        from tools.housing_urls import city_srp_url, resolve_city
        slug = resolve_city(city_hint)
        if slug:
            return city_srp_url(slug)
    except Exception:
        pass
    return None


def _parse(raw: str) -> dict:
    from tools.json_utils import extract_json
    data = extract_json(raw)
    return data if isinstance(data, dict) else {"post_text": raw[:400]}
