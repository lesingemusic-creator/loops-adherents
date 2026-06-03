import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const displayName = profile?.pseudo_dj || profile?.nom || user?.email?.split('@')[0] || 'Adhérent'
  const packLabel = profile?.pack
    ? { demo: 'Démo', resident: 'Résident', headliner: 'Headliner' }[profile.pack] || profile.pack
    : null

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Bienvenue dans ton espace</p>
        <h1 className="app-page-title">Salut {displayName} 🎧</h1>
        <p className="app-page-subtitle">
          Tu es connecté à l'espace adhérent Loops &amp; Play
          {packLabel && <> · Parcours <strong>{packLabel}</strong></>}
          {profile?.role === 'admin' && <> · <em style={{ color: 'hsl(var(--accent))' }}>Admin</em></>}
        </p>
      </header>

      <section className="dashboard-grid">
        <Link to="/formations" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <h2>Formations</h2>
          <p>Tes modules vidéo et tes accès Notion.</p>
        </Link>

        <Link to="/packs" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
          </div>
          <h2>Ressources</h2>
          <p>Sample packs, sorties Ft. Low Records, mix de la communauté.</p>
        </Link>

        <Link to="/profil" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2>Mon profil</h2>
          <p>Mets à jour ta bio, ton pseudo DJ et tes liens sociaux.</p>
        </Link>

        {profile?.role === 'admin' && (
          <Link to="/admin" className="dashboard-card dashboard-card-admin">
            <div className="dashboard-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h2>Admin</h2>
            <p>Gérer les adhérents, uploader des ressources, modérer les mix.</p>
          </Link>
        )}
      </section>
    </div>
  )
}
