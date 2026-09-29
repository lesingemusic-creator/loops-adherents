import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Tutoriel from './Tutoriel'
import '../styles/layout.css'
import '../styles/aide.css'

/**
 * Layout partagé par toutes les pages protégées (dashboard, formations, packs, profil, admin).
 * Affiche une navbar avec le logo, les liens, et le profil utilisateur + logout.
 */
export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut } = useAuth()

  const isAdmin = profile?.role === 'admin'

  // Pastille sur "Mon cours filmé" tant qu'une séance n'a pas été ouverte.
  // On recompte à chaque changement de page : c'est une requête de comptage,
  // elle ne ramène aucune ligne.
  const [coursNonVus, setCoursNonVus] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let annule = false

    supabase
      .from('cours_filmes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('vu_le', null)
      .then(({ count, error }) => {
        if (annule || error) return
        setCoursNonVus(count || 0)
      })

    return () => { annule = true }
  }, [user?.id, location.pathname])
  // Pastille Communaute : non-lus des salons et messages prives.
  const [commNonLus, setCommNonLus] = useState(0)
  useEffect(() => {
    if (!user?.id) return
    let annule = false
    ;(async () => {
      if (location.pathname.startsWith('/communaute')) { setCommNonLus(0); return }
      const [a, b] = await Promise.all([supabase.rpc('comm_non_lus_salons'), supabase.rpc('comm_mes_prives')])
      if (annule) return
      const n = (a.data || []).reduce((t, r) => t + r.non_lus, 0) + (b.data || []).reduce((t, r) => t + r.non_lus, 0)
      setCommNonLus(n)
    })()
    return () => { annule = true }
  }, [user?.id, location.pathname])

  const initial = (profile?.pseudo_dj || profile?.nom || 'U').charAt(0).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      <header className="app-navbar">
        <div className="container app-navbar-inner">
          <NavLink to="/dashboard" className="app-logo">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Loops & Play" />
            <span>Loops <em>//</em> Play</span>
          </NavLink>

          <nav className="app-nav">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
            <NavLink to="/formations" data-tuto="formations" className={({ isActive }) => isActive ? 'active' : ''}>Formations</NavLink>
            <NavLink to="/calendrier" data-tuto="calendrier" className={({ isActive }) => isActive ? 'active' : ''}>Calendrier</NavLink>
            <NavLink to="/mon-cours-filme" data-tuto="cours-filme" className={({ isActive }) => isActive ? 'active' : ''}>
              Mon cours filmé
              {coursNonVus > 0 && (
                <span className="nav-pastille" aria-label={`${coursNonVus} nouvelle(s) séance(s)`} />
              )}
            </NavLink>
            <NavLink to="/communaute" data-tuto="communaute" className={({ isActive }) => isActive ? 'active' : ''}>
              Communauté
              {commNonLus > 0 && <span className="nav-pastille" aria-label={`${commNonLus} message(s) non lu(s)`} />}
            </NavLink>
            <NavLink to="/packs" data-tuto="ressources" className={({ isActive }) => isActive ? 'active' : ''}>Ressources</NavLink>
            <NavLink to="/profil" data-tuto="profil" className={({ isActive }) => isActive ? 'active' : ''}>Profil</NavLink>
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
          </nav>

          <div className="app-user">
            <NavLink to="/aide" data-tuto="aide" className={({ isActive }) => `app-aide${isActive ? ' active' : ''}`} aria-label="Aide" title="Aide">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </NavLink>
            <div className="app-avatar" title={profile?.pseudo_dj || profile?.nom || 'Adhérent'}>
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Avatar" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <button onClick={handleSignOut} className="app-logout" aria-label="Se déconnecter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <Tutoriel uid={user?.id} />
    </div>
  )
}
