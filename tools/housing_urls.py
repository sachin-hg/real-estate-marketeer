"""
Housing.com URL generation utilities.

URL patterns:
  City homepage : housing.com/in/buy/real-estate-<city_underscored>
  City SRP      : housing.com/in/buy/<city-hyphenated>
  Builder page  : housing.com/in/buy/<builder-slug>-bid
  Project page  : housing.com/in/buy/<project-slug>-pid
"""

BASE = "https://housing.com/in/buy"

# Canonical city slugs (hyphenated, as used in SRP URLs).
# Order reflects rough traffic priority — used when picking cities to link.
CITIES: list[str] = [
    "new-delhi",
    "bengaluru",
    "gurgaon",
    "faridabad",
    "noida",
    "greater-noida",
    "mumbai",
    "thane",
    "navi-mumbai",
    "goa",
    "pune",
    "hyderabad",
    "chennai",
    "kolkata",
    "varanasi",
    "agra",
    "mathura",
    "vrindavan",
    "chandigarh",
    "mohali",
    "panchkula",
    "ahmedabad",
    "gandhinagar",
    "surat",
    "jaipur",
    "udaipur",
    "lucknow",
    "kanpur",
    "rae-bareli",
    "kochi",
    "aluva",
    "thiruvananthapuram",
    "warangal",
    "hooghly",
    "howrah",
    "patna",
    "ranchi",
    "vijayawada",
    "amravati",
    "bareilly",
    "indore",
    "bhopal",
    "nagpur",
    "coimbatore",
    "srinagar",
    "dehradun",
]

# Lookup set for fast membership checks
CITY_SET: set[str] = set(CITIES)

# Human-readable display names keyed by slug
CITY_DISPLAY: dict[str, str] = {
    "new-delhi": "New Delhi",
    "bengaluru": "Bengaluru",
    "gurgaon": "Gurgaon",
    "faridabad": "Faridabad",
    "noida": "Noida",
    "greater-noida": "Greater Noida",
    "mumbai": "Mumbai",
    "thane": "Thane",
    "navi-mumbai": "Navi Mumbai",
    "goa": "Goa",
    "pune": "Pune",
    "hyderabad": "Hyderabad",
    "chennai": "Chennai",
    "kolkata": "Kolkata",
    "varanasi": "Varanasi",
    "agra": "Agra",
    "mathura": "Mathura",
    "vrindavan": "Vrindavan",
    "chandigarh": "Chandigarh",
    "mohali": "Mohali",
    "panchkula": "Panchkula",
    "ahmedabad": "Ahmedabad",
    "gandhinagar": "Gandhinagar",
    "surat": "Surat",
    "jaipur": "Jaipur",
    "udaipur": "Udaipur",
    "lucknow": "Lucknow",
    "kanpur": "Kanpur",
    "rae-bareli": "Rae Bareli",
    "kochi": "Kochi",
    "aluva": "Aluva",
    "thiruvananthapuram": "Thiruvananthapuram",
    "warangal": "Warangal",
    "hooghly": "Hooghly",
    "howrah": "Howrah",
    "patna": "Patna",
    "ranchi": "Ranchi",
    "vijayawada": "Vijayawada",
    "amravati": "Amravati",
    "bareilly": "Bareilly",
    "indore": "Indore",
    "bhopal": "Bhopal",
    "nagpur": "Nagpur",
    "coimbatore": "Coimbatore",
    "srinagar": "Srinagar",
    "dehradun": "Dehradun",
}

# Aliases: alternate names / common misspellings → canonical slug
# Lets the LLM return "Gurugram", "Bangalore", etc. and still resolve correctly.
CITY_ALIASES: dict[str, str] = {
    "gurugram": "gurgaon",
    "bangalore": "bengaluru",
    "bombay": "mumbai",
    "calcutta": "kolkata",
    "madras": "chennai",
    "delhi": "new-delhi",
    "ncr": "new-delhi",
    "delhi ncr": "new-delhi",
    "navi mumbai": "navi-mumbai",
    "greater noida": "greater-noida",
    "rae bareli": "rae-bareli",
    "trivandrum": "thiruvananthapuram",
}


def resolve_city(name: str) -> str | None:
    """
    Resolve a free-text city name to its canonical hyphenated slug.
    Returns None if the city is not in Housing.com's primary markets.
    """
    normalised = name.strip().lower().replace("_", "-")
    if normalised in CITY_SET:
        return normalised
    return CITY_ALIASES.get(normalised)


def city_homepage_url(city_slug: str) -> str:
    """housing.com/in/buy/real-estate-<city_underscored>"""
    underscored = city_slug.replace("-", "_")
    return f"{BASE}/real-estate-{underscored}"


def city_srp_url(city_slug: str) -> str:
    """housing.com/in/buy/<city-hyphenated>"""
    return f"{BASE}/{city_slug}"


def builder_url(builder_name: str) -> str:
    """
    housing.com/in/buy/<builder-slug>-bid
    Caller is responsible for passing the correct slug;
    this just enforces the URL pattern.
    """
    slug = _to_slug(builder_name)
    return f"{BASE}/{slug}-bid"


def project_url(project_name: str) -> str:
    """
    housing.com/in/buy/<project-slug>-pid
    Caller is responsible for passing the correct slug.
    """
    slug = _to_slug(project_name)
    return f"{BASE}/{slug}-pid"


def _to_slug(text: str) -> str:
    """Lowercase, strip, replace spaces/underscores with hyphens."""
    return text.strip().lower().replace(" ", "-").replace("_", "-")


# ---------------------------------------------------------------------------
# Convenience: build a link dict in the shape the rest of the pipeline expects
# ---------------------------------------------------------------------------

def city_links(city_slug: str, anchor_override: str | None = None) -> list[dict]:
    """Return homepage + SRP link dicts for a city."""
    display = CITY_DISPLAY.get(city_slug, city_slug.replace("-", " ").title())
    return [
        {
            "url": city_homepage_url(city_slug),
            "anchor_text": anchor_override or f"Properties in {display}",
            "page_type": "city_homepage",
            "city": city_slug,
        },
        {
            "url": city_srp_url(city_slug),
            "anchor_text": f"Buy property in {display}",
            "page_type": "city_srp",
            "city": city_slug,
        },
    ]


def builder_link(builder_name: str, builder_slug: str) -> dict:
    return {
        "url": builder_url(builder_slug),
        "anchor_text": f"{builder_name} projects",
        "page_type": "builder",
        "builder": builder_slug,
    }


def project_link(project_name: str, project_slug: str, city_slug: str | None = None) -> dict:
    return {
        "url": project_url(project_slug),
        "anchor_text": project_name,
        "page_type": "project_microsite",
        "project": project_slug,
        "city": city_slug,
    }
