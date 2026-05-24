import { } from 'react'
import { Link } from 'react-router-dom'
import { useBrandName } from '../lib/useBrandName'
import { SEO } from '../components/SEO'

// ─── styles ───────────────────────────────────────────────────────────────────

const CSS = `
.invest-root {
  --bg: #07071a;
  --surf: rgba(255,255,255,0.04);
  --bord: rgba(255,255,255,0.09);
  --purple: #8B5CF6;
  --indigo: #6366F1;
  --cyan: #06B6D4;
  --green: #10B981;
  --text: #f1f5f9;
  --muted: #64748b;
  --dim: #334155;
  --grad: linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%);
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.invest-root *, .invest-root *::before, .invest-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ── ambient blobs ── */
.invest-root .orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.invest-root .orb-a {
  width: 700px; height: 700px;
  top: -220px; left: -120px;
  background: radial-gradient(circle, rgba(139,92,246,.16) 0%, transparent 70%);
  animation: iv-float-a 22s ease-in-out infinite;
}
.invest-root .orb-b {
  width: 560px; height: 560px;
  top: 35%; right: -150px;
  background: radial-gradient(circle, rgba(6,182,212,.12) 0%, transparent 70%);
  animation: iv-float-b 26s ease-in-out infinite;
}
.invest-root .orb-c {
  width: 440px; height: 440px;
  bottom: 15%; left: 32%;
  background: radial-gradient(circle, rgba(99,102,241,.09) 0%, transparent 70%);
  animation: iv-float-c 20s ease-in-out infinite;
}

@keyframes iv-float-a {
  0%,100% { transform: translate(0,0); }
  33%     { transform: translate(44px,-56px); }
  66%     { transform: translate(-34px,34px); }
}
@keyframes iv-float-b {
  0%,100% { transform: translate(0,0); }
  40%     { transform: translate(-44px,38px); }
  70%     { transform: translate(28px,-38px); }
}
@keyframes iv-float-c {
  0%,100% { transform: translate(0,0); }
  50%     { transform: translate(24px,48px); }
}

/* ── dot grid ── */
.invest-root .dot-grid {
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  z-index: 0;
}

/* ── sticky nav ── */
.invest-root .nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 52px;
  background: rgba(7,7,26,0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.invest-root .nav-brand {
  font-weight: 900;
  font-size: 28px;
  letter-spacing: -0.03em;
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-decoration: none;
}

.invest-root .nav-login-btn {
  padding: 9px 22px;
  border-radius: 10px;
  border: 1px solid rgba(139,92,246,0.4);
  background: rgba(139,92,246,0.1);
  color: #c4b5fd;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
  display: inline-block;
}

.invest-root .nav-login-btn:hover {
  background: rgba(139,92,246,0.2);
  border-color: rgba(139,92,246,0.65);
  transform: translateY(-1px);
}

/* ── page wrapper ── */
.invest-root .page {
  position: relative;
  z-index: 1;
  padding-top: 80px;
}

/* ── grad text ── */
.invest-root .grad-text {
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─────────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────────── */

.invest-root .hero {
  min-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px 60px;
}

.invest-root .hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 16px 5px 10px;
  border-radius: 100px;
  background: rgba(139,92,246,0.14);
  border: 1px solid rgba(139,92,246,0.32);
  font-size: 12px;
  font-weight: 700;
  color: #c4b5fd;
  letter-spacing: 0.05em;
  margin-bottom: 32px;
  text-transform: uppercase;
}

.invest-root .live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #a78bfa;
  animation: iv-pulse-dot 2s ease-in-out infinite;
}

@keyframes iv-pulse-dot {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.5; transform: scale(1.5); }
}

.invest-root .hero-title {
  font-size: clamp(38px,5.8vw,76px);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.06;
  max-width: 860px;
  margin-bottom: 22px;
  color: #fff;
}

.invest-root .hero-sub {
  font-size: clamp(16px,2vw,20px);
  color: var(--muted);
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 52px;
}

.invest-root .hero-ctas {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
}

.invest-root .btn-primary {
  padding: 16px 40px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8B5CF6, #6366F1);
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 6px 32px rgba(139,92,246,0.4);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.invest-root .btn-primary:hover {
  opacity: 0.92;
  transform: translateY(-2px);
  box-shadow: 0 10px 42px rgba(139,92,246,0.55);
}

.invest-root .btn-secondary {
  padding: 16px 32px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.16);
  background: transparent;
  color: #e2e8f0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.invest-root .btn-secondary:hover {
  border-color: rgba(255,255,255,0.42);
  background: rgba(255,255,255,0.05);
  transform: translateY(-2px);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION COMMONS
───────────────────────────────────────────────────────────────────────────── */

.invest-root .section {
  padding: 100px 24px;
  max-width: 1120px;
  margin: 0 auto;
}

.invest-root .section-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a78bfa;
  background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.28);
  padding: 4px 12px;
  border-radius: 100px;
  margin-bottom: 16px;
}

.invest-root .section-title {
  font-size: clamp(28px,4vw,46px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 14px;
  color: #fff;
}

.invest-root .section-sub {
  font-size: 17px;
  color: var(--muted);
  line-height: 1.7;
  max-width: 560px;
  margin-bottom: 56px;
}

/* ─────────────────────────────────────────────────────────────────────────────
   WHY SECTION — 3 cards
───────────────────────────────────────────────────────────────────────────── */

.invest-root .why-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 20px;
}

.invest-root .why-card {
  border-radius: 20px;
  padding: 32px 28px;
  background: var(--surf);
  border: 1px solid var(--bord);
  backdrop-filter: blur(16px);
  transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
}

.invest-root .why-card:hover {
  border-color: rgba(139,92,246,0.38);
  transform: translateY(-5px);
  box-shadow: 0 16px 56px rgba(139,92,246,0.15);
}

.invest-root .why-icon {
  width: 52px; height: 52px;
  border-radius: 14px;
  background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: #a78bfa;
}

.invest-root .why-title {
  font-size: 18px;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 10px;
  letter-spacing: -0.02em;
}

.invest-root .why-body {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.75;
}

.invest-root .why-stat {
  display: inline-block;
  margin-top: 16px;
  font-size: 13px;
  font-weight: 700;
  color: #c4b5fd;
  background: rgba(139,92,246,0.1);
  border: 1px solid rgba(139,92,246,0.22);
  padding: 4px 12px;
  border-radius: 6px;
}

/* ─────────────────────────────────────────────────────────────────────────────
   TRACTION — stat row
───────────────────────────────────────────────────────────────────────────── */

.invest-root .traction-wrap {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 24px;
  padding: 60px 48px;
}

.invest-root .traction-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 0;
}

.invest-root .traction-item {
  text-align: center;
  padding: 0 24px;
}

.invest-root .traction-item + .traction-item {
  border-left: 1px solid rgba(255,255,255,0.07);
}

.invest-root .traction-value {
  font-size: clamp(42px,6vw,72px);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  margin-bottom: 8px;
}

.invest-root .traction-label {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
  line-height: 1.5;
}

.invest-root .traction-sub {
  font-size: 12px;
  color: var(--dim);
  margin-top: 4px;
  font-weight: 500;
}

/* ─────────────────────────────────────────────────────────────────────────────
   OPPORTUNITY
───────────────────────────────────────────────────────────────────────────── */

.invest-root .opp-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}

.invest-root .opp-body {
  font-size: 16px;
  color: var(--muted);
  line-height: 1.8;
}

.invest-root .opp-body strong {
  color: #e2e8f0;
  font-weight: 700;
}

.invest-root .opp-callout {
  border-radius: 20px;
  padding: 36px 32px;
  background: linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.07) 100%);
  border: 1px solid rgba(139,92,246,0.25);
}

.invest-root .opp-callout-value {
  font-size: clamp(36px,5vw,56px);
  font-weight: 900;
  letter-spacing: -0.04em;
  margin-bottom: 8px;
}

.invest-root .opp-callout-label {
  font-size: 15px;
  color: #a78bfa;
  font-weight: 600;
  margin-bottom: 16px;
}

.invest-root .opp-callout-body {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.7;
}

/* ─────────────────────────────────────────────────────────────────────────────
   INTEREST FORM
───────────────────────────────────────────────────────────────────────────── */

.invest-root .form-section {
  max-width: 600px;
  margin: 0 auto;
  padding: 100px 24px;
}

.invest-root .form-card {
  border-radius: 24px;
  padding: 48px 44px;
  background: var(--surf);
  border: 1px solid rgba(139,92,246,0.3);
  box-shadow: 0 0 80px rgba(139,92,246,0.1);
  backdrop-filter: blur(20px);
}

.invest-root .form-title {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
  color: #fff;
}

.invest-root .form-sub {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 36px;
  line-height: 1.6;
}

.invest-root .form-field {
  margin-bottom: 16px;
}

.invest-root .form-field label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
}

.invest-root .form-field input,
.invest-root .form-field textarea {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--bord);
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  resize: none;
}

.invest-root .form-field input::placeholder,
.invest-root .form-field textarea::placeholder {
  color: var(--dim);
}

.invest-root .form-field input:focus,
.invest-root .form-field textarea:focus {
  border-color: rgba(139,92,246,0.55);
  background: rgba(139,92,246,0.06);
  box-shadow: 0 0 0 3px rgba(139,92,246,0.12);
}

.invest-root .form-submit {
  width: 100%;
  padding: 15px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8B5CF6, #6366F1);
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 6px 28px rgba(139,92,246,0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  letter-spacing: 0.01em;
}

.invest-root .form-submit:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(139,92,246,0.5);
}

.invest-root .form-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.invest-root .form-spinner {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: iv-spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes iv-spin { to { transform: rotate(360deg); } }

.invest-root .form-success {
  text-align: center;
  padding: 40px 0 10px;
}

.invest-root .form-success .check-circle {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: rgba(16,185,129,0.14);
  border: 1.5px solid rgba(16,185,129,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
}

.invest-root .form-success h3 {
  font-size: 20px;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 8px;
}

.invest-root .form-success p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
}

.invest-root .form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-radius: 10px;
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.28);
  font-size: 13px;
  color: #f87171;
  font-weight: 500;
  margin-bottom: 16px;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────────────────────── */

.invest-root .footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 28px 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.invest-root .footer-brand {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: 0.01em;
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.invest-root .footer-note {
  font-size: 12px;
  color: var(--dim);
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESPONSIVE
───────────────────────────────────────────────────────────────────────────── */

@media (max-width: 900px) {
  .invest-root .why-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .invest-root .traction-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .invest-root .traction-item + .traction-item {
    border-left: none;
    border-top: 1px solid rgba(255,255,255,0.07);
    padding-top: 32px;
  }
  .invest-root .opp-wrap {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .invest-root .nav {
    padding: 14px 20px;
  }
  .invest-root .nav-brand {
    font-size: 22px;
  }
  .invest-root .section {
    padding: 72px 20px;
  }
  .invest-root .traction-wrap {
    padding: 40px 24px;
  }
  .invest-root .form-card {
    padding: 36px 26px;
  }
  .invest-root .footer {
    padding: 24px 20px;
  }
}

/* pill sizing — desktop base, mobile override */
.invest-root .hero-pills {
  gap: 10px;
}
.invest-root .hero-pill {
  font-size: 13px;
  padding: 8px 16px;
  gap: 7px;
}
.invest-root .hero-pill svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
@media (max-width: 767px) {
  .invest-root .hero-pills {
    gap: 8px;
  }
  .invest-root .hero-pill {
    font-size: 11px;
    padding: 5px 11px;
    gap: 5px;
  }
  .invest-root .hero-pill svg {
    width: 11px;
    height: 11px;
  }
}
`


