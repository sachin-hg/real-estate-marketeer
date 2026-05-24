Remind yourself of the NAVA product positioning:

NAVA is a **generic AI trend-jacking content engine** for any brand or industry — not a real-estate product. The current Railway deployment serves a real-estate client, but the codebase is fully client-agnostic and white-label ready.

Key rules for this project:
1. Never describe NAVA as a "real estate" tool in code, docs, or suggestions
2. Never hardcode the brand name — use `useBrandName()` (frontend) or `VITE_APP_NAME` env var
3. Content pipeline logic should remain domain-neutral; client-specific config lives in settings/env vars
