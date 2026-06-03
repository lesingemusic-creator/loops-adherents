import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="placeholder-page">
      <span className="badge">Session 2</span>
      <h1>Dashboard adhérent</h1>
      <p>Vue d'ensemble : dernières ressources, mix uploadés, formations en cours. Sera codé en Session 2 dès que l'auth Supabase est branchée.</p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' }}>
        <Link to="/formations" className="btn-secondary">Formations</Link>
        <Link to="/packs" className="btn-secondary">Ressources</Link>
        <Link to="/profil" className="btn-secondary">Mon profil</Link>
      </div>
      <Link to="/login" className="back-link">← Retour login</Link>
    </div>
  )
}
