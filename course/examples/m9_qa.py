"""
Module 9 — QA: Agents Evaluating Agents
pipeline.py v8: 3-pass QA with safety gate, quality scoring, revision loop.

Run:
    pip install anthropic
    ANTHROPIC_API_KEY=sk-... python m9_qa.py
"""
import json
import asyncio
import anthropic

client = anthropic.Anthropic()

# ─── Pass 1: Safety Gate ────────────────────────────────────────────────────

SAFETY_SYSTEM = """
Review this social media post for brand safety violations.

HARD BLOCKS — reject if present:
- Religious, caste, or communal content
- Named politicians as individuals or political party names
- Forward-looking price guarantees with specific numbers ("prices WILL rise 40%")
- Discriminatory language of any kind

EXCEPTION — government HOUSING POLICY content is ALLOWED:
- PMAY (Pradhan Mantri Awas Yojana) — government affordable housing scheme
- RERA (Real Estate Regulatory Authority) — buyer protection law
- PM Awas Yojana, Swachh Bharat (for housing components)
- RBI repo rate announcements affecting home loans
These are legitimate policy topics Housing.com covers; they are NOT political.

Output ONLY valid JSON:
{"passed": true/false, "violations": [], "categories": []}
"""


def safety_gate(post: dict) -> dict:
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",   # cheap binary check
        max_tokens=256,
        system=SAFETY_SYSTEM,
        messages=[{"role": "user", "content": f"Post to review:\n{json.dumps(post, indent=2)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


# ─── Pass 2: Quality Scoring ────────────────────────────────────────────────

QUALITY_SYSTEM = """
Score this social media post on 5 dimensions (0.0–1.0 each):

1. re_relevance   — genuine real estate angle (not forced)
2. brand_voice    — Hinglish wit, Zomato-style (not generic corporate)
3. trend_hook     — trend is the HERO; housing is the PUNCHLINE
4. platform_fit   — respects platform constraints (char limits, hashtag count)
5. engagement     — would make someone stop scrolling, comment, or share

Overall = average of 5 dimensions.
Decision: "publish" if overall ≥ 0.70, else "revise".

Output ONLY valid JSON:
{
  "dimensions": {
    "re_relevance": 0.0,
    "brand_voice": 0.0,
    "trend_hook": 0.0,
    "platform_fit": 0.0,
    "engagement": 0.0
  },
  "overall": 0.0,
  "decision": "publish|revise",
  "critique": "...",
  "locked_elements": ["elements to preserve on revision"],
  "revision_instructions": "specific actionable fix if revise"
}
"""


def quality_scorer(post: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",   # nuanced scoring needs Sonnet
        max_tokens=512,
        system=QUALITY_SYSTEM,
        messages=[{"role": "user", "content": f"Post:\n{json.dumps(post, indent=2)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


# ─── Pass 3: Engagement Prediction ─────────────────────────────────────────

ENGAGEMENT_SYSTEM = """
Predict engagement for this Housing.com social post (Twitter/Instagram).

Estimate for a housing brand with ~50k followers:
- impressions: integer (typical range 500–15000)
- likes: integer
- shares/retweets: integer
- comments: integer
- engagement_rate: float (likes+comments+shares / impressions)
- confidence: 0.0–1.0 (how confident you are)

Base estimates on: trend recency, Hinglish vs English, CTA strength, hook quality.

Output ONLY valid JSON matching the shape above.
"""


def engagement_predictor(post: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=ENGAGEMENT_SYSTEM,
        messages=[{"role": "user", "content": f"Post:\n{json.dumps(post, indent=2)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


# ─── Platform agent (used by revision loop) ─────────────────────────────────

REVISION_SYSTEM = """
You are revising a Housing.com social post based on QA feedback.
Make ONLY the changes specified in revision_instructions.
Preserve ALL locked_elements exactly as given.
Output the revised post in the same JSON schema as the input.
"""


def revise_post(post: dict, quality_result: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=REVISION_SYSTEM,
        messages=[{
            "role": "user",
            "content": (
                f"Original post:\n{json.dumps(post, indent=2)}\n\n"
                f"Locked elements (PRESERVE THESE): {quality_result.get('locked_elements', [])}\n"
                f"Revision instructions: {quality_result.get('revision_instructions', '')}"
            )
        }]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


# ─── Full 3-pass QA pipeline ────────────────────────────────────────────────

def qa_pipeline(post: dict, max_revisions: int = 2) -> dict:
    print(f"\n{'─'*50}")
    print(f"QA: {post.get('platform', '?')} post")

    # Pass 1 — safety (fast, cheap)
    safety = safety_gate(post)
    print(f"  Pass 1 safety: {'✓ passed' if safety['passed'] else '✗ BLOCKED — ' + str(safety.get('violations', []))}")
    if not safety["passed"]:
        return {**post, "qa_decision": "reject", "qa_reason": "safety_violation",
                "violations": safety.get("violations", [])}

    qa_attempt = 0
    current_post = post
    while qa_attempt <= max_revisions:
        # Pass 2 — quality scoring
        quality = quality_scorer(current_post)
        score = quality.get("overall", 0)
        decision = quality.get("decision", "revise")
        print(f"  Pass 2 quality (attempt {qa_attempt}): {score:.2f} → {decision}")

        if decision == "publish":
            break

        if qa_attempt >= max_revisions:
            print(f"  Max revisions reached — rejecting")
            return {**current_post, "qa_decision": "reject", "qa_reason": "quality_below_threshold",
                    "qa_overall": score, "qa_critique": quality.get("critique", "")}

        # Re-run platform agent with revision instructions
        print(f"  Revising: {quality.get('revision_instructions', '')[:80]}...")
        current_post = revise_post(current_post, quality)
        qa_attempt += 1

    # Pass 3 — engagement prediction (on the approved post)
    engagement = engagement_predictor(current_post)
    pred_er = engagement.get("engagement_rate", 0)
    print(f"  Pass 3 engagement: predicted ER {pred_er:.3f} ({engagement.get('confidence', 0):.0%} confidence)")

    return {
        **current_post,
        "qa_decision": "publish",
        "qa_overall": quality.get("overall", 0),
        "qa_dimensions": quality.get("dimensions", {}),
        "qa_critique": quality.get("critique", ""),
        "pred_impressions": engagement.get("impressions", 0),
        "pred_likes": engagement.get("likes", 0),
        "pred_shares": engagement.get("shares", 0),
        "pred_engagement_rate": pred_er,
        "pred_confidence": engagement.get("confidence", 0),
    }


# ─── Demo ────────────────────────────────────────────────────────────────────

GOOD_POST = {
    "platform": "twitter",
    "main_tweet": "Coldplay ka ticket 8 minute mein sold out. PMAY application window 30 din khuli hai 🏠 Priorities toh sahi rakho Mumbai. #PMAY #MumbaiHomes",
    "hashtags": ["#PMAY", "#MumbaiHomes", "#StampDuty", "#HousingCom"],
    "draft_type": "social",
}

POLITICAL_POST = {
    "platform": "twitter",
    "main_tweet": "BJP's housing scheme is amazing! Vote for better homes 🏠 #BJP #Elections2025",
    "hashtags": ["#BJP", "#Elections2025"],
    "draft_type": "social",
}

if __name__ == "__main__":
    print("=" * 60)
    print("TEST 1: Good post (PMAY government scheme — should PASS safety)")
    print("=" * 60)
    result1 = qa_pipeline(GOOD_POST)
    print(f"\nFinal decision: {result1.get('qa_decision', '?').upper()}")
    if result1.get("qa_decision") == "publish":
        print(f"QA score: {result1.get('qa_overall', 0):.2f}")
        print(f"Predicted ER: {result1.get('pred_engagement_rate', 0):.3f}")

    print("\n" + "=" * 60)
    print("TEST 2: Political post — should FAIL safety gate")
    print("=" * 60)
    result2 = qa_pipeline(POLITICAL_POST)
    print(f"\nFinal decision: {result2.get('qa_decision', '?').upper()}")
    if result2.get("qa_decision") == "reject":
        print(f"Reason: {result2.get('qa_reason', '?')}")
        print(f"Violations: {result2.get('violations', [])}")
