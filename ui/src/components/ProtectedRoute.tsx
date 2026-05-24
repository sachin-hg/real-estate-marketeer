import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  // When true, render <Outlet /> while auth is still resolving instead of null.
  // Use only for routes whose HTML is server-auth-gated (FastAPI 302s unauthenticated
  // requests before the page is delivered), so the optimistic render is safe.
  optimistic?: boolean
}

export default function ProtectedRoute({ optimistic = false }: Props) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return optimistic ? <Outlet /> : null

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  return <Outlet />
}
