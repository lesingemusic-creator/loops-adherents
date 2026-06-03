import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Endpoint de handoff : reçoit les tokens dans le hash URL (#access_token=...&refresh_token=...)
 * passés depuis la page espace-adherent.html du site vitrine, puis crée la session Supabase
 * et redirige vers /dashboard.
 *
 * Permet à un utilisateur de se logger depuis le site vitrine (origine A) et d'atterrir
 * authentifié dans l'app React (origine B), malgré l'isolation localStorage cross-origin.
 */
export default function AuthRedirect() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash
    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setError('Tokens manquants. Reviens à la page de connexion.')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
      return
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setError('Session invalide : ' + error.message)
          setTimeout(() => navigate('/login', { replace: true }), 1500)
          return
        }
        // Nettoie l'URL et redirige
        window.history.replaceState({}, '', '/dashboard')
        navigate('/dashboard', { replace: true })
      })
  }, [navigate])

  return (
    <div className="placeholder-page">
      {error ? (
        <>
          <span className="badge" style={{ background: 'hsl(0 84% 60% / .1)', color: 'hsl(0 84% 65%)' }}>Erreur</span>
          <h1>Connexion échouée</h1>
          <p>{error}</p>
        </>
      ) : (
        <>
          <span className="badge">Authentification</span>
          <h1>Connexion en cours…</h1>
          <p>Récupération de ta session, un instant.</p>
        </>
      )}
    </div>
  )
}
