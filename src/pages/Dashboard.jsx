import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useState } from 'react'
import { libelleFormule } from '../lib/formules'
import { useInstallation, bandeauMasque, masquerBandeau } from '../lib/installation'
import '../styles/installer.css'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const displayName = profile?.pseudo_dj || profile?.nom || user?.email?.split('@')[0] || 'Adhérent'
  const packLabel = libelleFormule(profile)
  const { installee, peutProposer, installer, plateforme } = useInstallation()
  const [bandeau, setBandeau] = useState(() => !bandeauMasque())
  const surTelephone = plateforme !== 'ordinateur'

  return (
    <div className="container">
      {!installee && surTelephone && bandeau && (
        <div className="inst-bandeau" role="note">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <p>Mets le Backstage sur ton écran d'accueil, comme une appli.</p>
          {peutProposer
            ? <button type="button" className="inst-bandeau-action" onClick={installer}>Installer</button>
            : <Link to="/installer">Comment faire</Link>}
          <button type="button" className="inst-bandeau-fermer" aria-label="Masquer" onClick={() => { masquerBandeau(); setBandeau(false) }}>×</button>
        </div>
      )}

      <header className="app-page-header">
        <p className="app-page-eyebrow">Bienvenue dans ton espace</p>
        <h1 className="app-page-title">Salut {displayName} 🎧</h1>
        <p className="app-page-subtitle">
          Tu es dans le Backstage Loops &amp; Play
          {packLabel && <> · Formule <strong>{packLabel}</strong></>}
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

        <Link to="/calendrier" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h2>Calendrier</h2>
          <p>Réserve ton créneau de cours en studio avec Jérôme.</p>
        </Link>

        <Link to="/packs" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
          </div>
          <h2>Ressources</h2>
          <p>Sample packs, sorties Ft. Low Records, mix de la communauté.</p>
        </Link>

        <Link to="/communaute" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h2>Communauté</h2>
          <p>Échange avec les autres élèves, partage tes mix.</p>
        </Link>

        <Link to="/profil" className="dashboard-card">
          <div className="dashboard-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2>Mon profil</h2>
          <p>Mets à jour ta bio, ton pseudo DJ et tes liens sociaux.</p>
        </Link>

        {!installee && (
          <Link to="/installer" className="dashboard-card">
            <div className="dashboard-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            </div>
            <h2>L'appli</h2>
            <p>Le Backstage sur ton écran d'accueil, en un geste.</p>
          </Link>
        )}

        {profile?.role === 'admin' && (
          <Link to="/admin" className="dashboard-card dashboard-card-admin">
            <div className="dashboard-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h2>Admin</h2>
            <p>Inscriptions, comptes élèves, modules, cours filmés, communauté.</p>
          </Link>
        )}
      </section>
    </div>
  )
}
