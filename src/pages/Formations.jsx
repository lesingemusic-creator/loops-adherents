import { Link } from 'react-router-dom'

export default function Formations() {
  return (
    <div className="placeholder-page">
      <span className="badge">Session 3</span>
      <h1>Formations</h1>
      <p>Catalogue des modules vidéo et liens vers les Notion partagés de chaque parcours (Démo, Résident, Headliner). À développer en Session 3.</p>
      <Link to="/dashboard" className="back-link">← Retour dashboard</Link>
    </div>
  )
}
