import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBrandName } from '../lib/useBrandName'
import { CardMarqueeBg } from '../components/CardMarqueeBg'
import { SEO } from '../components/SEO'
import {
  Radio, Search, Layers, Sparkles, Send,
  Zap, Bot, Target, Clock, DollarSign,
  TrendingUp, Users, ArrowRight,
  Mail,
} from 'lucide-react'

const GRAD = 'linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%)'
const SECTION_COUNT = 9
const CAR_W = 420
const CAR_H = 440

const useAppName = useBrandName

function useMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const h = () => { clearTimeout(t); t = setTimeout(() => setMobile(window.innerWidth < 768), 150) }
    window.addEventListener('resize', h, { passive: true })
    return () => { window.removeEventListener('resize', h); clearTimeout(t) }
  }, [])
  return mobile
}

function GradText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
      {children}
    </span>
  )
}

function TwitterIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>
}
function InstagramIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
}
function LinkedInIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
}

// Pure CSS animation — no JS timer, no state, no re-render after mount.
// IntersectionObserver triggers the animation class when the bar enters the viewport.
function MetricBar({ label, value, max, color, suffix = '' }: {
  label: string; value: number; max: number; color: string; suffix?: string
}) {
  const pct = (value / max) * 100
  const id = `mb-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div style={{ marginBottom: 16 }}>
      <style>{`
        @keyframes ${id}-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .${id}-bar { transform-origin: left; transform: scaleX(0);
          animation: ${id}-fill 1.1s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}{suffix}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div className={`${id}-bar`} style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── carousel card — memoized so only the active card re-renders ──────────────
const CarouselCard = memo(function CarouselCard({ node, i, active, n, cardW, cardH }: {
  node: React.ReactNode; i: number; active: number; n: number; cardW: number; cardH: number
}) {
  const raw = ((i - active) % n + n) % n
  const d = raw > n / 2 ? raw - n : raw
  const isC = d === 0
  const isAdj = Math.abs(d) === 1
  const tx = d * cardW * 0.76
  const ty = isC ? -24 : 0
  const sc = isC ? 1 : 0.84
  const opacity = isC ? 1 : isAdj ? 0.55 : 0
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 24,
      marginLeft: -(cardW / 2), width: cardW, height: cardH,
      transform: `translateX(${tx}px) translateY(${ty}px) scale(${sc})`,
      transformOrigin: 'center top', opacity,
      zIndex: isC ? 3 : 1,
      background: isC ? '#08081e' : 'transparent',
      borderRadius: isC ? 24 : 0,
      overflow: isC ? 'hidden' : 'visible',
      pointerEvents: (isC || isAdj) ? 'auto' : 'none',
      transition: 'transform 0.6s cubic-bezier(.22,1,.36,1), opacity 0.5s ease',
      willChange: 'transform, opacity',
      contain: 'layout style',
    }}>
      {node}
    </div>
  )
})

// ─── carousel: centre card prominent, side cards peek from behind ─────────────
function NodeCarousel({ nodes, interval = 3600, cardW = CAR_W, cardH = CAR_H }: {
  nodes: React.ReactNode[]
  interval?: number
  cardW?: number
  cardH?: number
}) {
  const [active, setActive] = useState(0)
  const n = nodes.length

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % n), interval)
    return () => clearInterval(id)
  }, [n, interval])

  // Dot widths precomputed so the map below is allocation-free
  const dotStyles = useMemo(() => nodes.map((_, i) => ({
    width: i === active ? 28 : 8, height: 8, borderRadius: 4,
    border: 'none' as const, cursor: 'pointer' as const, padding: 0,
    background: i === active ? '#818CF8' : 'rgba(255,255,255,0.18)',
    transition: 'width 0.35s cubic-bezier(.22,1,.36,1), background 0.35s ease',
  })), [active, nodes.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ position: 'relative', height: cardH + 40, width: '100%' }}>
        {nodes.map((node, i) => (
          <CarouselCard key={i} node={node} i={i} active={active} n={n} cardW={cardW} cardH={cardH} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
        {nodes.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} style={dotStyles[i]} />
        ))}
      </div>
    </div>
  )
}

// ─── platform mockups ─────────────────────────────────────────────────────────
function TwitterMockup() {
  return (
    <div style={{ background: '#0f172a', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>P</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>PropMaxIndia</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1.01-2.52-1.27-3.91-.81-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81-1.01 1.01-1.27 2.52-.81 3.91C3.38 9.33 2.5 10.57 2.5 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91 1.01 1.01 2.52 1.27 3.91.81.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81 1.01-1.01 1.27-2.52.81-3.91 1.31-.67 2.19-1.91 2.19-3.34z" /><path fill="#fff" d="m10.78 15.58-2.99-3 1.06-1.06 1.93 1.93 4.43-4.43 1.06 1.06z" /></svg>
          </div>
          <span style={{ fontSize: 12, color: '#475569' }}>@PropMaxIndia · 2m</span>
        </div>
        <div style={{ marginLeft: 'auto', color: '#1d9bf0' }}><TwitterIcon size={18} /></div>
      </div>
      <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, marginBottom: 12 }}>
        Ee Sala Cup Namdu! 🏆<br />RCB ne 18 saal baad apna ghar jeeta.<br />
        <span style={{ color: '#94a3b8' }}>Tum apna ghar kab jeeto ge?</span><br />
        <span style={{ color: '#38bdf8' }}>propmax.in/buy/bengaluru</span>
      </p>
      <p style={{ fontSize: 12, color: '#38bdf8', marginBottom: 14 }}>#RCBvsCSK #EeSalaCupNamdu #PropMax</p>
      <div style={{ borderRadius: 10, background: 'linear-gradient(135deg,#4C1D95,#1E1B4B)', border: '1px solid rgba(139,92,246,0.3)', padding: '14px 16px' }}>
        <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>PROPMAX.IN</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>Ee Sala Cup Namdu!<br /><span style={{ color: '#c4b5fd' }}>Ghar bhi jeeto.</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, color: '#475569', fontSize: 12 }}>
        <span>💬 82</span><span style={{ color: '#10b981' }}>🔁 247</span><span style={{ color: '#f43f5e' }}>❤️ 1.2K</span><span>👁 48K</span>
      </div>
    </div>
  )
}

