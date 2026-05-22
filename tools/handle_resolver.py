"""
Runtime social-handle resolver.

Usage in platform agents:
    from tools.handle_resolver import resolve_handles_in_text

    # In the LLM system prompt, instruct the model:
    #   "For any entity you want to tag but aren't certain of their handle,
    #    write [LOOKUP: EntityName] and the pipeline will resolve it."

    post_text, found_handles = resolve_handles_in_text(raw_llm_output, platform="linkedin")

Resolution order:
  1. _KNOWN dict — covers FAANG/MAANG, Indian IT/startups, sports, govt bodies
  2. Partial-key match (e.g. "Microsoft Corporation" → "microsoft")
  3. Web-search fallback — searches for the official profile URL and extracts the slug

All results are cached in-memory (lru_cache) for the process lifetime.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# ── Known handles ─────────────────────────────────────────────────────────────
# Keyed by normalised entity name (lowercase, stripped).
# Add entries here as new recurring entities appear — this avoids unnecessary
# web-search round-trips for commonly referenced organisations.
_KNOWN: dict[str, dict[str, str]] = {
    # FAANG / MAANG
    "microsoft":       {"linkedin": "@Microsoft",        "twitter": "@Microsoft",       "instagram": "@microsoft"},
    "google":          {"linkedin": "@Google",            "twitter": "@Google",           "instagram": "@google"},
    "alphabet":        {"linkedin": "@Google",            "twitter": "@Google",           "instagram": "@google"},
    "meta":            {"linkedin": "@Meta",              "twitter": "@Meta",             "instagram": "@meta"},
    "facebook":        {"linkedin": "@Facebook",          "twitter": "@Facebook",         "instagram": "@facebook"},
    "amazon":          {"linkedin": "@Amazon",            "twitter": "@Amazon",           "instagram": "@amazon"},
    "apple":           {"linkedin": "@Apple",             "twitter": "@Apple",            "instagram": "@apple"},
    "netflix":         {"linkedin": "@Netflix",           "twitter": "@Netflix",          "instagram": "@netflix"},
    "openai":          {"linkedin": "@OpenAI",            "twitter": "@OpenAI",           "instagram": "@openai"},
    "anthropic":       {"linkedin": "@Anthropic",         "twitter": "@AnthropicAI",      "instagram": "@anthropic_ai"},
    # Indian IT majors
    "tcs":             {"linkedin": "@Tata-Consultancy-Services", "twitter": "@TCS",      "instagram": "@tcsnews"},
    "infosys":         {"linkedin": "@Infosys",           "twitter": "@Infosys",          "instagram": "@infosys"},
    "wipro":           {"linkedin": "@Wipro",             "twitter": "@Wipro",            "instagram": "@wipro"},
    "hcl":             {"linkedin": "@HCL-Technologies",  "twitter": "@HCLTech",          "instagram": "@hcltech"},
    "tech mahindra":   {"linkedin": "@Tech-Mahindra",     "twitter": "@TechMahindra",     "instagram": "@techmahindra"},
    "accenture":       {"linkedin": "@Accenture",         "twitter": "@Accenture",        "instagram": "@accenture"},
    "oracle":          {"linkedin": "@Oracle",            "twitter": "@Oracle",           "instagram": "@oracle"},
    "ibm":             {"linkedin": "@IBM",               "twitter": "@IBM",              "instagram": "@ibm"},
    "salesforce":      {"linkedin": "@Salesforce",        "twitter": "@Salesforce",       "instagram": "@salesforce"},
    # Indian new-age
    "zomato":          {"linkedin": "@Zomato",            "twitter": "@zomato",           "instagram": "@zomato"},
    "swiggy":          {"linkedin": "@Swiggy",            "twitter": "@Swiggy",           "instagram": "@swiggy"},
    "paytm":           {"linkedin": "@Paytm",             "twitter": "@Paytm",            "instagram": "@paytm"},
    "byjus":           {"linkedin": "@BYJU's",            "twitter": "@BYJUSlearning",    "instagram": "@byjus"},
    "byju":            {"linkedin": "@BYJU's",            "twitter": "@BYJUSlearning",    "instagram": "@byjus"},
    "ola":             {"linkedin": "@Ola",               "twitter": "@Olacabs",          "instagram": "@olacabs"},
    "ola electric":    {"linkedin": "@Ola-Electric",      "twitter": "@OlaElectric",      "instagram": "@olaelectric"},
    "uber":            {"linkedin": "@Uber",              "twitter": "@Uber",             "instagram": "@uber"},
    "flipkart":        {"linkedin": "@Flipkart",          "twitter": "@Flipkart",         "instagram": "@flipkart"},
    "meesho":          {"linkedin": "@Meesho",            "twitter": "@Meesho",           "instagram": "@meesho"},
    "phonepe":         {"linkedin": "@PhonePe",           "twitter": "@PhonePe_",         "instagram": "@phonepe"},
    "razorpay":        {"linkedin": "@Razorpay",          "twitter": "@Razorpay",         "instagram": "@razorpay"},
    "zepto":           {"linkedin": "@Zepto",             "twitter": "@ZeptoNow",         "instagram": "@zepto"},
    "cred":            {"linkedin": "@CRED-Club",         "twitter": "@CRED_club",        "instagram": "@cred_club"},
    "oyo":             {"linkedin": "@OYO",               "twitter": "@OYORooms",         "instagram": "@oyorooms"},
    "nykaa":           {"linkedin": "@Nykaa",             "twitter": "@nykaa",            "instagram": "@nykaa"},
    "myntra":          {"linkedin": "@Myntra",            "twitter": "@myntra",           "instagram": "@myntra"},
    "lenskart":        {"linkedin": "@Lenskart",          "twitter": "@lenskart",         "instagram": "@lenskart"},
    "groww":           {"linkedin": "@Groww",             "twitter": "@_groww",           "instagram": "@groww_official"},
    "zerodha":         {"linkedin": "@Zerodha",           "twitter": "@zerodha",          "instagram": "@zerodha"},
    "angel one":       {"linkedin": "@Angel-One",         "twitter": "@AngelOneBroking",  "instagram": "@angelbroking"},
    # Real estate / prop-tech
    "anarock":         {"linkedin": "@ANAROCK",           "twitter": "@ANAROCK_India",    "instagram": "@anarock_india"},
    "naredco":         {"linkedin": "@NAREDCO",           "twitter": "@naredco_india",    "instagram": "@naredco_india"},
    "magicbricks":     {"linkedin": "@Magicbricks",       "twitter": "@magicbricks",      "instagram": "@magicbricks"},
    "99acres":         {"linkedin": "@99acres",           "twitter": "@99acres",          "instagram": "@99acres"},
    "nobroker":        {"linkedin": "@NoBroker",          "twitter": "@NoBroker",         "instagram": "@nobroker_india"},
    "lodha":           {"linkedin": "@Lodha-Group",       "twitter": "@LodhaGroup",       "instagram": "@lodhagroup"},
    "dlf":             {"linkedin": "@DLF",               "twitter": "@DLFLimited",       "instagram": "@dlfofficial"},
    "godrej properties": {"linkedin": "@Godrej-Properties", "twitter": "@GodrejProp",   "instagram": "@godrejproperties"},
    # Banks & fintech
    "hdfc":            {"linkedin": "@HDFC-Bank",             "twitter": "@HDFC_Bank",        "instagram": "@hdfcbank"},
    "hdfc bank":       {"linkedin": "@HDFC-Bank",             "twitter": "@HDFC_Bank",        "instagram": "@hdfcbank"},
    "sbi":             {"linkedin": "@State-Bank-of-India",   "twitter": "@TheOfficialSBI",   "instagram": "@sbi_india"},
    "state bank":      {"linkedin": "@State-Bank-of-India",   "twitter": "@TheOfficialSBI",   "instagram": "@sbi_india"},
    "icici":           {"linkedin": "@ICICI-Bank",            "twitter": "@ICICIBank",        "instagram": "@icicibankofficial"},
    "icici bank":      {"linkedin": "@ICICI-Bank",            "twitter": "@ICICIBank",        "instagram": "@icicibankofficial"},
    "axis bank":       {"linkedin": "@Axis-Bank",             "twitter": "@AxisBank",         "instagram": "@axisbank"},
    "kotak":           {"linkedin": "@Kotak-Mahindra-Bank",   "twitter": "@KotakBankLtd",     "instagram": "@kotakmahindrabank"},
    "bajaj finance":   {"linkedin": "@Bajaj-Finance",         "twitter": "@BajajFinance",     "instagram": "@bajajfinance"},
    # Telecom
    "jio":             {"linkedin": "@Reliance-Jio",          "twitter": "@reliancejio",      "instagram": "@reliancejio"},
    "airtel":          {"linkedin": "@Bharti-Airtel",         "twitter": "@airtelindia",      "instagram": "@airtelindia"},
    "bsnl":            {"linkedin": "@BSNL",                  "twitter": "@BSNLCorporate",    "instagram": "@bsnl_official"},
    # Gig / delivery platforms
    "dunzo":           {"linkedin": "@Dunzo",                 "twitter": "@dunzo_daily",      "instagram": "@dunzo_daily"},
    "blinkit":         {"linkedin": "@Blinkit",               "twitter": "@letsblinkit",      "instagram": "@blinkit"},
    "zepto":           {"linkedin": "@Zepto",                 "twitter": "@ZeptoNow",         "instagram": "@zepto"},
    "rapido":          {"linkedin": "@Rapido-Bike-Taxi",      "twitter": "@rapidobiketaxi",   "instagram": "@rapidobiketaxi"},
    "porter":          {"linkedin": "@Porter",                "twitter": "@porter_india",     "instagram": "@porter_india"},
    # Jobs / recruitment
    "naukri":          {"linkedin": "@Naukri.com",            "twitter": "@NaukriHQ",         "instagram": "@naukri"},
    "indeed":          {"linkedin": "@Indeed",                "twitter": "@Indeed",           "instagram": "@indeed"},
    "instahyre":       {"linkedin": "@InstaHyre",             "twitter": "@InstaHyre",        "instagram": "@instahyre"},
    # Auto
    "maruti":          {"linkedin": "@Maruti-Suzuki-India",   "twitter": "@Maruti_Corp",      "instagram": "@marutisuzukiindia"},
    "hyundai":         {"linkedin": "@Hyundai-India",         "twitter": "@HyundaiIndia",     "instagram": "@hyundaiindia"},
    "tata motors":     {"linkedin": "@Tata-Motors",           "twitter": "@TataMotors",       "instagram": "@tatamotors"},
    # Govt / Regulatory
    "rbi":             {"linkedin": "@Reserve-Bank-of-India", "twitter": "@RBI",          "instagram": "@rbi_india"},
    "sebi":            {"linkedin": "@SEBI",              "twitter": "@SEBI_India",       "instagram": "@sebi_india"},
    "nse":             {"linkedin": "@NSE-India",         "twitter": "@NSEIndia",         "instagram": "@nseindia"},
    "bse":             {"linkedin": "@BSE-India",         "twitter": "@BSEIndia",         "instagram": "@bseindia"},
    "noida authority": {"linkedin": "@NOIDA-Authority",   "twitter": "@NoidaAuthority",   "instagram": "@noidaauthority"},
    "mcd":             {"linkedin": "@MCD-Delhi",         "twitter": "@MCD_Delhi",        "instagram": "@mcd_delhi"},
    "ndmc":            {"linkedin": "@NDMC",              "twitter": "@NDMC_Delhi",       "instagram": "@ndmc_delhi"},
    "bmrcl":           {"linkedin": "@BMRCL",             "twitter": "@OfficialBMRCL",    "instagram": "@bmrcl_official"},
    # Sports
    "bcci":            {"linkedin": "@BCCI",              "twitter": "@BCCI",             "instagram": "@bcci"},
    "ipl":             {"linkedin": "@Indian-Premier-League", "twitter": "@IPL",          "instagram": "@ipl"},
    "rcb":             {"linkedin": "@Royal-Challengers-Bangalore", "twitter": "@RCBTweets", "instagram": "@royalchallengersbangalore"},
    "csk":             {"linkedin": "@Chennai-Super-Kings", "twitter": "@ChennaiIPL",     "instagram": "@chennaiipl"},
    "mi":              {"linkedin": "@Mumbai-Indians",    "twitter": "@MumbaiIndians",    "instagram": "@mumbaiindians"},
    "kkr":             {"linkedin": "@Kolkata-Knight-Riders", "twitter": "@KKRiders",     "instagram": "@kkriders"},
    # Celebrities (Twitter/Instagram primarily; LinkedIn rarely applicable)
    "virat kohli":     {"twitter": "@imVkohli",          "instagram": "@virat.kohli"},
    "rohit sharma":    {"twitter": "@ImRo45",            "instagram": "@rohitsharma45"},
    "ms dhoni":        {"twitter": "@msdhoni",           "instagram": "@mahi7781"},
    "srk":             {"twitter": "@iamsrk",            "instagram": "@iamsrk"},
    "shah rukh khan":  {"twitter": "@iamsrk",            "instagram": "@iamsrk"},
    "deepika padukone": {"twitter": "@deepikapadukone",  "instagram": "@deepikapadukone"},
    "ranveer singh":   {"twitter": "@RanveerOfficial",   "instagram": "@ranveersingh"},
    "alia bhatt":      {"twitter": "@aliaa08",           "instagram": "@aliaabhatt"},
    "akshay kumar":    {"twitter": "@akshaykumar",       "instagram": "@akshaykumar"},
    "katrina kaif":    {"twitter": "@KatrinaKaif",       "instagram": "@katrinakaif"},
    "priyanka chopra": {"twitter": "@priyankachopra",    "instagram": "@priyankachopra"},
    # Industry bodies / media
    "ibef":            {"linkedin": "@IBEF",             "twitter": "@india_brand",      "instagram": "@ibef_india"},
    "kpmg":            {"linkedin": "@KPMG India",       "twitter": "@KPMG_India",       "instagram": "@kpmg_in"},
    "knight frank":    {"linkedin": "@KnightFrankIndia", "twitter": "@KFIndia",          "instagram": "@knightfrankindia"},
    "jll":             {"linkedin": "@JLLIndia",         "twitter": "@JLL_India",        "instagram": "@jll_india"},
    "credai":          {"linkedin": "@CREDAI",           "twitter": "@CREDAI_",          "instagram": "@credai_official"},
    "nasscom":         {"linkedin": "@NASSCOM",          "twitter": "@nasscom",          "instagram": "@nasscom_official"},
    "ficci":           {"linkedin": "@FICCI-India",      "twitter": "@ficci_india",      "instagram": "@ficci_india"},
    "cii":             {"linkedin": "@CII-India",        "twitter": "@CII_India",        "instagram": "@cii_india"},
}

# Regex to find [LOOKUP: EntityName] placeholders in LLM output
_LOOKUP_RE = re.compile(r"\[LOOKUP:\s*([^\]]+)\]", re.IGNORECASE)


@lru_cache(maxsize=256)
def resolve_handle(entity: str, platform: str = "linkedin") -> Optional[str]:
    """
    Return the @handle for `entity` on `platform` ("linkedin"|"twitter"|"instagram").
    Returns None if the handle cannot be determined.

    Resolution order: _KNOWN exact → _KNOWN partial → web-search fallback.
    Results are cached for the process lifetime.
    """
    key = entity.strip().lower()

    # 1. Exact match
    if key in _KNOWN:
        return _KNOWN[key].get(platform)

    # 2. Partial key match — "Microsoft Corporation" → "microsoft"
    for known_key, handles in _KNOWN.items():
        if known_key in key or (len(key) > 3 and key in known_key):
            handle = handles.get(platform)
            if handle:
                logger.debug("Handle resolver: partial match '%s' → '%s' → %s", entity, known_key, handle)
                return handle

    # 3. Web-search fallback
    return _search_handle(entity, platform)


def _search_handle(entity: str, platform: str) -> Optional[str]:
    """Web-search for the entity's official profile URL and extract the handle slug."""
    try:
        from tools.web_search import web_search

        if platform == "linkedin":
            query = f'site:linkedin.com/company "{entity}" official page'
            pattern = re.compile(r"linkedin\.com/company/([a-zA-Z0-9_-]+)", re.IGNORECASE)
            skip = {"company", "in", "pub", "search", "feed", "jobs", "posts"}
        elif platform == "twitter":
            query = f'"{entity}" official twitter OR X account handle'
            pattern = re.compile(r"(?:twitter|x)\.com/([a-zA-Z0-9_]+)", re.IGNORECASE)
            skip = {"i", "home", "search", "explore", "notifications", "intent"}
        else:  # instagram
            query = f'"{entity}" official instagram account'
            pattern = re.compile(r"instagram\.com/([a-zA-Z0-9_.]+)", re.IGNORECASE)
            skip = {"p", "reel", "stories", "explore", "tv"}

        results = web_search(query, max_results=3)
        for r in results:
            text = r.get("url", "") + " " + r.get("content", "")
            for m in pattern.finditer(text):
                slug = m.group(1)
                if slug.lower() in skip:
                    continue
                handle = f"@{slug}"
                logger.info("Handle resolver: web search '%s' on %s → %s", entity, platform, handle)
                # Cache the result for future calls without going through lru_cache machinery
                _KNOWN[entity.strip().lower()] = {
                    **_KNOWN.get(entity.strip().lower(), {}),
                    platform: handle,
                }
                return handle

    except Exception as exc:
        logger.debug("Handle resolver: web search failed for '%s': %s", entity, exc)

    logger.debug("Handle resolver: no handle found for '%s' on %s", entity, platform)
    return None


