"""Quick smoke-test for URL generation — run with: python -m tools.test_housing_urls"""

from tools.housing_urls import (
    city_homepage_url, city_srp_url, builder_url, project_url,
    resolve_city, city_links, CITIES,
)

cases = [
    # (city_slug, expected_homepage, expected_srp)
    ("new-delhi",           "https://housing.com/in/buy/real-estate-new_delhi",           "https://housing.com/in/buy/new-delhi"),
    ("greater-noida",       "https://housing.com/in/buy/real-estate-greater_noida",       "https://housing.com/in/buy/greater-noida"),
    ("navi-mumbai",         "https://housing.com/in/buy/real-estate-navi_mumbai",         "https://housing.com/in/buy/navi-mumbai"),
    ("thiruvananthapuram",  "https://housing.com/in/buy/real-estate-thiruvananthapuram",  "https://housing.com/in/buy/thiruvananthapuram"),
    ("bengaluru",           "https://housing.com/in/buy/real-estate-bengaluru",           "https://housing.com/in/buy/bengaluru"),
    ("rae-bareli",          "https://housing.com/in/buy/real-estate-rae_bareli",          "https://housing.com/in/buy/rae-bareli"),
]

print("=== City URL patterns ===")
all_passed = True
for slug, exp_home, exp_srp in cases:
    home = city_homepage_url(slug)
    srp  = city_srp_url(slug)
    home_ok = home == exp_home
    srp_ok  = srp  == exp_srp
    status = "✓" if (home_ok and srp_ok) else "✗"
    if not (home_ok and srp_ok):
        all_passed = False
    print(f"  {status} {slug}")
    if not home_ok:
        print(f"      homepage: got  {home}")
        print(f"               want {exp_home}")
    if not srp_ok:
        print(f"      srp:      got  {srp}")
        print(f"               want {exp_srp}")

print()
print("=== Builder / project URL patterns ===")
print(f"  builder  DLF         → {builder_url('dlf')}")
print(f"  builder  Godrej Prop → {builder_url('godrej-properties')}")
print(f"  project  DLF Camell. → {project_url('dlf-camellias')}")
print(f"  project  Prestige    → {project_url('prestige-song-of-south')}")

print()
print("=== Alias resolution ===")
aliases = [("Gurugram", "gurgaon"), ("Bangalore", "bengaluru"),
           ("Delhi NCR", "new-delhi"), ("Bombay", "mumbai"),
           ("Trivandrum", "thiruvananthapuram")]
for alias, expected in aliases:
    resolved = resolve_city(alias)
    ok = "✓" if resolved == expected else "✗"
    print(f"  {ok} '{alias}' → {resolved}")

print()
print(f"=== Total cities in primary market: {len(CITIES)} ===")
print("All URL tests passed ✓" if all_passed else "⚠ Some URL tests failed")
