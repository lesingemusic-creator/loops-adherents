import { useEffect, useState } from 'react'

/**
 * Appli installable (26/09/2026) : detection de la plateforme et de
 * l'etat d'installation, et declenchement de l'installation sur Android.
 */

export function estInstallee() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function plateforme() {
  const ua = navigator.userAgent || ''
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) {
    // Sur iPhone, seul Safari sait ajouter a l'ecran d'accueil proprement.
    const autreNavigateur = /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|WhatsApp/i.test(ua)
    return autreNavigateur ? 'ios-autre' : 'ios'
  }
  if (/Android/i.test(ua)) return 'android'
  return 'ordinateur'
}

export function useInstallation() {
  const [proposition, setProposition] = useState(() => window.__lpInstallation || null)
  const [installee, setInstallee] = useState(estInstallee)

  useEffect(() => {
    const dispo = () => setProposition(window.__lpInstallation || null)
    const faite = () => { setInstallee(true); window.__lpInstallation = null; setProposition(null) }
    window.addEventListener('lp-installable', dispo)
    window.addEventListener('appinstalled', faite)
    return () => {
      window.removeEventListener('lp-installable', dispo)
      window.removeEventListener('appinstalled', faite)
    }
  }, [])

  async function installer() {
    if (!proposition) return false
    proposition.prompt()
    const { outcome } = await proposition.userChoice
    window.__lpInstallation = null
    setProposition(null)
    if (outcome === 'accepted') setInstallee(true)
    return outcome === 'accepted'
  }

  return { installee, peutProposer: !!proposition, installer, plateforme: plateforme() }
}

const CLE_MASQUE = 'lp-bandeau-appli-masque'

export function bandeauMasque() {
  try { return localStorage.getItem(CLE_MASQUE) === '1' } catch { return false }
}

export function masquerBandeau() {
  try { localStorage.setItem(CLE_MASQUE, '1') } catch { /* stockage indisponible */ }
}
