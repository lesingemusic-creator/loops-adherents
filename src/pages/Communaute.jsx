import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { modeCommunaute } from '../lib/communaute'
import CommunauteDiscord from '../components/CommunauteDiscord.jsx'
import CommunauteMaison from '../components/communaute/CommunauteMaison.jsx'

/**
 * Onglet Communaute : Discord (V1, brief du 18/09) ou Communaute maison
 * (plan B du 26/09). Jerome choisit dans Admin > Communaute.
 * Tant que le mode est "discord", l'admin peut ouvrir l'apercu maison.
 */
export default function Communaute() {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [mode, setMode] = useState(null)
  const [apercu, setApercu] = useState(() => {
    try { return sessionStorage.getItem('lp-apercu-communaute') === '1' } catch { return false }
  })

  useEffect(() => { modeCommunaute().then(setMode) }, [])

  function basculerApercu(v) {
    setApercu(v)
    try { sessionStorage.setItem('lp-apercu-communaute', v ? '1' : '0') } catch { /* stockage indisponible */ }
  }

  if (!mode) return null

  if (mode === 'maison') return <CommunauteMaison />

  if (admin && apercu) {
    return (
      <>
        <div className="container cm-apercu-barre">
          <button type="button" className="btn-secondary" onClick={() => basculerApercu(false)}>← Revenir à la version Discord</button>
          <span className="cm-apercu">Aperçu admin : les élèves voient encore Discord. Tu bascules dans Admin, partie Communauté.</span>
        </div>
        <CommunauteMaison apercu />
      </>
    )
  }

  return (
    <>
      {admin && (
        <div className="container">
          <div className="admin-hint" style={{ maxWidth: 640 }}>
            <strong>Nouveau : la Communauté maison.</strong> Tous les salons de ton Discord, directement dans le Backstage,
            sans compte à créer pour les élèves. <button type="button" className="admin-link" onClick={() => basculerApercu(true)}>L'essayer en aperçu</button>
          </div>
        </div>
      )}
      <CommunauteDiscord />
    </>
  )
}
