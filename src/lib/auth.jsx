import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

/**
 * Provider d'authentification global.
 * - Initialise la session au mount.
 * - Écoute les changements (login, logout, refresh token) via onAuthStateChange.
 * - Charge le profil étendu depuis la table profiles à chaque changement de user.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.warn('[auth] profile load error:', error.message)
      setProfile(null)
      return
    }
    setProfile(data)
    activation(userId, data)
  }

  // Activation du compte (brief Jerome, section 3) : a la premiere
  // connexion, la fiche passe "active" et le mail de bienvenue part.
  // Une seule fois par chargement de l'app et par utilisateur.
  const activationFaite = useRef(null)

  async function activation(userId, fiche) {
    if (activationFaite.current === userId) return
    activationFaite.current = userId

    let active = !!fiche?.active_le
    if (!active) {
      const { error } = await supabase.rpc('signaler_connexion')
      if (error) {
        console.warn('[auth] activation :', error.message)
        return
      }
      active = true
    }
    if (active && !fiche?.bienvenue_envoyee_le && fiche?.role !== 'admin') {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      fetch(`${import.meta.env.BASE_URL}api/bienvenue.php`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    }
  }

  useEffect(() => {
    // Récupère la session courante au mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      loadProfile(session?.user?.id).finally(() => setLoading(false))
    })

    // Écoute les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      loadProfile(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function refreshProfile() {
    if (user?.id) await loadProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
