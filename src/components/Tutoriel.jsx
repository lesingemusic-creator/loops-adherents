import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ETAPES, marquerTutoVu, tutoVu } from '../lib/tutoriel'
import '../styles/tutoriel.css'

/**
 * Visite guidee : un projecteur sur le bouton, une bulle qui l'explique.
 * Se lance seule a la premiere ouverture (sur le Dashboard), puis a la
 * demande depuis la page Aide (evenement « lp-tuto »).
 */

const MARGE = 8      // espace autour de l'element eclaire
const BORD = 16      // gouttiere minimale au bord de l'ecran

function trouver(cible) {
  if (!cible) return null
  const el = document.querySelector(`[data-tuto="${cible}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export default function Tutoriel({ uid }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [etapes, setEtapes] = useState(null)   // null = ferme
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [bulle, setBulle] = useState({ top: 0, left: 0, dessous: true, fleche: 0 })
  const bulleRef = useRef(null)
  const suivantRef = useRef(null)

  const demarrer = useCallback(() => {
    // Les etapes sans cible visible sont sautees
    const dispo = ETAPES.filter((e) => !e.cible || trouver(e.cible))
    setI(0)
    setEtapes(dispo)
  }, [])

  const fermer = useCallback(() => {
    marquerTutoVu(uid)
    setEtapes(null)
    setRect(null)
  }, [uid])

  // Premiere ouverture : on laisse la page se poser avant de lancer
  useEffect(() => {
    if (!uid || etapes || tutoVu(uid) || location.pathname !== '/dashboard') return
    const t = setTimeout(demarrer, 700)
    return () => clearTimeout(t)
  }, [uid, location.pathname, etapes, demarrer])

  // Relance depuis la page Aide
  useEffect(() => {
    function relancer() {
      if (location.pathname !== '/dashboard') navigate('/dashboard')
      setTimeout(demarrer, 500)
    }
    window.addEventListener('lp-tuto', relancer)
    return () => window.removeEventListener('lp-tuto', relancer)
  }, [location.pathname, navigate, demarrer])

  const etape = etapes?.[i]

  // Amene la cible dans l'ecran (le menu defile a l'horizontale sur mobile)
  useEffect(() => {
    if (!etape?.cible) return
    const el = trouver(etape.cible)
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
  }, [etape])

  // Suit la cible a chaque image : defilement, rotation, clavier virtuel.
  // Les minuteries rattrapent le cas ou les images sont en pause.
  useEffect(() => {
    if (!etape) return
    let raf
    const mesurer = () => {
      const el = trouver(etape.cible)
      const r = el?.getBoundingClientRect()
      setRect((avant) => {
        if (!r) return null
        if (avant && avant.top === r.top && avant.left === r.left && avant.width === r.width && avant.height === r.height) return avant
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      })
    }
    const suivre = () => { mesurer(); raf = requestAnimationFrame(suivre) }
    suivre()
    const minuteries = [150, 400, 800].map((ms) => setTimeout(mesurer, ms))
    window.addEventListener('resize', mesurer)
    window.addEventListener('scroll', mesurer, true)
    return () => {
      cancelAnimationFrame(raf)
      minuteries.forEach(clearTimeout)
      window.removeEventListener('resize', mesurer)
      window.removeEventListener('scroll', mesurer, true)
    }
  }, [etape])

  // Place la bulle sous la cible, ou au-dessus si la place manque
  useLayoutEffect(() => {
    if (!etape || !bulleRef.current) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const b = bulleRef.current.getBoundingClientRect()
    if (!rect) {
      setBulle({ top: Math.max(BORD, (vh - b.height) / 2), left: Math.max(BORD, (vw - b.width) / 2), dessous: true, fleche: null })
      return
    }
    const bas = rect.top + rect.height + MARGE + 14
    const dessous = bas + b.height < vh - BORD || rect.top - MARGE - 14 - b.height < BORD
    const top = dessous ? bas : rect.top - MARGE - 14 - b.height
    const centre = rect.left + rect.width / 2
    const left = Math.min(Math.max(BORD, centre - b.width / 2), vw - BORD - b.width)
    setBulle({ top, left, dessous, fleche: Math.min(Math.max(20, centre - left), b.width - 20) })
  }, [rect, etape])

  useEffect(() => { if (etape) suivantRef.current?.focus() }, [etape])

  const suivant = useCallback(() => {
    if (!etapes) return
    if (i >= etapes.length - 1) fermer()
    else setI(i + 1)
  }, [etapes, i, fermer])
  const precedent = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    if (!etape) return
    function clavier(e) {
      if (e.key === 'Escape') fermer()
      else if (e.key === 'ArrowRight') suivant()
      else if (e.key === 'ArrowLeft') precedent()
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [etape, fermer, suivant, precedent])

  if (!etape) return null
  const derniere = i === etapes.length - 1

  return (
    <div className="tuto" role="dialog" aria-modal="true" aria-labelledby="tuto-titre" aria-describedby="tuto-texte">
      {/* Bloque les clics sur la page pendant la visite */}
      <div className={`tuto-voile${rect ? '' : ' is-plein'}`} />
      {rect && (
        <div
          className="tuto-projecteur"
          style={{ top: rect.top - MARGE, left: rect.left - MARGE, width: rect.width + MARGE * 2, height: rect.height + MARGE * 2 }}
        />
      )}
      <div
        ref={bulleRef}
        className={`tuto-bulle${bulle.dessous ? ' is-dessous' : ' is-dessus'}`}
        style={{ top: bulle.top, left: bulle.left, '--fleche': bulle.fleche === null ? undefined : `${bulle.fleche}px` }}
        data-fleche={bulle.fleche === null ? 'non' : 'oui'}
      >
        <p className="tuto-compteur">{i + 1} / {etapes.length}</p>
        <h2 id="tuto-titre" className="tuto-titre">{etape.titre}</h2>
        <p id="tuto-texte" className="tuto-texte" aria-live="polite">{etape.texte}</p>
        <div className="tuto-points" aria-hidden="true">
          {etapes.map((_, n) => <span key={n} className={n === i ? 'is-actif' : ''} />)}
        </div>
        <div className="tuto-actions">
          <button type="button" className="tuto-passer" onClick={fermer}>
            {derniere ? 'Fermer' : 'Passer'}
          </button>
          <div className="tuto-nav">
            {i > 0 && <button type="button" className="tuto-prec" onClick={precedent}>Retour</button>}
            <button type="button" ref={suivantRef} className="tuto-suiv" onClick={suivant}>
              {derniere ? "C'est parti" : i === 0 ? 'On y va' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
