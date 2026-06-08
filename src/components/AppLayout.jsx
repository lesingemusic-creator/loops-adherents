import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import '../styles/layout.css'

/**
 * Layout partagé par toutes les pages protégées (dashboard, formations, packs, profil, admin).
 * Affiche une navbar avec le logo, les liens, et le profil utilisateur + logout.
 */
export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const isAdmin = profile?.role === 'admin'
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
            <img src="/logo.png" alt="Loops & Play" />
            <span>Loops <em>//</em> Play</span>
          </NavLink>

          <nav className="app-nav">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
            <NavLink to="/formations" className={({ isActive }) => isActive ? 'active' : ''}>Formations</NavLink>
            <NavLink to="/calendrier" className={({ isActive }) => isActive ? 'active' : ''}>Calendrier</NavLink>
            <NavLink to="/packs" className={({ isActive }) => isActive ? 'active' : ''}>Ressources</NavLink>
            <NavLink to="/profil" className={({ isActive }) => isActive ? 'active' : ''}>Profil</NavLink>
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
          </nav>

          <div className="app-user">
            <div className="app-avatar" title={profile?.pseudo_dj || profile?.nom || 'Adhérent'}>
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Avatar" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <button onClick={handleSignOut} className="app-logout" aria-label="Se déconnecter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
