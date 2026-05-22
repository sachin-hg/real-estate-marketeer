"""
Module 9 Exercise — SOLUTION
1. PMAY/RERA government policy carve-out allows legitimate housing scheme content.
2. Revision loop re-queues fixable posts instead of discarding them.
"""
import json
import anthropic

client = anthropic.Anthropic()

SAFETY_SYSTEM = """
Review this social media post for brand safety violations.

HARD BLOCKS — reject if present:
- Religious, caste, or communal content
- Named politicians as individuals or political party names
- Forward-looking price guarantees with specific numbers
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
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=SAFETY_SYSTEM,
        messages=[{"role": "user", "content": f"Post:\n{json.dumps(post)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


QUALITY_SYSTEM = """
Score this post 0.0–1.0 on: re_relevance, brand_voice, trend_hook, platform_fit, engagement.
Overall = average. Decision: "publish" if ≥ 0.70 else "revise".

Output ONLY valid JSON:
{
  "overall": 0.0,
  "decision": "publish|revise",
  "critique": "...",
  "locked_elements": ["preserve these on revision"],
  "revision_instructions": "specific fix if revise"
}
"""


def quality_scorer(post: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=QUALITY_SYSTEM,
        messages=[{"role": "user", "content": f"Post:\n{json.dumps(post)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def revise_post(post: dict, quality_result: dict) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system="Revise this post. Preserve locked_elements. Apply revision_instructions only.",
        messages=[{
            "role": "user",
            "content": (
                f"Post: {json.dumps(post)}\n"
                f"Locked: {quality_result.get('locked_elements', [])}\n"
                f"Fix: {quality_result.get('revision_instructions', '')}"
            )
        }]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def qa_pipeline(post: dict, max_revisions: int = 2) -> dict:
    safety = safety_gate(post)
    if not safety["passed"]:
        return {**post, "qa_decision": "reject", "qa_reason": "safety_violation"}

    qa_attempt = 0
    current_post = post

    while qa_attempt <= max_revisions:
        quality = quality_scorer(current_post)
        decision = quality.get("decision", "revise")

        if decision == "publish":
            return {**current_post, "qa_decision": "publish",
                    "qa_overall": quality.get("overall", 0)}

        if qa_attempt >= max_revisions:
            return {**current_post, "qa_decision": "reject",
                    "qa_reason": "quality_below_threshold",
                    "qa_overall": quality.get("overall", 0)}

        # Revision: re-run platform agent with specific instructions, increment counter
        current_post = revise_post(current_post, quality)
        qa_attempt += 1

    return {**current_post, "qa_decision": "reject", "qa_reason": "loop_exhausted"}


if __name__ == "__main__":
    pmay_post = {
        "platform": "twitter",
        "main_tweet": "PMAY beneficiaries can now apply online for affordable housing subsidy 🏠 #PMAY #AffordableHousing",
        "hashtags": ["#PMAY", "#AffordableHousing"],
    }
    political_post = {
        "platform": "twitter",
        "main_tweet": "BJP's housing scheme is the best! Vote for better homes. #BJP",
        "hashtags": ["#BJP"],
    }

    print("Test 1 — PMAY post (should pass safety):")
    r1 = qa_pipeline(pmay_post)
    print(f"  Decision: {r1.get('qa_decision', '?')}")

    print("\nTest 2 — Political post (should fail safety):")
    r2 = qa_pipeline(political_post)
    print(f"  Decision: {r2.get('qa_decision', '?')}, Reason: {r2.get('qa_reason', '?')}")
