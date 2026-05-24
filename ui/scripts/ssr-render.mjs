/**
 * ssr-render.mjs — inject server-rendered body HTML into pre-rendered SSG pages.
 *
 * Run order inside `build:ssg`:
 *   1. node scripts/generate-assets.mjs   — OG images
 *   2. vite build                          — client bundle → dist/
 *   3. vite build --ssr …                  — server bundle → dist-ssr/
 *   4. node scripts/prerender.mjs          — SEO <head> injection per route
 *   5. node scripts/ssr-render.mjs  ← this — body HTML injection per route
 *
 * For each public route this script:
 *   - calls render(path) from the SSR bundle
 *   - reads dist/{route}/index.html  (already written by prerender.mjs)
 *   - replaces  <div id="root"></div>
 *       with    <div id="root">{appHtml}</div>
 *   - writes the patched file back
 *
 * Dashboard and other protected routes are intentionally excluded —
 * they fall back to the SPA shell and hydrate from scratch client-side.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root    = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const ssrBundle = resolve(root, 'dist-ssr', 'entry-server.js')

if (!existsSync(ssrBundle)) {
  console.error('❌  SSR bundle not found:', ssrBundle)
  console.error('    Make sure `vite build --ssr src/entry-server.tsx --outDir dist-ssr` ran first.')
  process.exit(1)
}

const { render } = await import(ssrBundle)

// Ordered list matches the routes registered in entry-server.tsx / App.tsx
const PUBLIC_ROUTES = [
  { path: '/',        file: 'index.html' },
  { path: '/pricing', file: 'pricing/index.html' },
  { path: '/demo',    file: 'demo/index.html' },
  { path: '/login',   file: 'login/index.html' },
  { path: '/invest',  file: 'invest/index.html' },
  // Auth-gated at server level (FastAPI 302s unauthenticated requests),
  // so the pre-rendered HTML is only ever delivered to logged-in users.
  { path: '/pitch',   file: 'pitch/index.html' },
]

const ROOT_PLACEHOLDER = '<div id="root"></div>'

let count = 0

for (const { path, file } of PUBLIC_ROUTES) {
  const htmlPath = resolve(distDir, file)

  if (!existsSync(htmlPath)) {
    console.warn(`⚠   Skipping ${path} — ${file} not found (prerender.mjs must run first)`)
    continue
  }

  const { appHtml } = render(path)

  let html = readFileSync(htmlPath, 'utf-8')

  if (!html.includes(ROOT_PLACEHOLDER)) {
    console.warn(`⚠   Skipping ${path} — root div already has content or placeholder changed`)
    continue
  }

  html = html.replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`)
  writeFileSync(htmlPath, html)
  console.log(`✓   SSR body: ${path}`)
  count++
}

console.log(`\nSSR body injection complete — ${count} / ${PUBLIC_ROUTES.length} routes.`)
