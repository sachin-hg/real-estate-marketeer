/**
 * deploy-r2.mjs — push built static assets to Cloudflare R2 (S3-compatible)
 *
 * What gets uploaded:
 *   dist/assets/*.{js,css,js.br,js.gz,css.br,css.gz}  → r2://ui/assets/
 *   dist/*.{html,xml,json,txt,png,webp}               → r2://ui/
 *   public/*.{svg,png,webp,ico}                        → r2://ui/
 *
 * Content-hashed files (index-AbCd.js) get:  Cache-Control: public, max-age=31536000, immutable
 * HTML/JSON/XML/txt get:                       Cache-Control: no-cache
 *
 * Required env vars (from .env or CI secrets):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *
 * Usage:
 *   node scripts/deploy-r2.mjs
 *   (called by `npm run deploy:r2` after build:ssg)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────────────
const ACCOUNT_ID   = process.env.R2_ACCOUNT_ID
const ACCESS_KEY   = process.env.R2_ACCESS_KEY_ID
const SECRET_KEY   = process.env.R2_SECRET_ACCESS_KEY
const BUCKET       = process.env.R2_BUCKET       || 'housing-marketeer'
const PUBLIC_URL   = (process.env.R2_PUBLIC_URL  || '').replace(/\/$/, '')
const CDN_PREFIX   = 'ui'  // all files uploaded under this prefix in the bucket

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error('❌  Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
})

// ── Content type map ──────────────────────────────────────────────────────────
const MIME = {
  '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.html': 'text/html; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.br': null, '.gz': null,  // pre-compressed — content type set by base file
}

function mimeFor(file) {
  const ext = extname(file)
  if (ext === '.br' || ext === '.gz') {
    // e.g. "index-AbCd.js.br" → mime from ".js"
    const base = extname(file.replace(/\.(br|gz)$/, ''))
    return MIME[base] || 'application/octet-stream'
  }
  return MIME[ext] || 'application/octet-stream'
}

function cacheControl(file) {
  const stem = basename(file).replace(/\.(br|gz)$/, '')
  const ext  = extname(stem)
  const name = stem.replace(ext, '')
  // JS/CSS/fonts: immutable when content-hashed (suffix: -[hash6+])
  const isHashedAsset = ['.js', '.css', '.woff2', '.woff', '.ttf'].includes(ext) && /-[a-zA-Z0-9_]{6,}$/.test(name)
  // Images/SVG: immutable only when content-hashed (suffix: .[hash8] before extension)
  const isHashedImg   = ['.png', '.webp', '.svg', '.ico'].includes(ext) && /\.[0-9a-f]{8}$/.test(name)
  if (isHashedAsset || isHashedImg) return 'public, max-age=31536000, immutable'
  return 'no-cache'
}

function encodingFor(file) {
  if (file.endsWith('.br')) return 'br'
  if (file.endsWith('.gz')) return 'gzip'
  return undefined
}

// ── File collection ───────────────────────────────────────────────────────────
function collectFiles(dir, prefix = '') {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name)
    const key  = prefix ? `${prefix}/${name}` : name
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, key))
    } else {
      results.push({ localPath: full, key })
    }
  }
  return results
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function upload({ localPath, key, r2Key }) {
  const body    = readFileSync(localPath)
  const ct      = mimeFor(key)
  const cc      = cacheControl(key)
  const enc     = encodingFor(key)
  const headers = { 'Cache-Control': cc }
  if (enc) headers['Content-Encoding'] = enc

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: body,
    ContentType: ct,
    Metadata: headers,
    CacheControl: cc,
    ...(enc ? { ContentEncoding: enc } : {}),
  }))
  process.stdout.write(`  ✓ ${r2Key}\n`)
}

// ── Rewrite HTML asset URLs to CDN ───────────────────────────────────────────
// Optionally: patch index.html files to point assets at CDN URL.
// This is a build-time optimisation — only runs when PUBLIC_URL is set.
function patchHtml(htmlPath) {
  if (!PUBLIC_URL) return
  let html = readFileSync(htmlPath, 'utf-8')
  // Replace /assets/ references with CDN URL
  const patched = html.replace(/"\/(assets\/[^"]+)"/g, `"${PUBLIC_URL}/${CDN_PREFIX}/$1"`)
  if (patched !== html) {
    writeFileSync(htmlPath, patched)
    console.log(`  ✓ patched ${htmlPath} → CDN URLs`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const distDir   = resolve(root, 'dist')
  const publicDir = resolve(root, 'public')

  console.log(`\n🚀  Deploying to R2 bucket: ${BUCKET}/${CDN_PREFIX}/`)
  if (PUBLIC_URL) console.log(`    CDN: ${PUBLIC_URL}`)

  const tasks = []

  // dist/assets/* — JS, CSS, pre-compressed variants
  for (const f of collectFiles(resolve(distDir, 'assets'), 'assets')) {
    tasks.push({ localPath: f.localPath, key: f.key, r2Key: `${CDN_PREFIX}/${f.key}` })
  }

  // dist root files — og.png, og.webp, apple-touch-icon.png, manifest.json, robots.txt, index.html
  const distRootExts = new Set(['.png', '.webp', '.json', '.txt', '.xml', '.ico', '.svg', '.html'])
  for (const name of readdirSync(distDir)) {
    const full = resolve(distDir, name)
    if (statSync(full).isDirectory()) {
      // Upload SSG route subdirectories (pricing/index.html, demo/index.html, etc.)
      for (const child of readdirSync(full)) {
        if (extname(child) === '.html') {
          const childPath = resolve(full, child)
          const key = `${name}/${child}`
          tasks.push({ localPath: childPath, key, r2Key: `${CDN_PREFIX}/${key}` })
        }
      }
      continue
    }
    if (distRootExts.has(extname(name))) {
      tasks.push({ localPath: full, key: name, r2Key: `${CDN_PREFIX}/${name}` })
    }
  }

  // Upload in parallel batches of 10
  const BATCH = 10
  for (let i = 0; i < tasks.length; i += BATCH) {
    await Promise.all(tasks.slice(i, i + BATCH).map(t => upload(t)))
  }

  console.log(`\n✅  ${tasks.length} files uploaded to R2.`)
  if (PUBLIC_URL) {
    console.log(`\nCDN public URL: ${PUBLIC_URL}`)
    console.log('Update VITE_BASE_URL + asset references to point at CDN for zero-origin-load.')
  }
}

main().catch(e => { console.error('R2 deploy failed:', e.message); process.exit(1) })
