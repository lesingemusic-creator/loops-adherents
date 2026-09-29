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
    const faite = () => { noterInstallee(); setInstallee(true); window.__lpInstallation = null; setProposition(null) }
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
    if (outcome === 'accepted') { noterInstallee(); setInstallee(true) }
    return outcome === 'accepted'
  }

  return { installee, peutProposer: !!proposition, installer, plateforme: plateforme() }
}

// Bandeau « installe l'appli » (revu le 29/09/2026) : il revient a chaque
// visite tant que l'eleve n'a pas installe l'appli ni choisi « Ne plus
// afficher ». La croix ne fait que le reporter au lendemain.
const CLE_MASQUE = 'lp-bandeau-appli-masque'
const CLE_REPORT = 'lp-bandeau-appli-report'
const CLE_INSTALLEE = 'lp-appli-installee'
const UN_JOUR = 24 * 60 * 60 * 1000

function lire(cle) {
  try { return localStorage.getItem(cle) } catch { return null }
}
function ecrire(cle, valeur) {
  try { localStorage.setItem(cle, valeur) } catch { /* stockage indisponible */ }
}

export function bandeauMasque() {
  if (lire(CLE_MASQUE) === '1' || lire(CLE_INSTALLEE) === '1') return true
  const report = Number(lire(CLE_REPORT) || 0)
  return report > Date.now()
}

// Croix : on le cache jusqu'a demain
export function reporterBandeau() {
  ecrire(CLE_REPORT, String(Date.now() + UN_JOUR))
}

// « Ne plus afficher » : definitif sur cet appareil
export function masquerBandeau() {
  ecrire(CLE_MASQUE, '1')
}

export function noterInstallee() {
  ecrire(CLE_INSTALLEE, '1')
}
