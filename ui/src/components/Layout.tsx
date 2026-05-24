import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BookOpen, Wand2, TrendingUp,
  Settings, Play, BarChart2, ChevronRight, LogOut, User, MoreHorizontal,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useBrandName } from '../lib/useBrandName'

const GRAD = 'linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%)'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',  path: '/dashboard' },
  { icon: FileText,        label: 'Posts',       path: '/dashboard/posts' },
  { icon: Play,            label: 'Runs',        path: '/dashboard/runs' },
  { icon: BarChart2,       label: 'Analytics',   path: '/dashboard/analytics' },
  { icon: BookOpen,        label: 'Prompts',     path: '/dashboard/prompts' },
  { icon: Wand2,           label: 'Generate',    path: '/dashboard/generate' },
  { icon: TrendingUp,      label: 'Trending',    path: '/dashboard/trending' },
  { icon: Settings,        label: 'Settings',    path: '/dashboard/settings' },
]

const PAGE_TITLES: [string, string][] = [
  ['/dashboard/posts',     'Posts'],
  ['/dashboard/runs',      'Runs'],
  ['/dashboard/analytics', 'Analytics'],
  ['/dashboard/prompts',   'Prompts'],
  ['/dashboard/generate',  'Generate'],
  ['/dashboard/trending',  'Trending'],
  ['/dashboard/settings',  'Settings'],
  ['/dashboard',           'Dashboard'],
]

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .layout-root *{box-sizing:border-box;font-family:'Inter',system-ui,sans-serif}
  .layout-root{display:flex;height:100vh;height:100dvh;overflow:hidden;background:#07071a;color:#f1f5f9}

  /* ── sidebar ── */
  .lsb{display:flex;flex-direction:column;background:rgba(255,255,255,0.025);border-right:1px solid rgba(255,255,255,0.06);transition:width .22s cubic-bezier(.22,1,.36,1);flex-shrink:0;overflow:hidden}
  .lsb-wide{width:220px}
  .lsb-slim{width:60px}

  /* ── bottom nav (mobile only, hidden on desktop) ── */
  .l-bnav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;height:56px;background:rgba(7,7,26,0.98);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(255,255,255,0.08);align-items:stretch;padding:0 4px;padding-bottom:env(safe-area-inset-bottom,0px)}
  .l-bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;color:#475569;border:none;background:transparent;cursor:pointer;padding:4px 2px;border-radius:0;transition:color .15s;-webkit-tap-highlight-color:transparent}
  .l-bnav-item.active{color:#c4b5fd}
  .l-bnav-lbl{font-size:9.5px;font-weight:600;letter-spacing:0.02em}

  .lsb-logo{display:flex;align-items:center;height:60px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;gap:10px;overflow:hidden;white-space:nowrap}
  .lsb-logo-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#8B5CF6,#6366F1);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;flex-shrink:0}
  .lsb-logo-text{font-weight:900;font-size:16px;letter-spacing:0.01em;background:${GRAD};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

  .lsb-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px;overflow:hidden}
  .lsb-item{display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:10px;text-decoration:none;color:#64748b;transition:background .15s,color .15s;white-space:nowrap;overflow:hidden;cursor:pointer;border:none}
  .lsb-item:hover{background:rgba(255,255,255,0.06);color:#cbd5e1}
  .lsb-item.active{background:rgba(139,92,246,0.18);color:#c4b5fd;border:1px solid rgba(139,92,246,0.25)}
  .lsb-item svg{flex-shrink:0}
  .lsb-label{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis}

  .lsb-footer{padding:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:4px}
  .lsb-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;overflow:hidden;white-space:nowrap}
  .lsb-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#38BDF8);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
  .lsb-username{font-size:12px;font-weight:600;color:#94a3b8;overflow:hidden;text-overflow:ellipsis}
  .lsb-logout{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:8px;background:transparent;border:none;cursor:pointer;color:#475569;transition:background .15s,color .15s;width:100%;text-align:left;white-space:nowrap;overflow:hidden}
  .lsb-logout:hover{background:rgba(244,63,94,0.12);color:#f43f5e}
  .lsb-logout span{font-size:12px;font-weight:500}

  .lsb-toggle{display:flex;align-items:center;justify-content:center;height:36px;border:none;border-top:1px solid rgba(255,255,255,0.06);background:transparent;color:#334155;cursor:pointer;transition:color .15s;flex-shrink:0}
  .lsb-toggle:hover{color:#94a3b8}

  /* ── main area ── */
  .lmain{display:flex;flex-direction:column;flex:1;overflow:hidden}

  .lhdr{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(7,7,26,0.85);backdrop-filter:blur(20px);flex-shrink:0}
  .lhdr-title{font-size:15px;font-weight:700;color:#f1f5f9}
  .lhdr-brand{font-size:13px;font-weight:800;letter-spacing:0.04em;background:${GRAD};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

  .lcontent{flex:1;overflow-y:auto;padding:28px;background:#07071a}
  .lcontent::-webkit-scrollbar{width:4px}
  .lcontent::-webkit-scrollbar-track{background:transparent}
  .lcontent::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}

  /* ── dark overrides for page components (Tailwind light → dark) ── */
  .lcontent .bg-white,.lcontent .bg-slate-50{background:rgba(255,255,255,0.04)!important;border-color:rgba(255,255,255,0.08)!important}
  .lcontent .bg-slate-100{background:rgba(255,255,255,0.06)!important}
  .lcontent .border-slate-200,.lcontent .border-slate-100,.lcontent .border-slate-50{border-color:rgba(255,255,255,0.06)!important}
  .lcontent .text-slate-800,.lcontent .text-slate-700{color:#f1f5f9!important}
  .lcontent .text-slate-600{color:#cbd5e1!important}
  .lcontent .text-slate-500{color:#94a3b8!important}
  .lcontent .text-slate-400{color:#64748b!important}
  .lcontent .shadow-sm{box-shadow:0 2px 12px rgba(0,0,0,0.4)!important}
  .lcontent .shadow-md{box-shadow:0 4px 20px rgba(0,0,0,0.5)!important}
  .lcontent .divide-slate-100>*+*,.lcontent .divide-slate-200>*+*,.lcontent .divide-slate-50>*+*{border-color:rgba(255,255,255,0.06)!important}
  .lcontent .hover\\:bg-brand-50:hover,.lcontent .hover\\:bg-slate-50:hover{background:rgba(139,92,246,0.08)!important}
  .lcontent .hover\\:bg-slate-100:hover{background:rgba(255,255,255,0.06)!important}
  .lcontent .hover\\:border-slate-300:hover{border-color:rgba(139,92,246,0.35)!important}
  .lcontent .hover\\:shadow-md:hover{box-shadow:0 4px 20px rgba(139,92,246,0.15)!important}
  .lcontent input,.lcontent textarea,.lcontent select{background:rgba(255,255,255,0.05)!important;border-color:rgba(255,255,255,0.12)!important;color:#f1f5f9!important}
  .lcontent input::placeholder,.lcontent textarea::placeholder{color:#475569!important}
  .lcontent input:focus,.lcontent textarea:focus,.lcontent select:focus{border-color:rgba(139,92,246,0.5)!important;box-shadow:0 0 0 3px rgba(139,92,246,0.15)!important;outline:none!important}
  .lcontent table thead tr{background:rgba(255,255,255,0.03)!important}
  .lcontent table thead th{color:#64748b!important}
  .lcontent table tbody tr:hover{background:rgba(139,92,246,0.06)!important}
  .lcontent .rounded-xl{border-radius:16px!important}

  /* status badges — keep coloured but tweak bg */
  .lcontent .bg-green-100{background:rgba(16,185,129,0.15)!important}
  .lcontent .text-green-700{color:#34d399!important}
  .lcontent .bg-red-100{background:rgba(239,68,68,0.15)!important}
  .lcontent .text-red-700{color:#f87171!important}
  .lcontent .bg-blue-100{background:rgba(59,130,246,0.15)!important}
  .lcontent .text-blue-700{color:#60a5fa!important}
  .lcontent .bg-sky-100{background:rgba(14,165,233,0.15)!important}
  .lcontent .text-sky-700{color:#38bdf8!important}
  .lcontent .bg-pink-100{background:rgba(236,72,153,0.15)!important}
  .lcontent .text-pink-700{color:#f472b6!important}
  .lcontent .bg-amber-100{background:rgba(245,158,11,0.15)!important}
  .lcontent .text-amber-700{color:#fbbf24!important}
  .lcontent .bg-emerald-100{background:rgba(16,185,129,0.15)!important}
  .lcontent .text-emerald-700{color:#34d399!important}
  .lcontent .bg-yellow-100{background:rgba(234,179,8,0.15)!important}
  .lcontent .text-yellow-700{color:#facc15!important}
  .lcontent .bg-violet-100{background:rgba(139,92,246,0.15)!important}
  .lcontent .text-violet-700{color:#a78bfa!important}
  .lcontent .bg-indigo-100{background:rgba(99,102,241,0.15)!important}
  .lcontent .text-indigo-700{color:#818cf8!important}
  .lcontent .bg-purple-100{background:rgba(168,85,247,0.15)!important}
  .lcontent .text-purple-700{color:#d8b4fe!important}

  /* brand color references */
  .lcontent .text-brand{color:#a78bfa!important}
  .lcontent .bg-brand{background:linear-gradient(135deg,#8B5CF6,#6366F1)!important}
  .lcontent .bg-brand-50{background:rgba(139,92,246,0.08)!important}
  .lcontent .text-emerald-600{color:#34d399!important}
  .lcontent .text-sky-600{color:#38bdf8!important}
  .lcontent .text-rose-600{color:#f87171!important}
  .lcontent .text-violet-600{color:#a78bfa!important}
  .lcontent .text-amber-600{color:#fbbf24!important}
  .lcontent .text-indigo-600{color:#818cf8!important}
  .lcontent .text-rose-400{color:#fb7185!important}

  /* buttons */
  .lcontent button.bg-brand,.lcontent .btn-primary{background:linear-gradient(135deg,#8B5CF6,#6366F1)!important;border:none!important;color:#fff!important}
  .lcontent button.bg-brand:hover,.lcontent .btn-primary:hover{opacity:.9!important;transform:translateY(-1px)!important}

  /* scrollbar in content areas */
  .lcontent *::-webkit-scrollbar{width:4px;height:4px}
  .lcontent *::-webkit-scrollbar-track{background:transparent}
  .lcontent *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}

  /* ── mobile ── */
  @media(max-width:767px){
    .lsb{display:none!important}
    .lmain{height:100dvh}
    .lhdr{padding:0 14px;height:50px}
    .lhdr-title{font-size:14px}
    .lcontent{padding:12px 12px 76px;-webkit-overflow-scrolling:touch}
    .l-bnav{display:flex}

    /* tables: fill container but shrink status/value columns to content */
    .lcontent table td,.lcontent table th{padding:7px 10px!important}
    .lcontent table td:not(:first-child),.lcontent table th:not(:first-child){width:1%;white-space:nowrap}
    .lcontent .overflow-x-auto,.lcontent [style*="overflowX"]{overflow-x:auto;-webkit-overflow-scrolling:touch}

    /* filter bars: make selects + inputs wrap neatly */
    .lcontent select{flex:1 1 130px;min-width:0!important}
    .lcontent input[type="text"],.lcontent input[type="search"]{flex:1 1 100%;min-width:0!important}
    .lcontent input[type="date"]{flex:1 1 120px;min-width:0!important;width:100%}

    /* columns masonry (Posts page) */
    .lcontent .columns-2,.lcontent .md\\:columns-2,.lcontent .xl\\:columns-3{columns:1!important}
  }

  /* ── more sheet (mobile) ── */
  .l-more-overlay{display:none;position:fixed;inset:0;z-index:299;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
  .l-more-overlay.open{display:block}
  .l-more-sheet{position:fixed;bottom:0;left:0;right:0;z-index:300;background:rgba(10,10,30,0.98);border-top:1px solid rgba(255,255,255,0.1);border-radius:20px 20px 0 0;padding-bottom:calc(56px + env(safe-area-inset-bottom,0px));transform:translateY(calc(100% + 56px));transition:transform .28s cubic-bezier(.32,1,.36,1)}
  .l-more-sheet.open{transform:translateY(0)}
  .l-more-sheet-handle{width:36px;height:4px;borderRadius:2px;background:rgba(255,255,255,0.15);margin:10px auto 4px}
  .l-more-row{display:flex;align-items:center;gap:14px;padding:13px 24px;color:#94a3b8;text-decoration:none;font-size:14px;font-weight:500;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;-webkit-tap-highlight-color:transparent;transition:background .12s,color .12s}
  .l-more-row:active{background:rgba(255,255,255,0.06)}
  .l-more-row.active{color:#c4b5fd}
  .l-more-divider{height:1px;background:rgba(255,255,255,0.07);margin:4px 24px}
  .l-more-logout{color:#f43f5e!important}
  .l-more-logout:active{background:rgba(244,63,94,0.08)!important}
`

const BOT_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',     path: '/dashboard' },
  { icon: FileText,        label: 'Posts',    path: '/dashboard/posts' },
  { icon: Play,            label: 'Runs',     path: '/dashboard/runs' },
  { icon: Wand2,           label: 'Generate', path: '/dashboard/generate' },
]

const MORE_NAV_ITEMS = [
  { icon: BarChart2,  label: 'Analytics', path: '/dashboard/analytics' },
  { icon: BookOpen,   label: 'Prompts',   path: '/dashboard/prompts' },
  { icon: TrendingUp, label: 'Trending',  path: '/dashboard/trending' },
  { icon: Settings,   label: 'Settings',  path: '/dashboard/settings' },
]

export default function Layout() {
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const appName = useBrandName()

  const isWide = expanded || pinned

  const pageTitle = (() => {
    for (const [p, t] of PAGE_TITLES) {
      if (p === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(p)) return t
    }
    return appName
  })()

  useEffect(() => { setExpanded(false); setMoreOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="layout-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Sidebar */}
      <aside
        className={`lsb ${isWide ? 'lsb-wide' : 'lsb-slim'}`}
        onMouseEnter={() => !pinned && setExpanded(true)}
        onMouseLeave={() => !pinned && setExpanded(false)}
      >
        {/* Logo */}
        <div className="lsb-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="lsb-logo-icon">{appName[0]}</div>
          {isWide && <span className="lsb-logo-text">{appName}</span>}
        </div>

        {/* Nav */}
        <nav className="lsb-nav">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
            const active = path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                end={path === '/dashboard'}
                className={`lsb-item${active ? ' active' : ''}`}
              >
                <Icon size={17} />
                {isWide && <span className="lsb-label">{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer: user + logout */}
        <div className="lsb-footer">
          {isWide && user && (
            <div className="lsb-user">
              <div className="lsb-avatar"><User size={13} /></div>
              <span className="lsb-username">{user.username}</span>
            </div>
          )}
          <button className="lsb-logout" onClick={handleLogout}>
            <LogOut size={14} />
            {isWide && <span>Sign out</span>}
          </button>
        </div>

        {/* Pin toggle */}
        <button className="lsb-toggle" onClick={() => setPinned(v => !v)} title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}>
          <ChevronRight size={14} style={{ transform: isWide ? 'rotate(180deg)' : 'none', transition: 'transform .22s' }} />
        </button>
      </aside>

      {/* Main */}
      <div className="lmain">
        <header className="lhdr">
          <span className="lhdr-title">{pageTitle}</span>
          <span className="lhdr-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>{appName}</span>
        </header>
        <main className="lcontent">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="l-bnav">
        {BOT_NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = path === '/dashboard'
            ? location.pathname === '/dashboard'
            : location.pathname.startsWith(path)
          return (
            <NavLink key={path} to={path} end={path === '/dashboard'} className={`l-bnav-item${active ? ' active' : ''}`}>
              <Icon size={20} />
              <span className="l-bnav-lbl">{label}</span>
            </NavLink>
          )
        })}
        {/* More button */}
        <button
          className={`l-bnav-item${MORE_NAV_ITEMS.some(i => location.pathname.startsWith(i.path)) ? ' active' : ''}`}
          onClick={() => setMoreOpen(v => !v)}
        >
          <MoreHorizontal size={20} />
          <span className="l-bnav-lbl">More</span>
        </button>
      </nav>

      {/* More overlay */}
      <div className={`l-more-overlay${moreOpen ? ' open' : ''}`} onClick={() => setMoreOpen(false)} />

      {/* More sheet */}
      <div className={`l-more-sheet${moreOpen ? ' open' : ''}`}>
        <div className="l-more-sheet-handle" />
        {user && (
          <div style={{ padding: '8px 24px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              <User size={14} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{user.username}</span>
          </div>
        )}
        <div className="l-more-divider" />
        {MORE_NAV_ITEMS.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            className={`l-more-row${location.pathname.startsWith(path) ? ' active' : ''}`}
            onClick={() => setMoreOpen(false)}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <div className="l-more-divider" />
        <button className="l-more-row l-more-logout" onClick={handleLogout}>
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  )
}
