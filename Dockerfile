# ── Stage 1: Build React UI ───────────────────────────────────────────────────
FROM node:20-slim AS ui-builder
WORKDIR /app/ui

# Build-time vars baked into the Vite bundle by SSG (set in Railway → Variables)
ARG VITE_APP_NAME=NAVA
ARG VITE_BASE_URL
ARG VITE_SITE_URL
ARG VITE_USE_CDN=false
ARG VITE_SOCIAL_TWITTER
ARG VITE_SOCIAL_INSTAGRAM
ARG VITE_SOCIAL_LINKEDIN
ARG VITE_CONTACT_EMAIL

ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_USE_CDN=$VITE_USE_CDN
ENV VITE_SOCIAL_TWITTER=$VITE_SOCIAL_TWITTER
ENV VITE_SOCIAL_INSTAGRAM=$VITE_SOCIAL_INSTAGRAM
ENV VITE_SOCIAL_LINKEDIN=$VITE_SOCIAL_LINKEDIN
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL

COPY ui/package*.json ./
RUN npm ci --silent
COPY ui/ ./
# Full SSR+SSG build:
#   generate-assets → tsc+vite build (client) → vite build --ssr (server bundle)
#   → prerender.mjs (SEO <head>) → ssr-render.mjs (full body injection) → dist/
RUN npm run build:ssg

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# System deps (gcc for some Python packages, fonts for image generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    libgl1 \
    fontconfig \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Built React SPA from stage 1
COPY --from=ui-builder /app/ui/dist /app/ui/dist

# Startup script
COPY start.sh ./
RUN chmod +x start.sh

# /data is the Railway persistent volume mount point
# housing_content.db + checkpoints.db + output/ all live there
RUN mkdir -p /data/output /app/output

EXPOSE 8000

CMD ["./start.sh"]