// ─── main component ───────────────────────────────────────────────────────────

export default function InvestorLanding() {
  const brand = useBrandName()

  const whyCards = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      title: 'Speed',
      body: 'From a trending topic to a live, platform-ready post in 90 seconds. While competitors are still briefing their content team, you\'re already published.',
      stat: 'Trend → live in 90s',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
      ),
      title: 'Scale',
      body: 'Publish across five platforms simultaneously — each post crafted natively for its audience, tone, and format. One workflow, five channels, zero overhead.',
      stat: '5 platforms at once',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <rect x="9" y="9" width="6" height="6"/>
          <line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/>
          <line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/>
          <line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/>
          <line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/>
        </svg>
      ),
      title: 'Intelligence',
      body: 'Every published post feeds real engagement signals back into the system. The more it runs, the sharper its hooks, angles, and timing become.',
      stat: 'Learns from engagement',
    },
  ]

  return (
    <div className="invest-root">
      <SEO
        title={`Invest in ${brand} — AI #TrendJack Engine · Seed Round`}
        description={`${brand} is raising its seed round. The AI trend-jacking engine that turns viral moments into brand buzz in 90 seconds — 200+ posts generated, 3.8× engagement lift, 170× cheaper than agencies.`}
        canonical="/invest"
        keywords={`${brand} investment, AI trend jacking startup, seed funding, housing.com AI, content AI investment, social media AI`}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: brand,
          url: (import.meta.env.VITE_BASE_URL as string | undefined)?.replace(/\/$/, '') || undefined,
          description: `AI-powered trend-jacking engine that turns viral moments into brand buzz — built on Housing.com infrastructure`,
          foundingDate: '2026',
          parentOrganization: { '@type': 'Organization', name: 'Housing.com' },
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Ambient background */}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="dot-grid" />

      {/* Sticky nav */}
      <nav className="nav">
        <a href="/" className="nav-brand">{brand}</a>
        <Link to="/login" className="nav-login-btn">Login</Link>
      </nav>

      <main className="page">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-badge">
            <span className="live-dot" />
            Seed Stage · Scouting Early Believers
          </div>

          <h1 className="hero-title">
            The rocketship is{' '}
            <span className="grad-text">boarding.</span>
          </h1>

          <div className="hero-pills" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 52 }}>
            {([
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                ),
                text: 'Working product', color: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.35)', fg: '#c4b5fd',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                ),
                text: 'Pilot live at Housing.com', color: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.32)', fg: '#6ee7b7',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                ),
                text: '$15B problem', color: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.32)', fg: '#67e8f9',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                  </svg>
                ),
                text: 'Compounding moat', color: 'rgba(99,102,241,0.14)', border: 'rgba(99,102,241,0.32)', fg: '#a5b4fc',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                ),
                text: 'Tiny team, big mission', color: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', fg: '#fcd34d',
              },
            ] as { icon: React.ReactNode; text: string; color: string; border: string; fg: string }[]).map(({ icon, text, color, border, fg }) => (
              <span key={text} className="hero-pill" style={{
                display: 'inline-flex', alignItems: 'center', borderRadius: 100,
                background: color, border: `1px solid ${border}`,
                fontWeight: 700, color: fg,
              }}>
                {icon}{text}
              </span>
            ))}
          </div>

          <div className="hero-ctas">
            <a href="#interest" className="btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
              Get on the Rocketship
            </a>
            <Link to="/login" className="btn-secondary">
              Already have access? Login
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ── Why NAVA ─────────────────────────────────────────────────── */}
        <div className="section">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="section-tag">Why {brand}</span>
            <h2 className="section-title">
              The content stack that{' '}
              <span className="grad-text">never sleeps.</span>
            </h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>
              Three core advantages that separate automated publishing from
              truly intelligent content.
            </p>
          </div>

          <div className="why-grid">
            {whyCards.map(card => (
              <div key={card.title} className="why-card">
                <div className="why-icon">{card.icon}</div>
                <div className="why-title">{card.title}</div>
                <p className="why-body">{card.body}</p>
                <span className="why-stat">{card.stat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Traction ─────────────────────────────────────────────────── */}
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span className="section-tag">Traction</span>
            <h2 className="section-title">
              Numbers that{' '}
              <span className="grad-text">speak for themselves.</span>
            </h2>
          </div>

          <div className="traction-wrap">
            <div className="traction-grid">
              <div className="traction-item">
                <div className="traction-value grad-text">97s</div>
                <div className="traction-label">Average run time</div>
                <div className="traction-sub">Trend detection to live post</div>
              </div>
              <div className="traction-item">
                <div className="traction-value grad-text">8.9/10</div>
                <div className="traction-label">Average quality score</div>
                <div className="traction-sub">AI-graded across brand, accuracy, engagement</div>
              </div>
              <div className="traction-item">
                <div className="traction-value grad-text">321×</div>
                <div className="traction-label">Cheaper than agency</div>
                <div className="traction-sub">Same brief, same quality, fraction of the cost</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── The Opportunity ──────────────────────────────────────────── */}
        <div className="section" style={{ paddingTop: 0 }}>
          <div className="opp-wrap">
            <div>
              <span className="section-tag">The Opportunity</span>
              <h2 className="section-title">
                A $15B+ market still running{' '}
                <span className="grad-text">on manual.</span>
              </h2>
              <p className="opp-body">
                Content publishing is a <strong>$15B+ bottleneck</strong> that every business
                hits — real estate, retail, fintech, healthcare, media, and beyond.
                Briefing, writing, reviewing, scheduling, posting. Every day.
                Every platform. Every market.
                <br /><br />
                Most brands still rely on slow agency pipelines or
                over-stretched in-house teams that can't keep pace with
                real-time trends, breaking news, or viral cultural moments.
                <br /><br />
                <strong>{brand} automates the entire workflow.</strong> Intelligent agents
                monitor the web, draft platform-native content, run quality checks,
                and publish — all without a single human touchpoint.
              </p>
            </div>

            <div className="opp-callout">
              <div className="opp-callout-value grad-text">$15B+</div>
              <div className="opp-callout-label">Content publishing & marketing market</div>
              <p className="opp-callout-body">
                Every business chasing buzz, a viral moment, or a content breakthrough is still
                briefing agencies, waiting on writers, and missing the window.
                {brand} changes that — permanently.
              </p>
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Universal problem', 'Every business that publishes content needs this — not just real estate.'],
                  ['No incumbents', 'No dominant player owns automated, intelligent content publishing at scale.'],
                  ['Compounding moat', 'Engagement feedback makes the system more valuable over time.'],
                ].map(([label, desc]) => (
                  <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#a78bfa', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✦</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{label} — </span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Interest Form ─────────────────────────────────────────────── */}
        <div className="form-section" id="interest">
          <div className="form-card">
            <h2 className="form-title">Board early. It's closing.</h2>
            <p className="form-sub">
              We respond within 4 hours. Come with conviction — seats are selective.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
              <a
                href={`mailto:a.sachin533@gmail.com?subject=${encodeURIComponent('Investor Briefing Request — Early Access')}&body=${encodeURIComponent('Hi Sachin,\n\nI came across your platform and I\'m interested in learning more about the investment opportunity.\n\nName: \nCompany / Fund: \nStage: \n\n')}`}
                className="form-submit"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Email Us Directly
              </a>
              <a
                href="https://wa.me/919811785389?text=Hi%20Sachin%2C%20I%27d%20like%20to%20learn%20more%20about%20investing%20in%20your%20AI%20content%20platform."
                target="_blank"
                rel="noreferrer"
                className="form-submit"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 6px 28px rgba(37,211,102,0.3)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.025.506 3.93 1.395 5.6L0 24l6.545-1.367A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.523-5.197-1.432l-.371-.222-3.864.807.826-3.748-.243-.386A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                WhatsApp +91 98117 85389
              </a>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="footer">
          <span className="footer-brand">{brand}</span>
          <span className="footer-note">
            Private · Limited Early Access
          </span>
        </footer>

      </main>
    </div>
  )
}
