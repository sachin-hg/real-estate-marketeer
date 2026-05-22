"""
Module 7 Exercise — Creative Agents & Prompt Engineering
Your task: Complete get_examples() to include negative examples in the prompt.
"""
import json
import anthropic

client = anthropic.Anthropic()

HOOKS_BANK = {
    "examples": [
        {
            "tags": ["stamp_duty", "mumbai", "affordable"],
            "hook": "Ek Coldplay concert ka ticket ya 3% kam stamp duty — dono ek hi din mila Mumbai ko 🏠",
        },
        {
            "tags": ["metro", "bengaluru", "investment"],
            "hook": "Metro announcement aaya aur Whitefield ka flat already 8% oopar. Tumhara kitna badhega?",
        },
        {
            "tags": ["rbi", "home_loan", "emi"],
            "hook": "RBI ne rate hold kiya — which means your EMI holds too. Ab sochna kab band karoge?",
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
    """
    Build the examples block to inject into the creative system prompt.
    Must include BOTH positive examples AND negative examples.
    """
    positives = [
        e for e in HOOKS_BANK["examples"]
        if any(t in e.get("tags", []) for t in tags)
    ][:4]
    negatives = HOOKS_BANK.get("negative_examples", [])[:2]

    output = "WRITE LIKE THESE:\n"
    for ex in positives:
        output += f'  "{ex["hook"]}"\n'

    # TODO: Append the DO NOT WRITE section using the `negatives` list.
    # Hint: negatives is already loaded and has "hook" and "avoid_because" fields.
    # Without this section the LLM drifts toward safe, generic corporate copy.
    # Each entry should show the bad hook AND explain why to avoid it.
    ???

    return output


SOCIAL_CREATIVE_SYSTEM = """
You write social media content for Housing.com — Zomato's wit meets real estate.
Hinglish, max 2 emojis, trend = HERO housing = PUNCHLINE.

{examples}

Output ONLY valid JSON:
{{"main_tweet": "...", "hashtags": ["..."], "instagram_caption": "..."}}
"""


def social_creative_node(brief: dict) -> dict:
    examples_block = get_examples(brief.get("tags", []))
    system = SOCIAL_CREATIVE_SYSTEM.format(examples=examples_block)
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": f"Brief: {json.dumps(brief)}"}]
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


if __name__ == "__main__":
    brief = {
        "topic": "Mumbai stamp duty cut",
        "angle": "Savings bigger than a Coldplay ticket",
        "tone": "hinglish_viral",
        "tags": ["stamp_duty", "mumbai"],
    }
    examples = get_examples(brief["tags"])
    print("Examples block sent to LLM:")
    print(examples)
    # Expected: shows WRITE LIKE THESE + DO NOT WRITE LIKE THESE sections
