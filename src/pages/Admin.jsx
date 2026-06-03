import { Link } from 'react-router-dom'

export default function Admin() {
  return (
    <div className="placeholder-page">
      <span className="badge">Session 4</span>
      <h1>Panel admin</h1>
      <p>Interface réservée à Jérôme : créer/supprimer adhérents, uploader sample packs, modérer les mix uploadés, voir les stats. À développer en Session 4.</p>
      <Link to="/dashboard" className="back-link">← Retour dashboard</Link>
    </div>
  )
}
