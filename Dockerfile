# ── Stage 1: Build React UI ───────────────────────────────────────────────────
FROM node:20-slim AS ui-builder
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci --silent
COPY ui/ ./
RUN npm run build

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# System deps (gcc for some Python packages, fonts for Pillow image generation)
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
