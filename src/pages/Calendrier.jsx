import { useEffect } from 'react'
import { useAuth } from '../lib/auth'

/**
 * Configuration Calendly
 * ─────────────────────────────────────────────────────────
 * Remplace CALENDLY_URL par l'URL de Jérôme dès que tu l'as.
 * Exemple : 'https://calendly.com/loopsandplay/cours-dj'
 *
 * Si plus tard tu veux 2 events distincts (Mix / MAO), tu peux
 * créer un objet { mix: '...', mao: '...' } et ajouter un toggle.
 */
const CALENDLY_URL = '' // ⚠️ À remplir avec l'URL réelle de Jérôme

export default function Calendrier() {
  const { profile } = useAuth()

  // Préremplir Calendly avec les infos de l'adhérent
  const calendlyUrlWithParams = CALENDLY_URL
    ? `${CALENDLY_URL}?name=${encodeURIComponent(profile?.nom || profile?.pseudo_dj || '')}&email=${encodeURIComponent(profile?.id ? '' : '')}&hide_landing_page_details=1&hide_gdpr_banner=1&background_color=000000&text_color=eee5ea&primary_color=ffe53d`
    : ''

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Réserve ton créneau</p>
        <h1 className="app-page-title">Calendrier des cours</h1>
        <p className="app-page-subtitle">
          Choisis ta plage horaire pour ton prochain cours en studio avec Jérôme.
        </p>
      </header>

      {CALENDLY_URL ? (
        <div className="calendrier-embed">
          <iframe
            src={calendlyUrlWithParams}
            title="Calendrier de réservation Loops & Play"
            className="calendrier-frame"
            allow="camera; microphone"
          />
        </div>
      ) : (
        <div className="placeholder-block">
          <span className="badge">Bientôt disponible</span>
          <p>
            Jérôme finalise sa configuration Calendly. La prise de rendez-vous en ligne sera active dans quelques jours.
          </p>
          <p style={{ marginTop: '1rem' }}>
            En attendant, contacte-le directement par WhatsApp pour réserver :
          </p>
          <a
            href="https://wa.me/33759541545?text=Bonjour%20J%C3%A9r%C3%B4me%20!%20Je%20souhaite%20r%C3%A9server%20un%20cr%C3%A9neau%20de%20cours."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Contacter Jérôme
          </a>
        </div>
      )}
    </div>
  )
}
