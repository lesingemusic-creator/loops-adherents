import { Link } from 'react-router-dom'

export default function Profil() {
  return (
    <div className="placeholder-page">
      <span className="badge">Session 2</span>
      <h1>Mon profil</h1>
      <p>Édition : nom, pseudo DJ, photo, bio, liens SoundCloud / Instagram / TikTok. À développer en Session 2.</p>
      <Link to="/dashboard" className="back-link">← Retour dashboard</Link>
    </div>
  )
}
