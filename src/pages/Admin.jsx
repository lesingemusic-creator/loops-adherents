import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function Admin() {
  const { profile, loading } = useAuth()

  if (loading) return null
  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Panel admin</p>
        <h1 className="app-page-title">Gestion de l'espace</h1>
        <p className="app-page-subtitle">Créer des adhérents, uploader des ressources, modérer les mix. À développer en Session 4.</p>
      </header>
      <div className="placeholder-block">
        <span className="badge">Session 4</span>
        <p>Outils admin réservés à Jérôme : création/suppression d'adhérents, upload de sample packs, validation des mix uploadés, statistiques d'usage.</p>
      </div>
    </div>
  )
}
