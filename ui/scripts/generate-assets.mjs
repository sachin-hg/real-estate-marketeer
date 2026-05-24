/**
 * generate-assets.mjs — build-time static asset generator
 *
 * Produces (written to public/ only — Vite copies public/ → dist/ during build):
 *   public/og.png                1200×630  OpenGraph social card
 *   public/og.webp               1200×630  WebP variant
 *   public/apple-touch-icon.png  180×180   iOS home screen icon
 *
 * Content-hashing + dist/ versioning is handled by prerender.mjs (runs post-build).
 *
 * Run: node scripts/generate-assets.mjs
 * Called automatically by `npm run build:ssg`.
 */

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

const BRAND    = process.env.VITE_APP_NAME || 'NAVA'
const TAGLINE  = 'The AI #TrendJack Engine'
const STAT1    = '90s trend → post'
const STAT2    = '15+ signal sources'
const STAT3    = '5 platforms'

// ── SVG templates ─────────────────────────────────────────────────────────────

// og.png / og.webp — NAVA is the logo; N is its short form for icons, never both together
const ogSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#07071a"/>
      <stop offset="100%" stop-color="#0d0b2e"/>
    </linearGradient>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#C4B5FD"/>
      <stop offset="38%"  stop-color="#818CF8"/>
      <stop offset="72%"  stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#67E8F9"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="85%" cy="70%" r="45%">
      <stop offset="0%" stop-color="#06B6D4" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#06B6D4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Ambient glows -->
  <ellipse cx="240" cy="190" rx="420" ry="380" fill="url(#glow1)"/>
  <ellipse cx="1020" cy="440" rx="380" ry="320" fill="url(#glow2)"/>

  <!-- Dot grid -->
  <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.04)"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#dots)"/>

  <!-- Border -->
  <rect x="1" y="1" width="1198" height="628" rx="0" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>

  <!-- Brand name — centred vertically in left column -->
  <text x="88" y="240" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="112" fill="url(#grad)" letter-spacing="-4">${BRAND}</text>

  <!-- Tagline -->
  <text x="88" y="310" font-family="system-ui,-apple-system,sans-serif" font-weight="600" font-size="36" fill="rgba(148,163,184,1)" letter-spacing="-0.5">${TAGLINE}</text>

  <!-- Separator line -->
  <line x1="88" y1="355" x2="560" y2="355" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>

  <!-- Stats row -->
  <text x="88"  y="398" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="22" fill="#C4B5FD">${STAT1}</text>
  <text x="340" y="398" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="22" fill="#38BDF8">${STAT2}</text>
  <text x="600" y="398" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="22" fill="#10B981">${STAT3}</text>

  <!-- Abstract pipeline dots on right -->
  <circle cx="900" cy="220" r="48" fill="none" stroke="rgba(139,92,246,0.25)" stroke-width="1.5"/>
  <circle cx="900" cy="220" r="24" fill="rgba(139,92,246,0.12)"/>
  <circle cx="900" cy="220" r="8"  fill="#8B5CF6"/>
  <line x1="948" y1="220" x2="1020" y2="220" stroke="rgba(139,92,246,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <circle cx="1068" cy="220" r="32" fill="none" stroke="rgba(99,102,241,0.25)" stroke-width="1.5"/>
  <circle cx="1068" cy="220" r="16" fill="rgba(99,102,241,0.12)"/>
  <circle cx="1068" cy="220" r="6"  fill="#6366F1"/>
  <line x1="900" y1="268" x2="900" y2="340" stroke="rgba(56,189,248,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <circle cx="900" cy="388" r="40" fill="none" stroke="rgba(56,189,248,0.25)" stroke-width="1.5"/>
  <circle cx="900" cy="388" r="20" fill="rgba(56,189,248,0.1)"/>
  <circle cx="900" cy="388" r="7"  fill="#38BDF8"/>
  <line x1="940" y1="388" x2="1010" y2="388" stroke="rgba(6,182,212,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <circle cx="1058" cy="388" r="28" fill="none" stroke="rgba(6,182,212,0.25)" stroke-width="1.5"/>
  <circle cx="1058" cy="388" r="14" fill="rgba(6,182,212,0.1)"/>
  <circle cx="1058" cy="388" r="5"  fill="#06B6D4"/>
  <line x1="1058" y1="416" x2="1058" y2="476" stroke="rgba(16,185,129,0.3)" stroke-width="1.5" stroke-dasharray="6,4"/>
  <circle cx="1058" cy="508" r="32" fill="none" stroke="rgba(16,185,129,0.25)" stroke-width="1.5"/>
  <circle cx="1058" cy="508" r="16" fill="rgba(16,185,129,0.1)"/>
  <circle cx="1058" cy="508" r="6"  fill="#10B981"/>

  <!-- Label: 90s -->
  <rect x="826" y="134" width="80" height="28" rx="14" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.3)" stroke-width="1"/>
  <text x="866" y="152" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="13" fill="#C4B5FD" text-anchor="middle">90 sec</text>
</svg>`

// apple-touch-icon.png — N is the short form of NAVA, correct for icon-only contexts
const appleSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0d2a"/>
      <stop offset="100%" stop-color="#07071a"/>
    </linearGradient>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#C4B5FD"/>
      <stop offset="38%"  stop-color="#818CF8"/>
      <stop offset="72%"  stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#67E8F9"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="180" height="180" rx="40" fill="url(#bg)"/>
  <rect width="180" height="180" rx="40" fill="url(#glow)"/>
  <rect x="1" y="1" width="178" height="178" rx="39" fill="none" stroke="rgba(139,92,246,0.35)" stroke-width="2"/>
  <text x="90" y="128" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="110" fill="url(#grad)" text-anchor="middle" letter-spacing="-4">N</text>
</svg>`

// ── Helpers ────────────────────────────────────────────────────────────────────

async function svgToPng(svgBuffer, outputPath, width, height) {
  await sharp(Buffer.from(svgBuffer))
    .resize(width, height)
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(outputPath)
}

async function svgToWebP(svgBuffer, outputPath, width, height) {
  await sharp(Buffer.from(svgBuffer))
    .resize(width, height)
    .webp({ quality: 90, effort: 6 })
    .toFile(outputPath)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await svgToPng(ogSVG, resolve(publicDir, 'og.png'), 1200, 630)
  console.log('✓  public/og.png')

  await svgToWebP(ogSVG, resolve(publicDir, 'og.webp'), 1200, 630)
  console.log('✓  public/og.webp')

  await svgToPng(appleSVG, resolve(publicDir, 'apple-touch-icon.png'), 180, 180)
  console.log('✓  public/apple-touch-icon.png')

  console.log('\nAsset generation complete.')
}

main().catch(e => { console.error(e); process.exit(1) })
