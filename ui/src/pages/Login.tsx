import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBrandName } from '../lib/useBrandName'

// ─── styles ───────────────────────────────────────────────────────────────────

const CSS = `
.login-root {
  --bg: #07071a;
  --surf: rgba(255,255,255,0.04);
  --bord: rgba(255,255,255,0.09);
  --bord-focus: rgba(139,92,246,0.55);
  --purple: #8B5CF6;
  --indigo: #6366F1;
  --cyan: #06B6D4;
  --text: #f1f5f9;
  --muted: #64748b;
  --dim: #334155;
  --error: #f87171;
  --grad: linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%);
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.login-root *, .login-root *::before, .login-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ── ambient blobs ── */
.login-root .orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.login-root .orb-a {
  width: 640px; height: 640px;
  top: -200px; left: -100px;
  background: radial-gradient(circle, rgba(139,92,246,.18) 0%, transparent 70%);
  animation: login-float-a 20s ease-in-out infinite;
}
.login-root .orb-b {
  width: 520px; height: 520px;
  top: 30%; right: -130px;
  background: radial-gradient(circle, rgba(6,182,212,.13) 0%, transparent 70%);
  animation: login-float-b 24s ease-in-out infinite;
}
.login-root .orb-c {
  width: 420px; height: 420px;
  bottom: 5%; left: 38%;
  background: radial-gradient(circle, rgba(99,102,241,.10) 0%, transparent 70%);
  animation: login-float-c 18s ease-in-out infinite;
}

@keyframes login-float-a {
  0%,100% { transform: translate(0,0); }
  33%     { transform: translate(42px,-52px); }
  66%     { transform: translate(-32px,32px); }
}
@keyframes login-float-b {
  0%,100% { transform: translate(0,0); }
  40%     { transform: translate(-42px,36px); }
  70%     { transform: translate(26px,-36px); }
}
@keyframes login-float-c {
  0%,100% { transform: translate(0,0); }
  50%     { transform: translate(22px,46px); }
}

/* ── dot grid ── */
.login-root .dot-grid {
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  z-index: 0;
}

/* ── center layout ── */
.login-root .center {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

/* ── card ── */
.login-root .card {
  width: 100%;
  max-width: 420px;
  border-radius: 24px;
  padding: 44px 40px;
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(20px);
  /* gradient border via box-shadow + pseudo border trick */
  border: 1px solid transparent;
  background-clip: padding-box;
  box-shadow:
    0 0 0 1px rgba(139,92,246,0.35),
    0 24px 80px rgba(0,0,0,0.45),
    0 0 60px rgba(139,92,246,0.08);
  animation: card-in 0.55s cubic-bezier(.34,1.56,.64,1) both;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(32px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── brand name ── */
.login-root .brand {
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -0.03em;
  text-align: center;
  display: block;
  margin-bottom: 6px;
}

/* ── subtitle ── */
.login-root .subtitle {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 36px;
}

/* ── divider ── */
.login-root .divider {
  width: 40px;
  height: 2px;
  margin: 0 auto 32px;
  background: linear-gradient(90deg, var(--purple), var(--cyan));
  border-radius: 1px;
}

/* ── form fields ── */
.login-root .field {
  margin-bottom: 18px;
}

.login-root .field label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
}

.login-root .field input {
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
  -webkit-font-smoothing: antialiased;
}

.login-root .field input::placeholder {
  color: var(--dim);
}

.login-root .field input:focus {
  border-color: var(--bord-focus);
  background: rgba(139,92,246,0.06);
  box-shadow: 0 0 0 3px rgba(139,92,246,0.12);
}

/* ── error ── */
.login-root .error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-radius: 10px;
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.28);
  font-size: 13px;
  color: var(--error);
  font-weight: 500;
  margin-bottom: 18px;
  animation: shake 0.35s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes shake {
  10%,90% { transform: translateX(-2px); }
  20%,80% { transform: translateX(4px); }
  30%,50%,70% { transform: translateX(-5px); }
  40%,60% { transform: translateX(5px); }
}

/* ── submit button ── */
.login-root .submit-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8B5CF6, #6366F1);
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 6px 30px rgba(139,92,246,0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  letter-spacing: 0.01em;
}

.login-root .submit-btn:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(139,92,246,0.52);
}

.login-root .submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ── spinner ── */
.login-root .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── footer links ── */
.login-root .links {
  margin-top: 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-root .links a,
.login-root .links button {
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  transition: color 0.18s;
  padding: 0;
}

.login-root .links a:hover,
.login-root .links button:hover {
  color: #c4b5fd;
}

.login-root .links a.invest-link {
  color: #818cf8;
  font-weight: 600;
}

.login-root .links a.invest-link:hover {
  color: #c4b5fd;
}

/* ── back link ── */
.login-root .back-link {
  position: absolute;
  top: 24px;
  left: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.18s;
  z-index: 20;
}

.login-root .back-link:hover {
  color: #c4b5fd;
}

/* ── responsive ── */
@media (max-width: 480px) {
  .login-root .card {
    padding: 36px 26px;
    border-radius: 20px;
  }
  .login-root .brand {
    font-size: 30px;
  }
}
`

// ─── component ────────────────────────────────────────────────────────────────

export default function Login() {
  const brand = useBrandName()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const next = params.get('next') ?? '/pitch'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)

    try {
      await login(username.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Ambient background */}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="dot-grid" />

      {/* Back to homepage */}
      <a href="/" className="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Homepage
      </a>

      <div className="center">
        <div className="card">
          {/* Brand */}
          <span className="brand">{brand}</span>
          <div className="divider" />
          <p className="subtitle">Early Access</p>

          {/* Error */}
          {error && (
            <div className="error-box" key={error}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                placeholder="your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting || !username || !password}
            >
              {submitting ? (
                <>
                  <span className="spinner" />
                  Verifying…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Enter the vault
                </>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="links">
            <span>
              Don't have access yet?{' '}
              <Link to="/invest" className="invest-link">
                Get early access →
              </Link>
            </span>
            <a href="/">Back to homepage</a>
          </div>
        </div>
      </div>
    </div>
  )
}