function InstagramMockup() {
  return (
    <div style={{ background: '#0f0f17', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0f0f17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#fff' }}>P</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>propmax.india</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Sponsored</div>
        </div>
        <InstagramIcon size={18} />
      </div>
      <div style={{ width: '100%', aspectRatio: '1.4', background: 'linear-gradient(135deg,#3B0764 0%,#1E1B4B 40%,#0C4A6E 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
        <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.15em', marginBottom: 12, textTransform: 'uppercase' }}>PropMax</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.25, marginBottom: 10 }}>Ee Sala Cup<br />Namdu!</div>
        <div style={{ fontSize: 12, color: '#c4b5fd', textAlign: 'center', lineHeight: 1.5 }}>RCB ne 18 saal baad<br />apna ghar jeeta.</div>
        <div style={{ marginTop: 16, padding: '7px 16px', borderRadius: 20, background: 'linear-gradient(135deg,#8B5CF6,#06B6D4)', fontSize: 11, fontWeight: 700, color: '#fff' }}>Tum kab jeeto ge? →</div>
        <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em' }}>propmax.in</div>
      </div>
      <div style={{ padding: '10px 16px 14px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, color: '#f1f5f9', fontSize: 20 }}><span>♡</span><span>💬</span><span>↗</span><span style={{ marginLeft: 'auto' }}>🔖</span></div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>3,842 likes</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}><span style={{ color: '#f1f5f9', fontWeight: 700 }}>propmax.india </span>Ee Sala Cup Namdu! 🏠 Apna ghar bhi jeeto…</div>
      </div>
    </div>
  )
}

function LinkedInMockup() {
  return (
    <div style={{ background: '#1b1f23', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>P</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>PropMax India</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Real Estate Platform · 2.3M followers</div>
          <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'inline-block', marginTop: 3 }}>PROMOTED</div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#0077b5' }}><LinkedInIcon size={20} /></div>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
          AI layoffs se bohot uncertainty hai. Jobs aa aur jaa rahi hain.<br /><br />
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>Jo stable rehta hai? Apna ghar.</span><br /><br />
          Ek real asset, ek real address. RERA-verified listings, easy EMI calculator, zero-brokerage.
        </p>
      </div>
      <div style={{ margin: '0 16px 14px', borderRadius: 8, background: 'linear-gradient(90deg,#312e81,#1e3a5f)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#a5b4fc', marginBottom: 4 }}>propmax.in</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Find your stable investment →</div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', gap: 20, fontSize: 12, color: '#475569' }}>
        <span>👍 2,441</span><span>💬 187</span><span>🔁 312</span>
      </div>
    </div>
  )
}

// ─── case study data ──────────────────────────────────────────────────────────
const CASE_CARDS = [
  { value: '200+',  label: 'Posts Generated',   detail: 'Across 4 platforms',         sub: 'Twitter, Instagram, LinkedIn, and real estate news — all autonomously published.', color: '#8B5CF6' },
  { value: '3.8×',  label: 'Engagement Lift',   detail: 'vs 0.9% industry avg',        sub: 'Trend-jacked content consistently outperforms static brand posts.', color: '#06b6d4' },
  { value: '170×',  label: 'Cheaper',            detail: 'vs agency · from $39/mo',     sub: 'Agencies charge $45/post or $3–8K/month. NAVA starts at $39/mo ($0.26/post on Spark). Scale plan drops to $0.18/post. Same brand voice, zero briefings.', color: '#10b981' },
  { value: '<90s',  label: 'Trend to Live Post', detail: 'End-to-end, autonomous',      sub: 'From detecting a breaking trend to a published post — before most teams open Slack.', color: '#f59e0b' },
  { value: '48K',   label: 'Impressions',        detail: 'Budget 2026 Twitter thread',  sub: "Hinglish thread auto-generated from the Finance Minister's speech. Trended within the hour.", color: '#EC4899' },
  { value: '2.4K',  label: 'Reactions',          detail: 'AI Layoffs → LinkedIn',       sub: 'Connected a global AI jobs trend to a housing stability angle. Highest engagement post of the pilot.', color: '#6366F1' },
]

const CONTACT_HREF = 'mailto:a.sachin533@gmail.com?subject=NAVA%20%E2%80%94%20Let%27s%20Build%20Together&body=Hi%20Sachin%2C%0A%0AI%27m%20interested%20in%20NAVA%20and%20would%20love%20to%20connect.%0A%0A'

// ─── main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const appName = useAppName()
  const mobile = useMobile()
  // Stable reference — avoids re-reading window.location.origin on every render
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [visible, setVisible] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const containerRef = useRef<HTMLElement>(null)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const isSnapping = useRef(false)
  const currentIdx = useRef(0)
  // Accumulate wheel delta so trackpad momentum micro-events don't stack up
  const wheelAcc = useRef(0)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartY = useRef(0)

  // Derive from mobile state — no direct window.innerWidth access during render
  // (avoids SSR mismatch and repeated layout reads)
  const [winW, setWinW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 768)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const h = () => { clearTimeout(t); t = setTimeout(() => setWinW(window.innerWidth), 150) }
    window.addEventListener('resize', h, { passive: true })
    return () => { window.removeEventListener('resize', h); clearTimeout(t) }
  }, [])
  const carW = mobile ? Math.min(CAR_W, winW - 48) : CAR_W
  const carH = mobile ? 360 : CAR_H

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const container = containerRef.current
    const sections = sectionRefs.current.filter(Boolean) as HTMLDivElement[]
    if (!container || !sections.length) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          const i = sections.indexOf(e.target as HTMLDivElement)
          if (i >= 0) { setActiveSection(i); currentIdx.current = i }
        }
      }),
      { threshold: 0.55, root: container }
    )
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  // Wheel: accumulate delta so a single swipe only advances one section
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const doScroll = (dir: number) => {
      const next = Math.max(0, Math.min(SECTION_COUNT - 1, currentIdx.current + dir))
      if (next === currentIdx.current) return
      isSnapping.current = true
      currentIdx.current = next
      setActiveSection(next)
      container.scrollTo({ top: next * container.clientHeight, behavior: 'smooth' })
      // Hold the lock long enough for trackpad momentum to decay (~1 s after smooth scroll)
      setTimeout(() => { isSnapping.current = false }, 1200)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isSnapping.current) return
      wheelAcc.current += e.deltaY
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      // Reset accumulator if no new events arrive within 200 ms
      wheelTimer.current = setTimeout(() => { wheelAcc.current = 0 }, 200)
      // Require 50 px of accumulated delta before advancing
      if (Math.abs(wheelAcc.current) < 50) return
      const dir = wheelAcc.current > 0 ? 1 : -1
      wheelAcc.current = 0
      doScroll(dir)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  // Touch swipe for mobile
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onTouchStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => { e.preventDefault() }
    const onTouchEnd = (e: TouchEvent) => {
      if (isSnapping.current) return
      const dy = touchStartY.current - e.changedTouches[0].clientY
      if (Math.abs(dy) < 60) return
      const dir = dy > 0 ? 1 : -1
      const next = Math.max(0, Math.min(SECTION_COUNT - 1, currentIdx.current + dir))
      if (next === currentIdx.current) return
      isSnapping.current = true
      currentIdx.current = next
      setActiveSection(next)
      container.scrollTo({ top: next * container.clientHeight, behavior: 'smooth' })
      setTimeout(() => { isSnapping.current = false }, 1000)
    }
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const scrollTo = (i: number) => {
    const c = containerRef.current
    if (!c) return
    currentIdx.current = i
    setActiveSection(i)
    c.scrollTo({ top: i * c.clientHeight, behavior: 'smooth' })
  }

  const ref = (i: number) => (el: HTMLDivElement | null) => { sectionRefs.current[i] = el }

  const S: React.CSSProperties = {
    height: '100vh', overflow: 'hidden',
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    paddingTop: mobile ? '60px' : '72px',
  }

  const pipelineSteps = [
    { Icon: Radio,    label: 'Trend Detection',  desc: '15+ sources. Google, X, YouTube, Reddit. Real-time.', time: '0–30s',   color: '#8B5CF6' },
    { Icon: Search,   label: 'Deep Research',    desc: 'RERA data, breaking news, market signals. Verified.',  time: '30–45s',  color: '#6366F1' },
    { Icon: Layers,   label: 'Content Strategy', desc: 'Trend mapped to your brand angle, tone, and hook.',   time: '45–60s',  color: '#3B82F6' },
    { Icon: Sparkles, label: 'AI Creative',      desc: 'Hinglish-native drafts, QA-verified, ready to ship.', time: '60–75s',  color: '#06B6D4' },
    { Icon: Send,     label: 'Auto-Publish',     desc: 'Twitter · Instagram · LinkedIn · News. Simultaneous.',time: '< 90s',   color: '#10B981' },
  ]

  const features = [
    { Icon: Zap,        title: 'Never miss a moment',     glow: 'rgba(139,92,246,0.25)', body: 'Simultaneous surveillance across 15+ signal sources. When a trend breaks, your content is ready before competitors finish their morning standup.' },
    { Icon: Bot,        title: 'Multi-agent AI pipeline', glow: 'rgba(99,102,241,0.25)', body: 'Purpose-built AI agents work in concert — each hyper-focused on a single stage. Every post is researched, planned, crafted, quality-checked, and published with zero human intervention.' },
    { Icon: Target,     title: 'Platform-native output',  glow: 'rgba(6,182,212,0.25)',  body: "Twitter wit. Instagram visuals. LinkedIn authority. Each post crafted for that platform's algorithm, tone, and audience — never copy-pasted." },
    { Icon: TrendingUp, title: 'Gets smarter over time',  glow: 'rgba(16,185,129,0.25)', body: "Every published post feeds real engagement signals back into the pipeline. NAVA tracks what resonates — likes, shares, reach — and autonomously refines tone, hooks, and timing. The longer it runs, the better it gets." },
  ]

  // Platform nodes for mobile S2 carousel
  const platformNodes: React.ReactNode[] = [
    <div key="tw" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.15)' }}><TwitterIcon size={13} /></div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>X / Twitter</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Wit · Punchy</span>
      </div>
      <TwitterMockup />
    </div>,
    <div key="ig" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><InstagramIcon size={13} /></div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Instagram</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Visual · Branded</span>
      </div>
      <InstagramMockup />
    </div>,
    <div key="li" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0077b5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LinkedInIcon size={13} /></div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>LinkedIn</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Authority · Reach</span>
      </div>
      <LinkedInMockup />
    </div>,
  ]

  // metric carousel nodes
  const metricNodes: React.ReactNode[] = [
    <div key="m0" className="glass" style={{ borderRadius: 24, padding: mobile ? '24px 20px' : '36px 30px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Clock size={20} style={{ color: '#f59e0b' }} />
        <span style={{ fontWeight: 700, fontSize: mobile ? 15 : 17 }}>Time to Publish</span>
      </div>
      <MetricBar label="NAVA (trend → live)" value={1.5} max={50} color="#f59e0b" suffix="m" />
      <MetricBar label="Social media manager" value={240} max={2880} color="#6366F1" suffix="m" />
      <MetricBar label="Agency turnaround" value={2880} max={2880} color="#334155" suffix="m" />
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
        {[['90s','NAVA','#f59e0b'],['4 hrs','Team','#6366F1'],['48 hrs','Agency','#334155']].map(([v,l,c]) => (
          <div key={l} style={{ padding: '10px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: mobile ? 15 : 18, fontWeight: 800, color: c as string }}>{v}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: mobile ? 12 : 13, color: '#f59e0b', fontWeight: 600 }}>
        160× faster than the average agency
      </div>
    </div>,

    <div key="m1" className="glass" style={{ borderRadius: 24, padding: mobile ? '24px 20px' : '36px 30px', height: '100%', boxSizing: 'border-box', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 0 60px rgba(16,185,129,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <TrendingUp size={20} style={{ color: '#10b981' }} />
        <span style={{ fontWeight: 700, fontSize: mobile ? 15 : 17 }}>Engagement Rate</span>
      </div>
      <MetricBar label="NAVA-generated posts" value={3.8} max={5} color="#8B5CF6" suffix="%" />
      <MetricBar label="Manual content team" value={1.8} max={5} color="#6366F1" suffix="%" />
      <MetricBar label="Industry average" value={0.9} max={5} color="#334155" suffix="%" />
      <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <span style={{ fontSize: mobile ? 12 : 14, color: '#10b981', fontWeight: 600 }}>↑ 3.8× higher than industry average</span>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        {[['3.8%','NAVA','#10b981'],['1.8%','Teams','#6366F1'],['0.9%','Avg','#334155']].map(([v,l,c]) => (
          <div key={l}><div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, color: c as string }}>{v}</div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{l}</div></div>
        ))}
      </div>
    </div>,

    <div key="m2" className="glass" style={{ borderRadius: 24, padding: mobile ? '24px 20px' : '36px 30px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <DollarSign size={20} style={{ color: '#06b6d4' }} />
        <span style={{ fontWeight: 700, fontSize: mobile ? 15 : 17 }}>Cost Per Post</span>
      </div>
      <MetricBar label="NAVA (Spark — entry plan)" value={0.26} max={50} color="#06b6d4" />
      <MetricBar label="In-house team" value={22} max={50} color="#6366F1" />
      <MetricBar label="Content agency" value={45} max={50} color="#334155" />
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        {[['$0.26','NAVA entry','#06b6d4'],['$45','Agency','#334155'],['170×','Cheaper','#10b981']].map(([v,l,c]) => (
          <div key={l}><div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, color: c as string }}>{v}</div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', fontSize: mobile ? 12 : 13, color: '#06b6d4', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span>170× cheaper than agency at entry · Scale plan: $0.18/post</span>
        <a href="/pricing" target="_blank" rel="noreferrer" style={{ color: '#c4b5fd', textDecoration: 'none', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>See plans →</a>
      </div>
    </div>,
  ]

  // feature carousel nodes
  const featureNodes: React.ReactNode[] = features.map((f, i) => {
    const FIcon = f.Icon
    return (
      <div key={i} className="glass ghov" style={{ borderRadius: 22, padding: mobile ? '32px 28px' : '44px 40px', height: '100%', boxSizing: 'border-box', boxShadow: `0 0 60px ${f.glow}`, border: i === 1 ? '1px solid rgba(99,102,241,0.25)' : undefined }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <FIcon size={26} style={{ color: '#a78bfa' }} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: mobile ? 18 : 21, marginBottom: 14, color: '#f1f5f9' }}>{f.title}</h3>
        <p style={{ color: '#64748b', fontSize: mobile ? 14 : 15, lineHeight: 1.8 }}>{f.body}</p>
      </div>
    )
  })

  // case study carousel nodes
  const caseNodes: React.ReactNode[] = CASE_CARDS.map((c, i) => (
    <div key={i} className="glass" style={{
      borderRadius: 24, padding: mobile ? '32px 28px' : '40px 36px', height: '100%', boxSizing: 'border-box',
      border: `1px solid ${c.color}44`,
      boxShadow: `0 0 60px ${c.color}22`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ fontSize: mobile ? 48 : 60, fontWeight: 900, color: c.color, letterSpacing: '-0.03em', marginBottom: 10, lineHeight: 1 }}>{c.value}</div>
      <div style={{ fontSize: mobile ? 17 : 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{c.label}</div>
      <div style={{ fontSize: 13, color: c.color, fontWeight: 600, marginBottom: 16 }}>{c.detail}</div>
      <div style={{ fontSize: mobile ? 13 : 14, color: '#64748b', lineHeight: 1.7 }}>{c.sub}</div>
    </div>
  ))

  return (
    <>
      <SEO
        title={`${appName} — The AI #TrendJack Engine`}
        description={`Turn any trending moment into brand buzz in 90 seconds. ${appName} is a multi-agent AI that detects trends, crafts platform-native posts, and publishes across Twitter, Instagram, LinkedIn and more — autonomously.`}
        canonical="/"
        keywords="AI trend jacking, social media automation, trending content AI, brand buzz, Instagram automation, Twitter automation, LinkedIn automation, content marketing AI"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: appName,
            applicationCategory: 'BusinessApplication',
            description: `Multi-agent AI that monitors trending topics and auto-generates platform-native social posts in under 90 seconds`,
            offers: { '@type': 'Offer', price: '39', priceCurrency: 'USD' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: `What is ${appName}?`, acceptedAnswer: { '@type': 'Answer', text: `${appName} is an AI-powered multi-agent trend-jacking engine. It monitors trending topics across 15+ sources and automatically generates platform-native posts for Twitter/X, Instagram, and LinkedIn in under 90 seconds — for brands of any size, in any industry.` } },
              { '@type': 'Question', name: `How fast does ${appName} publish content?`, acceptedAnswer: { '@type': 'Answer', text: `${appName} goes from trend detection to a live published post in under 90 seconds — simultaneously on Twitter/X, Instagram, and LinkedIn.` } },
              { '@type': 'Question', name: `How much does ${appName} cost?`, acceptedAnswer: { '@type': 'Answer', text: `${appName} starts at $39/month (Spark plan, ~150 posts at $0.26/post). All plans include a 14-day free trial.` } },
            ],
          },
        ]}
      />
      <style>{`
        @keyframes float-a{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-60px) scale(1.08)}66%{transform:translate(-30px,30px) scale(0.95)}}
        @keyframes float-b{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-50px,40px) scale(1.05)}70%{transform:translate(30px,-40px) scale(0.97)}}
        @keyframes float-c{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,50px) scale(1.1)}}
        @keyframes slide-up{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.6)}}
        @keyframes wire-fill{0%{width:0%;opacity:1}72%{width:100%;opacity:1}88%{width:100%;opacity:.25}100%{width:100%;opacity:0}}
        .pipe-wire-fill{position:absolute;top:0;left:0;bottom:0;width:0%;border-radius:1px;background:linear-gradient(90deg,#8B5CF6 0%,#818CF8 35%,#38BDF8 70%,#67E8F9 100%);box-shadow:0 0 4px rgba(139,92,246,.6);animation:wire-fill 2.8s linear infinite}
        @keyframes node-0{0%{opacity:.4;box-shadow:none}5%{opacity:1;box-shadow:0 0 32px 8px #8B5CF6}14%,79%{opacity:1;box-shadow:0 0 16px 4px #8B5CF6}92%{opacity:.5;box-shadow:none}100%{opacity:.4;box-shadow:none}}
        @keyframes node-1{0%,16%{opacity:.4;box-shadow:none}22%{opacity:1;box-shadow:0 0 32px 8px #6366F1}31%,79%{opacity:1;box-shadow:0 0 16px 4px #6366F1}92%{opacity:.5;box-shadow:none}100%{opacity:.4;box-shadow:none}}
        @keyframes node-2{0%,34%{opacity:.4;box-shadow:none}40%{opacity:1;box-shadow:0 0 32px 8px #3B82F6}49%,79%{opacity:1;box-shadow:0 0 16px 4px #3B82F6}92%{opacity:.5;box-shadow:none}100%{opacity:.4;box-shadow:none}}
        @keyframes node-3{0%,52%{opacity:.4;box-shadow:none}58%{opacity:1;box-shadow:0 0 32px 8px #06B6D4}67%,79%{opacity:1;box-shadow:0 0 16px 4px #06B6D4}92%{opacity:.5;box-shadow:none}100%{opacity:.4;box-shadow:none}}
        @keyframes node-4{0%,70%{opacity:.4;box-shadow:none}76%{opacity:1;box-shadow:0 0 32px 8px #10B981}82%{opacity:1;box-shadow:0 0 16px 4px #10B981}92%{opacity:.5;box-shadow:none}100%{opacity:.4;box-shadow:none}}
        @keyframes card-live{
          0%,100%{transform:translateY(0) scale(1);    box-shadow:0 16px 48px rgba(0,0,0,0.25),0 0 0px   var(--g,rgba(99,102,241,0));}
          50%    {transform:translateY(-16px) scale(1.018);box-shadow:0 40px 80px rgba(0,0,0,0.4), 0 0 60px var(--g,rgba(99,102,241,0.35));}}
        .anim-up{animation:slide-up 0.7s cubic-bezier(.22,1,.36,1) both}
        .d1{animation-delay:.10s}.d2{animation-delay:.22s}.d3{animation-delay:.36s}.d4{animation-delay:.50s}
        .glass{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);backdrop-filter:blur(16px)}
        .ghov{transition:transform .25s,box-shadow .25s,border-color .25s}
        .ghov:hover{transform:translateY(-4px);border-color:rgba(139,92,246,0.4)}
        .btn-p{background:linear-gradient(135deg,#8B5CF6,#6366F1);transition:opacity .2s,transform .2s,box-shadow .2s}
        .btn-p:hover{opacity:.92;transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,.45)}
        .btn-g{border:1px solid rgba(255,255,255,0.18);transition:border-color .2s,background .2s,transform .2s}
        .btn-g:hover{border-color:rgba(255,255,255,0.45);background:rgba(255,255,255,0.06);transform:translateY(-2px)}
        .dot-grid{background-image:radial-gradient(circle,rgba(255,255,255,0.055) 1px,transparent 1px);background-size:32px 32px}
        .pdot{animation:pdot 2s ease-in-out infinite}
        .snap-box{height:100vh;overflow-y:scroll}
        .pip{border:none;cursor:pointer;border-radius:99px;transition:all .35s cubic-bezier(.22,1,.36,1)}
        .pipe-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px 16px;transition:border-color .25s,transform .25s,box-shadow .25s}
        .pipe-card:hover{transform:translateY(-4px)}
        @media(max-width:767px){
          .hide-mobile{display:none!important}
          .nav-btn-secondary{display:none!important}
        }
      `}</style>

      <div style={{ background: '#07071a', color: '#fff', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ambient orbs */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', top: '-200px', left: '-100px', background: 'radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 70%)', animation: 'float-a 18s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', top: '20%', right: '-150px', background: 'radial-gradient(circle,rgba(6,182,212,0.14) 0%,transparent 70%)', animation: 'float-b 22s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: '10%', left: '30%', background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)', animation: 'float-c 26s ease-in-out infinite' }} />
          <div className="dot-grid" style={{ position: 'absolute', inset: 0 }} />
        </div>

        {/* fixed nav */}
        <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mobile ? '14px 20px' : '18px 52px', background: 'rgba(7,7,26,0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontWeight: 900, fontSize: mobile ? 24 : 32, letterSpacing: '0.01em', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{appName}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/dashboard" className="btn-g" style={{ padding: mobile ? '6px 10px' : '8px 16px', borderRadius: 8, fontSize: mobile ? 12 : 13, fontWeight: 500, color: '#cbd5e1', background: 'transparent', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Dashboard</Link>
            <Link to="/invest" className="btn-p nav-btn-secondary" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Invest</Link>
            <Link to="/pricing" style={{ padding: mobile ? '6px 10px' : '8px 16px', borderRadius: 8, fontSize: mobile ? 12 : 13, fontWeight: 600, color: '#c4b5fd', background: 'transparent', border: '1px solid rgba(139,92,246,.35)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Pricing</Link>
            <a href={CONTACT_HREF} className="btn-g" style={{ padding: mobile ? '8px 14px' : '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#e2e8f0', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              <Mail size={14} />{!mobile && "Let's Talk"}
            </a>
          </div>
        </nav>

        {/* section nav dots — hidden on mobile */}
        {!mobile && (
          <div style={{ position: 'fixed', right: 28, top: '50%', transform: 'translateY(-50%)', zIndex: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: SECTION_COUNT }).map((_, i) => (
              <button key={i} className="pip" onClick={() => scrollTo(i)} aria-label={`Section ${i + 1}`}
                style={{ width: 8, height: activeSection === i ? 32 : 8, padding: 0, background: activeSection === i ? 'linear-gradient(180deg,#818CF8,#38BDF8)' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        )}

        {/* scroll container */}
        <main ref={containerRef} className="snap-box" aria-label="NAVA landing page content">

          {/* ── S1 · HERO ───────────────────────────────────────────── */}
          <div ref={ref(0)} style={S} role="region" aria-label="Hero">
            <CardMarqueeBg />
            {visible && (
              <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 20px', maxWidth: 860, width: '100%' }}>
                <div className="anim-up" style={{ marginBottom: mobile ? 20 : 28 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 10px', borderRadius: 100, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', fontSize: 13, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.04em' }}>
                    <span className="pdot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#a78bfa' }} />
                    AI #TrendJacker
                  </span>
                </div>
                <h1 className="anim-up d1" style={{ fontSize: 'clamp(64px,14vw,156px)', fontWeight: 900, lineHeight: 0.88, letterSpacing: '-0.04em', marginBottom: mobile ? 24 : 40, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', textShadow: '0 0 50px rgba(139,92,246,0.4)' }}>
                  {appName}
                </h1>
                <p className="anim-up d2" style={{ fontSize: 'clamp(18px,3.2vw,36px)', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, maxWidth: 700, marginBottom: 14, letterSpacing: '-0.025em' }}>
                  Content at the speed of trends.
                </p>
                <p className="anim-up d3" style={{ fontSize: mobile ? 14 : 16, color: '#94a3b8', marginBottom: mobile ? 36 : 56, lineHeight: 1.7, maxWidth: 480 }}>
                  Trend detected → AI-crafted post → published. In 90 seconds.
                </p>
                <div className="anim-up d4" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link to="/pricing" className="btn-p" style={{ padding: mobile ? '13px 28px' : '16px 38px', borderRadius: 12, fontSize: mobile ? 14 : 16, fontWeight: 700, color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    Get Started <ArrowRight size={16} />
                  </Link>
                  <Link to="/demo" className="btn-g" style={{ padding: mobile ? '13px 20px' : '16px 28px', borderRadius: 12, fontSize: mobile ? 13 : 15, fontWeight: 600, color: '#c4b5fd', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(139,92,246,.35)', textDecoration: 'none' }}>
                    Watch It Happen
                  </Link>
                </div>
              </section>
            )}
            {/* Bottom stat bar — hidden on mobile to save space */}
            {!mobile && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 52px', display: 'flex', justifyContent: 'center', gap: 56, flexWrap: 'wrap', background: 'rgba(7,7,26,0.5)', backdropFilter: 'blur(10px)' }}>
                {[['15+','Trend sources'],['10+','AI agents'],['<90s','Trend to post'],['5+','Platforms'],['3.8×','Engagement lift']].map(([v,l]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{v}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── S2 · PLATFORM SAMPLES ───────────────────────────────── */}
          <div ref={ref(1)} style={S} role="region" aria-label="Platform post examples">
            <section style={{ width: '100%', maxWidth: 1200, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 28 : 48 }}>
                <h2 style={{ fontSize: mobile ? 'clamp(24px,6vw,36px)' : 'clamp(34px,4.5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
                  Same trend. <GradText>Three perfect posts.</GradText>
                </h2>
                <p style={{ color: '#94a3b8', fontSize: mobile ? 14 : 18 }}>
                  RCB wins IPL → NAVA fires platform-native content across every channel in under 2 minutes.
                </p>
              </div>

              {mobile ? (
                // Carousel on mobile
                <NodeCarousel nodes={platformNodes} interval={3800} cardW={carW} cardH={380} />
              ) : (
                // 3-col grid on desktop
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32, alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.15)' }}><TwitterIcon size={14} /></div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>X / Twitter</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Wit · Punchy</span>
                      </div>
                      <div style={{ animation: 'card-live 5.5s ease-in-out 0s infinite', '--g': 'rgba(29,155,240,0.35)' } as React.CSSProperties}>
                        <TwitterMockup />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><InstagramIcon size={14} /></div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Instagram</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Visual · Branded</span>
                      </div>
                      <div style={{ animation: 'card-live 5.5s ease-in-out 1.83s infinite', '--g': 'rgba(225,48,108,0.35)' } as React.CSSProperties}>
                        <InstagramMockup />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0077b5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LinkedInIcon size={14} /></div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>LinkedIn</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Authority · Reach</span>
                      </div>
                      <div style={{ animation: 'card-live 5.5s ease-in-out 3.67s infinite', '--g': 'rgba(0,119,181,0.35)' } as React.CSSProperties}>
                        <LinkedInMockup />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                    All three generated autonomously · No human in the loop · QA-verified before publish
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ── S3 · PIPELINE ───────────────────────────────────────── */}
          <div ref={ref(2)} style={S} role="region" aria-label="How it works">
            <section style={{ width: '100%', maxWidth: 1160, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 24 : 44 }}>
                <h2 style={{ fontSize: mobile ? 'clamp(22px,6vw,36px)' : 'clamp(34px,4.5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 10 }}>
                 Multi AI agents. <GradText>One unstoppable pipeline.</GradText>
                </h2>
                <p style={{ color: '#94a3b8', fontSize: mobile ? 13 : 17 }}>Trend to published post. Fully autonomous. Under 90 seconds.</p>
              </div>

              {mobile ? (
                // Compact vertical list on mobile
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pipelineSteps.map(({ Icon, label, desc, color, time }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}>
                      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={17} style={{ color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '2px 8px', borderRadius: 100, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>{time}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Desktop: icon row + card row
                <>
                  <div style={{ position: 'relative', marginBottom: 20 }}>
                    {/* animated wire — current flows left→right */}
                    <div style={{ position: 'absolute', top: 36, left: '10%', right: '10%', height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
                      <div className="pipe-wire-fill" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', position: 'relative', zIndex: 1 }}>
                      {pipelineSteps.map(({ Icon, color, time }, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', animation: `node-${i} 2.8s linear infinite` }}>
                            <Icon size={28} style={{ color }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '3px 10px', borderRadius: 100, border: `1px solid ${color}33` }}>{time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
                    {pipelineSteps.map(({ label, desc, color }, i) => (
                      <div key={label} className="pipe-card" style={{ borderTop: `2px solid ${color}` }}>
                        <div style={{ fontSize: 10, color, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Step {String(i + 1).padStart(2, '0')}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.3 }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.75 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* total time strip */}
              <div style={{ marginTop: mobile ? 16 : 28, display: 'flex', alignItems: 'center', gap: 12, padding: mobile ? '12px 16px' : '14px 24px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', flexWrap: 'wrap' }}>
                <Zap size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span style={{ fontSize: mobile ? 12 : 14, color: '#10b981', fontWeight: 600 }}>Full pipeline: Trend → Research → Plan → Create → Publish in under 90 seconds</span>
              </div>
              {/* self-improving callout */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, padding: mobile ? '10px 16px' : '12px 24px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', flexWrap: 'wrap' }}>
                <TrendingUp size={15} style={{ color: '#818cf8', flexShrink: 0 }} />
                <span style={{ fontSize: mobile ? 11 : 13, color: '#818cf8', fontWeight: 600 }}>Self-improving — engagement feedback from every post trains the next one. Quality compounds over time.</span>
              </div>
            </section>
          </div>

          {/* ── S4 · METRICS (carousel) ─────────────────────────────── */}
          <div ref={ref(3)} style={S} role="region" aria-label="Performance metrics">
            <section style={{ width: '100%', maxWidth: 1200, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 24 : 44 }}>
                <h2 style={{ fontSize: mobile ? 'clamp(24px,6vw,36px)' : 'clamp(34px,4.5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>Proof, not promises.</h2>
                <p style={{ color: '#94a3b8', fontSize: mobile ? 14 : 18 }}>Real-world performance vs traditional content production.</p>
              </div>
              <NodeCarousel nodes={metricNodes} interval={4000} cardW={carW} cardH={carH} />
            </section>
          </div>

          {/* ── S5 · CASE STUDY (carousel) ──────────────────────────── */}
          <div ref={ref(4)} style={S} role="region" aria-label="Results and case studies">
            <section style={{ width: '100%', maxWidth: 1140, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 20 : 40 }}>
                <h2 style={{ fontSize: mobile ? 'clamp(24px,6vw,36px)' : 'clamp(34px,4.5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>Numbers Don't Lie.</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: mobile ? 13 : 14, fontWeight: 700, color: '#94a3b8' }}>India's #1 RE Platform</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', letterSpacing: '0.08em' }}>PILOT</span>
                </div>
                {!mobile && <p style={{ color: '#64748b', fontSize: 13 }}>Real results from our pilot deployment · Q1–Q2 2026</p>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#a78bfa', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                  <Users size={13} /> Pilot Metrics
                </div>
              </div>
              <NodeCarousel nodes={caseNodes} interval={3600} cardW={carW} cardH={carH} />
            </section>
          </div>

          {/* ── S6 · FEATURES (carousel) ────────────────────────────── */}
          <div ref={ref(5)} style={S} role="region" aria-label="Key features">
            <section style={{ width: '100%', maxWidth: 1200, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 24 : 44 }}>
                <h2 style={{ fontSize: mobile ? 'clamp(24px,6vw,36px)' : 'clamp(34px,4.5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>Built different.</h2>
                <p style={{ color: '#94a3b8', fontSize: mobile ? 14 : 18 }}>Not a scheduling tool. Not a template engine. An autonomous content machine.</p>
              </div>
              <NodeCarousel nodes={featureNodes} interval={4500} cardW={carW} cardH={carH} />
            </section>
          </div>

          {/* ── S7 · INVESTOR + SHARE ───────────────────────────────── */}
          <div ref={ref(6)} style={S} role="region" aria-label="Investor and social share">
            <section style={{ width: '100%', maxWidth: 1100, padding: mobile ? '0 20px' : '0 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mobile ? 32 : 48 }}>

              {/* Investor card */}
              <div className="glass" style={{ width: '100%', borderRadius: 24, padding: mobile ? '28px 24px' : '44px 52px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 80px rgba(139,92,246,0.12)', display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', gap: mobile ? 24 : 48 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 100, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', fontSize: 11, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.06em', marginBottom: 16 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    EARLY ACCESS
                  </div>
                  <h2 style={{ fontSize: mobile ? 'clamp(24px,6vw,36px)' : 'clamp(28px,3.5vw,44px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.1 }}>
                    Built for the future of<br /><GradText>AI-First #TrendJacking.</GradText>
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: mobile ? 14 : 16, lineHeight: 1.7, maxWidth: 480, marginBottom: 24 }}>
                    A $15B+ addressable market. AI-native infrastructure. Recurring revenue from Day 1. Starting with real estate — expanding to every vertical that publishes.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link to="/invest" className="btn-p" style={{ padding: mobile ? '12px 24px' : '14px 32px', borderRadius: 12, fontSize: mobile ? 14 : 15, fontWeight: 700, color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                      View Investor Brief <ArrowRight size={15} />
                    </Link>
                    <a href={CONTACT_HREF} className="btn-g" style={{ padding: mobile ? '12px 20px' : '14px 28px', borderRadius: 12, fontSize: mobile ? 13 : 14, fontWeight: 600, color: '#e2e8f0', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                      <Mail size={14} /> Partner With Us
                    </a>
                  </div>
                </div>
                {!mobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flexShrink: 0 }}>
                    {[['$2B+','Addressable Market','#8B5CF6'],['3.8×','Engagement Lift','#10b981'],['170×','Cost Advantage','#06b6d4'],['<90s','Time to Publish','#f59e0b']].map(([v,l,c]) => (
                      <div key={l} style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${c}33`, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: c as string, letterSpacing: '-0.03em' }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Share section */}
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: mobile ? 11 : 12, fontWeight: 700, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Blown away? Pass it on.</div>
                <h3 style={{ fontSize: mobile ? 'clamp(22px,5.5vw,32px)' : 'clamp(26px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20 }}>
                  Loved it? <GradText>Spread the word.</GradText>
                </h3>
                <style>{`
                  .share-btn{width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s;will-change:transform}
                  .share-btn:hover{transform:translateY(-3px)}
                  .share-btn-x{background:#000}.share-btn-x:hover{box-shadow:0 8px 24px rgba(0,0,0,0.5)}
                  .share-btn-li{background:#0077b5}.share-btn-li:hover{box-shadow:0 8px 24px rgba(0,119,181,0.45)}
                  .share-btn-wa{background:#25d366}.share-btn-wa:hover{box-shadow:0 8px 24px rgba(37,211,102,0.45)}
                  .share-btn-cp{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.18);color:#e2e8f0;transition:transform .15s,background .15s}
                  .share-btn-cp:hover{background:rgba(255,255,255,0.12);transform:translateY(-3px)}
                `}</style>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('This AI goes from trending topic → published post across Twitter, Instagram & LinkedIn in under 90 seconds.\n\n3.8× engagement lift. 170× cheaper than agencies. Zero human in the loop.\n\nContent marketing just changed. 🔥 #AI #ContentMarketing #TrendJacking')}&url=${encodeURIComponent(origin)}`} target="_blank" rel="noreferrer" title="Share on X" style={{ textDecoration: 'none' }}>
                    <button className="share-btn share-btn-x"><TwitterIcon size={18} /></button>
                  </a>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(origin)}&summary=${encodeURIComponent(`${appName} publishes trend-jacked social posts autonomously in under 90 seconds — 3.8× higher engagement, 170× cheaper than agencies.`)}`} target="_blank" rel="noreferrer" title="Share on LinkedIn" style={{ textDecoration: 'none' }}>
                    <button className="share-btn share-btn-li"><LinkedInIcon size={18} /></button>
                  </a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Bhai dekh yeh — AI jo kisi bhi trending topic se 90 seconds mein Twitter, Instagram aur LinkedIn pe post publish kar deta hai. 🤯\n\n3.8× engagement lift. Agency se 170× sasta. Zero manual work.\n\nYeh content marketing ka future hai 👇\n${origin}`)}`} target="_blank" rel="noreferrer" title="Share on WhatsApp" style={{ textDecoration: 'none' }}>
                    <button className="share-btn share-btn-wa">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.506 3.93 1.395 5.6L0 24l6.545-1.367A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.523-5.197-1.432l-.371-.222-3.864.807.826-3.748-.243-.386A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    </button>
                  </a>
                  <button className="share-btn share-btn-cp" title="Copy link" onClick={() => navigator.clipboard.writeText(`${origin}\n\n${appName} — AI that publishes trend-jacked social posts in under 90 seconds. 3.8× engagement lift, 170× cheaper than agencies. Zero manual work.`)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
              </div>

            </section>
          </div>

          {/* ── S8 · WORK WITH US ───────────────────────────────────── */}
          <div ref={ref(7)} style={S} role="region" aria-label="Careers">
            <section style={{ width: '100%', maxWidth: 1100, padding: mobile ? '0 20px' : '0 48px' }}>
              <div style={{ textAlign: 'center', marginBottom: mobile ? 24 : 40 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px 5px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.06em', marginBottom: 16 }}>
                  <span className="pdot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#6ee7b7' }} />
                  #WeAreHiring
                </span>
                <h2 style={{ fontSize: mobile ? 'clamp(26px,7vw,40px)' : 'clamp(34px,4vw,54px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
                  Come build the <GradText>future of content.</GradText>
                </h2>
                <p style={{ color: '#94a3b8', fontSize: mobile ? 13 : 16, maxWidth: 540, margin: '0 auto', lineHeight: 1.7 }}>
                  Small team. Huge mission. We're growing fast and hiring across every discipline. If the intersection of AI and content excites you — we want to hear from you.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mobile ? 24 : 32 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {['Engineering', 'Design', 'Growth', 'Operations', 'Partnerships', 'Sales'].map(dept => (
                    <span key={dept} style={{ padding: '7px 18px', borderRadius: 100, border: '1px solid rgba(139,92,246,0.28)', background: 'rgba(139,92,246,0.07)', fontSize: mobile ? 12 : 13, color: '#c4b5fd', fontWeight: 600 }}>
                      {dept}
                    </span>
                  ))}
                </div>
                <a href={CONTACT_HREF} style={{ textDecoration: 'none' }}>
                  <button className="btn-p" style={{ padding: mobile ? '13px 32px' : '16px 44px', borderRadius: 12, fontSize: mobile ? 14 : 15, fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={15} /> Reach Out
                  </button>
                </a>
                <div style={{ fontSize: mobile ? 12 : 13, color: '#475569' }}>No formal process. Just say hi.</div>
              </div>
            </section>
          </div>

          {/* ── S9 · CTA + FOOTER ───────────────────────────────────── */}
          <div ref={ref(8)} style={{ ...S, justifyContent: 'space-between' }} role="region" aria-label="Get started">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: mobile ? '0 20px' : '0 24px' }}>
              <h2 style={{ fontSize: mobile ? 'clamp(32px,8vw,56px)' : 'clamp(40px,6vw,72px)', fontWeight: 900, letterSpacing: '-0.035em', marginBottom: 16, color: '#fff' }}>
                Ready to <GradText>#TrendJack?</GradText>
              </h2>
              <p style={{ color: '#94a3b8', fontSize: mobile ? 15 : 18, marginBottom: mobile ? 32 : 48 }}>See it working live — right now.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/pricing" className="btn-p" style={{ padding: mobile ? '14px 28px' : '18px 44px', borderRadius: 14, fontSize: mobile ? 15 : 17, fontWeight: 700, color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  Get Started <ArrowRight size={18} />
                </Link>
                <Link to="/demo" className="btn-g" style={{ padding: mobile ? '14px 20px' : '18px 32px', borderRadius: 14, fontSize: mobile ? 14 : 16, fontWeight: 600, color: '#c4b5fd', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(139,92,246,.35)', textDecoration: 'none' }}>
                  Watch It Happen
                </Link>
              </div>
              {!mobile && (
                <div style={{ marginTop: 52, display: 'flex', gap: 48, color: '#64748b', fontSize: 13 }}>
                  {[['15+','signal sources'],['<90s','trend to post'],['5','platforms'],['0','human steps']].map(([v,l]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#94a3b8', marginBottom: 4 }}>{v}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <footer style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', padding: mobile ? '16px 20px' : '20px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 900, fontSize: mobile ? 16 : 18, letterSpacing: '0.01em', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{appName}</span>
                {!mobile && <span style={{ color: '#475569', fontSize: 13 }}>— AI Content Engine</span>}
              </div>
              {!mobile && (
                <div style={{ display: 'flex', gap: 28 }}>
                  {[['Dashboard','/dashboard',false],['Invest','/invest',false],['Watch It Happen','/demo',true],['Pricing','/pricing',true]].map(([label,path,blank]) => (
                    <a key={label as string} href={path as string} target={blank ? '_blank' : undefined} rel="noreferrer"
                      style={{ color: '#64748b', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#cbd5e1')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                      {label}
                    </a>
                  ))}
                </div>
              )}
              <span style={{ color: '#475569', fontSize: mobile ? 11 : 12 }}>© 2026 {appName} · All rights reserved</span>
            </footer>
          </div>

        </main>
      </div>
    </>
  )
}
