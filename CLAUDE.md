# Project Context

## What this app is

**NAVA** is a **generic AI trend-jacking content engine** for any brand or industry.

- It ingests trending topics (social, news, Google Trends, Reddit, etc.) and generates on-brand social content
- The brand, industry, and tone are fully configurable via environment variables and settings
- The current deployment (`nava.up.railway.app`) happens to serve a real-estate client, but the codebase is client-agnostic

## What this app is NOT

- It is **not** a real-estate product
- Do **not** describe it, name it, or position it as real-estate-specific in comments, documentation, or suggestions
- Do **not** assume real-estate domain logic when writing generic content pipeline code

## Brand name

- The app name is config-driven via `VITE_APP_NAME` (frontend) and equivalent backend settings
- Never hardcode `"NAVA"` or `"real estate"` in code — use the config/hook (`useBrandName()`) so any client can white-label it

## Stack

- Backend: FastAPI + LangGraph + Claude (Anthropic) + SQLite (Railway persistent volume)
- Frontend: React + Vite (pre-rendered SPA served by FastAPI)
- Deployment: Railway (Docker), `railway.toml` at project root
- Run locally: `python main.py run` (backend), `npm run dev` in `ui/` (frontend)
