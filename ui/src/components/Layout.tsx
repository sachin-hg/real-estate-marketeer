import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Wand2,
  TrendingUp,
  Settings,
  ChevronRight,
  Play,
  BarChart2,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Posts', path: '/posts' },
  { icon: Play, label: 'Runs', path: '/runs' },
  { icon: BarChart2, label: 'Analytics', path: '/analytics' },
  { icon: BookOpen, label: 'Prompts', path: '/prompts' },
  { icon: Wand2, label: 'Generate', path: '/generate' },
  { icon: TrendingUp, label: 'Trending', path: '/trending' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/posts': 'Posts',
  '/runs': 'Runs',
  '/analytics': 'Analytics',
  '/prompts': 'Prompts',
  '/generate': 'Generate',
  '/trending': 'Trending',
  '/settings': 'Settings',
}

export default function Layout() {
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Housing.com Marketeer'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-slate-900 transition-all duration-200 ${
          expanded ? 'w-56' : 'w-16'
        } flex-shrink-0`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          {expanded && (
            <span className="ml-3 text-white font-semibold text-sm truncate">
              Housing.com
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
            const isActive =
              path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                className={`flex items-center h-9 rounded-lg px-2 transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {expanded && (
                  <span className="ml-3 text-sm font-medium truncate">{label}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Toggle button */}
        <button
          className="flex items-center justify-center h-10 border-t border-slate-800 text-slate-500 hover:text-white transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-base font-semibold text-slate-800">{pageTitle}</h1>
          <span className="text-sm font-bold text-brand tracking-wide">
            Housing.com Marketeer
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
