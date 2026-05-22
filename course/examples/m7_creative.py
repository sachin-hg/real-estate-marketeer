"""
Module 7 — Creative Agents & Prompt Engineering
pipeline.py v6: Social creative with few-shot hooks bank; news creative.

Run:
    pip install anthropic
    ANTHROPIC_API_KEY=sk-... python m7_creative.py
"""
import json
import anthropic

client = anthropic.Anthropic()

# --- Hooks bank (inline for the example; real system loads from hooks_bank.json) ---
HOOKS_BANK = {
    "examples": [
        {
            "tags": ["stamp_duty", "mumbai", "affordable"],
            "hook": "Ek Coldplay concert ka ticket ya 3% kam stamp duty — dono ek hi din mila Mumbai ko 🏠",
            "platform": "twitter",
            "avoid_because": None,
        },
        {
            "tags": ["metro", "bengaluru", "investment"],
            "hook": "Metro announcement aaya aur Whitefield ka flat already 8% oopar. Tumhara kitna badhega?",
            "platform": "twitter",
            "avoid_because": None,
        },
        {
            "tags": ["rbi", "home_loan", "emi"],
            "hook": "RBI ne rate hold kiya — which means your EMI holds too. Ab sochna kab band karoge?",
            "platform": "instagram",
            "avoid_because": None,
        },
    ],
    "negative_examples": [
        {
            "hook": "Housing.com pe best deals milti hain. Aaj hi check karo!",
            "avoid_because": "Generic CTA with no trend hook — sounds like an ad, not content",
        },
        {
            "hook": "Real estate prices are rising. Now is a good time to invest.",
            "avoid_because": "Formal English, no personality, no trend attachment — boring and skippable",
        },
    ],
}


def get_examples(tags: list[str]) -> str:
    """Retrieve matching positive and negative examples for the prompt."""
    positives = [
        e for e in HOOKS_BANK["examples"]
        if any(t in e.get("tags", []) for t in tags)
    ][:4]
    negatives = HOOKS_BANK.get("negative_examples", [])[:2]

    output = "WRITE LIKE THESE:\n"
    for ex in positives:
        output += f'  "{ex["hook"]}"\n'

    output += "\nDO NOT WRITE LIKE THESE:\n"
    for neg in negatives:
        output += f'  "{neg["hook"]}"\n'
        output += f'  (avoid because: {neg["avoid_because"]})\n'

    return output


SOCIAL_CREATIVE_SYSTEM = """
You write social media content for Housing.com — Zomato's wit meets real estate.

Identity: Witty brand that trend-jacks viral moments.
Style: Hinglish, max 2 emojis, city → embed housing.com SRP link placeholder.
Zomato model: trend = HERO, housing = PUNCHLINE (not the other way round).
Goal: Make people stop scrolling.

{examples}

Output ONLY valid JSON with this shape:
{{
  "main_tweet": "...",
  "thread": ["...", "..."],
  "hashtags": ["#TrendingTag", "#HousingCom", "#City"],
  "instagram_caption": "...",
  "media_format": "image_card"
}}
"""

NEWS_CREATIVE_SYSTEM = """
You write SEO-first news articles for Housing.com's editorial section.

Style: Clear, informative, buyer-focused. No jargon. 700-1000 words.
Structure: headline → lede (what happened + why it matters to buyers) →
           context → impact on prices/EMIs/demand → expert quotes (fabricated OK) →
           housing.com internal link placeholders → conclusion with CTA.

Output ONLY valid JSON:
{{
  "headline": "...",
  "seo_slug": "...",
  "meta_description": "...",
  "body_markdown": "...",
  "internal_links": [{{"anchor": "...", "page_type": "SRP"}}]
}}
"""


def social_creative_node(brief: dict) -> dict:
    examples_block = get_examples(brief.get("tags", []) + [brief.get("tone", "")])
    system = SOCIAL_CREATIVE_SYSTEM.format(examples=examples_block)

    resp = client.messages.create(
        model="claude-opus-4-7",   # creative social needs Opus
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": f"Brief:\n{json.dumps(brief, indent=2)}"}]
    )

    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    draft = json.loads(text)
    draft["draft_type"] = "social"
    draft["brief_topic"] = brief.get("topic", "")
    return draft


def news_creative_node(brief: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",  # Sonnet for news — balanced quality/cost
        max_tokens=2048,
        system=NEWS_CREATIVE_SYSTEM,
        messages=[{"role": "user", "content": f"Brief:\n{json.dumps(brief, indent=2)}"}]
    )

    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    article = json.loads(text)
    article["draft_type"] = "news"
    article["brief_topic"] = brief.get("topic", "")
    return article


# --- Demo ---

SOCIAL_BRIEF = {
    "topic": "Mumbai stamp duty reduced for first-time buyers",
    "angle": "Coldplay sold out in 8 min but stamp duty savings open all day",
    "draft_type": "social",
    "target_platforms": ["twitter", "instagram"],
    "tone": "hinglish_viral",
    "urgency": "trending",
    "source_summary": "Maharashtra reduces stamp duty to 3% for properties below 45L.",
    "city_hint": "Mumbai",
    "tags": ["stamp_duty", "mumbai", "affordable"],
}

NEWS_BRIEF = {
    "topic": "RBI holds repo rate — home loan EMIs stable",
    "angle": "What the rate hold means for buyers sitting on the fence",
    "draft_type": "news",
    "target_platforms": ["housing_news"],
    "tone": "formal_seo",
    "urgency": "breaking",
    "source_summary": "RBI held repo rate at 6.5% in latest MPC meeting.",
    "city_hint": None,
    "seo_keywords": ["home loan EMI", "RBI repo rate", "housing market 2025"],
    "tags": ["rbi", "home_loan", "emi"],
}

if __name__ == "__main__":
    print("=" * 60)
    print("SOCIAL CREATIVE (Opus 4.7 — Hinglish + trend hook)")
    print("=" * 60)
    social = social_creative_node(SOCIAL_BRIEF)
    print(f"\nMain tweet:\n  {social.get('main_tweet', '')}")
    print(f"\nHashtags: {' '.join(social.get('hashtags', []))}")
    print(f"\nInstagram caption:\n  {social.get('instagram_caption', '')[:200]}...")

    print("\n" + "=" * 60)
    print("NEWS CREATIVE (Sonnet 4.6 — SEO article)")
    print("=" * 60)
    news = news_creative_node(NEWS_BRIEF)
    print(f"\nHeadline: {news.get('headline', '')}")
    print(f"SEO slug: {news.get('seo_slug', '')}")
    print(f"Meta desc: {news.get('meta_description', '')}")
    body = news.get("body_markdown", "")
    print(f"\nArticle preview (first 400 chars):\n{body[:400]}...")
