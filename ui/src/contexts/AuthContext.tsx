import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

// ─── types ────────────────────────────────────────────────────────────────────

interface AuthUser {
  username: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

// ─── context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'nava_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};max-age=${COOKIE_MAX_AGE};path=/;SameSite=Strict`
}

function removeCookie(name: string) {
  document.cookie = `${name}=;max-age=0;path=/`
}

// ─── provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, rehydrate from cookie (with localStorage fallback) and validate with the server
  useEffect(() => {
    const stored = getCookie(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }
    // Migrate from localStorage to cookie if needed
    if (!getCookie(TOKEN_KEY) && stored) setCookie(TOKEN_KEY, stored)

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('invalid token')
        const data = await res.json() as { username: string; role: string }
        setToken(stored)
        setUser({ username: data.username, role: data.role })
      })
      .catch(() => {
        removeCookie(TOKEN_KEY)
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password })
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string }
      throw new Error(err.detail ?? 'Login failed')
    }

    const data = await res.json() as {
      access_token: string
      username: string
      role: string
    }

    setCookie(TOKEN_KEY, data.access_token)
    localStorage.removeItem(TOKEN_KEY) // clear any legacy localStorage token
    setToken(data.access_token)
    setUser({ username: data.username, role: data.role })
  }, [])

  const logout = useCallback(() => {
    removeCookie(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
