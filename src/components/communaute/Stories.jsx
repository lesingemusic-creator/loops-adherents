import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { heure, nomAffiche } from '../../lib/communaute'
import { Avatar, Fichier, Integration } from './Message.jsx'
import { Audio, Texte } from './Post.jsx'

/**
 * Stories du Flow : les annonces de Jerome des 14 derniers jours.
 * Anneau colore tant que l'eleve ne l'a pas ouverte. Visionneuse plein
 * ecran avec barres de progression, avance seule toutes les 7 s.
 * Comme sur Instagram : tap a droite = suivante, tap sur le tiers gauche =
 * precedente, appui long = pause, glisser a gauche ou a droite = changer,
 * glisser vers le bas = fermer.
 */

// Elements qui gardent leur propre clic (liens, lecteur audio, integrations)
const INTERACTIF = 'a, button, input, textarea, audio, video, iframe, .fl-audio-corps, .fl-play, .fl-onde'

const DUREE = 7000
const LIBELLE = { annonces: 'Annonce', regles: 'Règles', 'contenu-exclusif': 'Exclu' }

export default function Stories({ stories, membres, admin, onVu, onNouvelle }) {
  const [ouverte, setOuverte] = useState(null) // index
  const [prog, setProg] = useState(0)
  const [pause, setPause] = useState(false)
  const debut = useRef(0)
  const cumul = useRef(0)
  const appui = useRef(null)

  const s = ouverte !== null ? stories[ouverte] : null

  useEffect(() => {
    if (!s) return
    if (!s.vue) { supabase.rpc('comm_vu', { p_id: s.id }); onVu(s.id) }
    setProg(0)
    cumul.current = 0
    debut.current = performance.now()
  }, [ouverte]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s || pause) return
    debut.current = performance.now()
    let raf
    const tic = (t) => {
      const p = (cumul.current + (t - debut.current)) / DUREE
      if (p >= 1) { suivante(); return }
      setProg(p)
      raf = requestAnimationFrame(tic)
    }
    raf = requestAnimationFrame(tic)
    return () => {
      cancelAnimationFrame(raf)
      cumul.current += performance.now() - debut.current
    }
  }, [ouverte, pause]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ouverte === null) return
    const k = (e) => {
      if (e.key === 'Escape') setOuverte(null)
      if (e.key === 'ArrowRight') suivante()
      if (e.key === 'ArrowLeft') precedente()
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [ouverte]) // eslint-disable-line react-hooks/exhaustive-deps

  function suivante() {
    setOuverte((i) => (i === null || i >= stories.length - 1 ? null : i + 1))
  }
  function precedente() {
    setOuverte((i) => (i > 0 ? i - 1 : i))
  }

  function poser(e) {
    if (e.target.closest(INTERACTIF)) return
    appui.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    setPause(true)
  }
  function lever(e) {
    const a = appui.current
    appui.current = null
    setPause(false)
    if (!a) return
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    if (dy > 90 && Math.abs(dx) < 70) { setOuverte(null); return }       // vers le bas : fermer
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {              // glisser
      if (dx < 0) suivante(); else precedente()
      return
    }
    if (performance.now() - a.t > 350) return                             // appui long : juste une pause
    if (a.x < window.innerWidth / 3) precedente(); else suivante()
  }
  function annuler() {
    appui.current = null
    setPause(false)
  }

  if (!stories.length && !admin) return null

  return (
    <>
      <div className="fl-stories" aria-label="Annonces de Jérôme">
        {admin && (
          <button type="button" className="fl-story fl-story--ajout" onClick={onNouvelle}>
            <span className="fl-anneau"><span className="fl-anneau-in">+</span></span>
            <span className="fl-story-t">Publier</span>
          </button>
        )}
        {stories.map((st, i) => (
          <button key={st.id} type="button" className={`fl-story ${st.vue ? 'is-vue' : ''}`} onClick={() => setOuverte(i)}>
            <span className="fl-anneau">
              <span className="fl-anneau-in"><Avatar membre={membres[st.auteur_id]} taille={58} /></span>
            </span>
            <span className="fl-story-t">{(st.contenu || LIBELLE[st.salon] || 'Annonce').split('\n')[0].slice(0, 26)}</span>
          </button>
        ))}
      </div>

      {s && (
        <div className="fl-visio" role="dialog" aria-modal="true" aria-label="Annonce de Jérôme"
          onPointerDown={poser} onPointerUp={lever} onPointerCancel={annuler}
          onContextMenu={(e) => e.preventDefault()}>
          <div className="fl-visio-barres">
            {stories.map((x, i) => (
              <span key={x.id}><i style={{ transform: `scaleX(${i < ouverte ? 1 : i === ouverte ? prog : 0})` }} /></span>
            ))}
          </div>
          <header className="fl-visio-tete">
            <Avatar membre={membres[s.auteur_id]} taille={36} />
            <div><b>{nomAffiche(membres[s.auteur_id])}</b><small>{LIBELLE[s.salon] || 'Annonce'} · {heure(s.created_at)}</small></div>
            <button type="button" className="fl-visio-fermer" aria-label="Fermer" onClick={(e) => { e.stopPropagation(); setOuverte(null) }}>×</button>
          </header>
          <div className="fl-visio-corps">
            {s.contenu && (() => {
              const [titre, ...reste] = s.contenu.split('\n')
              return (<>
                <h2>{titre}</h2>
                {reste.join('\n').trim() && <Texte contenu={reste.join('\n').trim()} membres={membres} />}
              </>)
            })()}
            <Integration texte={s.contenu} />
            {s.fichier_chemin && (s.fichier_type?.startsWith('audio/')
              ? <Audio m={{ ...s, fichier_nom: 'Extrait', nb_ecoutes: 0 }} />
              : <Fichier m={s} />)}
          </div>
          {/* Pour le clavier et les lecteurs d'ecran ; au doigt, tout l'ecran reagit */}
          <button type="button" className="fl-visio-zone fl-visio-zone--g" aria-label="Story précédente" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={precedente} />
          <button type="button" className="fl-visio-zone fl-visio-zone--d" aria-label="Story suivante" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={suivante} />
        </div>
      )}
    </>
  )
}
