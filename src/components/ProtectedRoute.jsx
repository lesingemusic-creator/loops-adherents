import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/**
 * Wrapper de route qui redirige vers /login si l'utilisateur n'est pas authentifié.
 * Tant que la session est en cours de chargement, on n'affiche rien (évite un flash de login).
 *
 * Usage :
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="placeholder-page">
        <span className="badge">Vérification</span>
        <h1>Un instant…</h1>
        <p>On vérifie ton accès.</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
