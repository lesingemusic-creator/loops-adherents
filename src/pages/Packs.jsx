import { Link } from 'react-router-dom'

export default function Packs() {
  return (
    <div className="placeholder-page">
      <span className="badge">Session 3 + 4</span>
      <h1>Ressources partagées</h1>
      <p>Sample packs, mix &amp; compositions de la communauté, et sorties du label Ft. Low Records. Téléchargements sécurisés via Google Drive. À développer en Session 3-4.</p>
      <Link to="/dashboard" className="back-link">← Retour dashboard</Link>
    </div>
  )
}