def inject_known_mentions(
    content: str, platform: str, max_new: int = 3
) -> tuple[str, list[str]]:
    """
    Proactively scan content for known company/brand names and replace the first
    occurrence of each with the platform @handle inline.

    This catches cases where the LLM mentioned a brand without tagging it (i.e.,
    did not emit a [LOOKUP:] placeholder). Caps at max_new new @mentions per post.

    Blocked by design: politicians, bureaucrats, judiciary, big individual billionaires
    are NOT in _KNOWN, so they will never be injected.

    Returns: (updated_content, list_of_injected_handles)
    """
    # Handles already present in the content
    already: set[str] = {m.lower() for m in re.findall(r"@(\w+)", content)}
    injected: list[str] = []

    # Longest names first so "tech mahindra" matches before "mahindra"
    sorted_keys = sorted(_KNOWN.keys(), key=len, reverse=True)

    for key in sorted_keys:
        if len(injected) >= max_new:
            break
        if len(key) < 3:
            continue

        handles = _KNOWN[key]
        handle = handles.get(platform)
        if not handle:
            continue

        handle_slug = handle.lstrip("@").lower()
        if handle_slug in already:
            continue  # already @mentioned

        pattern = r"\b" + re.escape(key) + r"\b"
        new_content, n = re.subn(
            pattern,
            handle,
            content,
            count=1,
            flags=re.IGNORECASE,
        )
        if n:
            content = new_content
            already.add(handle_slug)
            injected.append(handle)
            logger.info("Mention injector: '%s' → %s on %s", key, handle, platform)

    return content, injected


def resolve_handles_in_text(text: str, platform: str = "linkedin") -> tuple[str, list[str]]:
    """
    Replace all [LOOKUP: EntityName] placeholders in `text` with resolved @handles.

    Returns:
        (resolved_text, list_of_resolved_handles)

    If a handle cannot be resolved, the placeholder is replaced with the plain
    entity name (no @) so the post still reads naturally.
    """
    resolved: list[str] = []

    def _replace(m: re.Match) -> str:
        entity = m.group(1).strip()
        handle = resolve_handle(entity, platform)
        if handle:
            resolved.append(handle)
            return handle
        logger.debug("Handle resolver: unresolved '%s', using plain name", entity)
        return entity

    return _LOOKUP_RE.sub(_replace, text), resolved
