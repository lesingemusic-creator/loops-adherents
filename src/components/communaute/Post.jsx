import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EMOJIS, heure, morceaux, nomAffiche, urlFichier } from '../../lib/communaute'
import { Avatar, Fichier, Integration } from './Message.jsx'

/**
 * Une publication du Flow (DA 1 choisie le 26/09/2026) :
 * carte, extrait audio avec onde, reactions qui eclatent, fil en panneau.
 */

const LIBELLES = {
  annonces: 'Annonce', regles: 'Règles', general: 'Général', showcase: 'Showcase',
  'feedback-mix': 'Feedback mix', ressources: 'Ressources', 'contenu-exclusif': 'Exclu',
}

// Onde decorative, stable pour un meme message
function barres(id, n = 54) {
  let s = 0
  for (const c of id) s = (s * 31 + c.charCodeAt(0)) >>> 0
  return Array.from({ length: n }, (_, i) => {
    s = (s * 1103515245 + 12345) >>> 0
    const bruit = (s % 1000) / 1000
    return Math.min(100, 18 + Math.abs(Math.sin(i * 0.55 + (s % 7))) * 60 + bruit * 22)
  })
}

export function Audio({ m, surEcoute }) {
  const [url, setUrl] = useState(null)
  const [lecture, setLecture] = useState(false)
  const [prog, setProg] = useState(0)
  const [duree, setDuree] = useState(null)
  const son = useRef(null)
  const compte = useRef(false)
  const b = useMemo(() => barres(m.id), [m.id])

  useEffect(() => {
    let vivant = true
    urlFichier(m.fichier_chemin).then((u) => { if (vivant) setUrl(u) })
    return () => { vivant = false }
  }, [m.fichier_chemin])

  function basculer() {
    const a = son.current
    if (!a) return
    if (a.paused) {
      a.play()
      if (!compte.current) { compte.current = true; surEcoute?.(m) }
    } else a.pause()
  }

  function chercher(e) {
    const a = son.current
    if (!a || !a.duration) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration
  }

  const mmss = (s) => (s == null || !isFinite(s) ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)

  return (
    <div className={`fl-audio ${lecture ? 'is-lecture' : ''}`}>
      <div className="fl-audio-corps">
        <button type="button" className="fl-play" onClick={basculer} disabled={!url} aria-label={lecture ? 'Pause' : 'Écouter'}>
          {lecture
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>}
        </button>
        <div className="fl-onde" onClick={chercher} role="presentation">
          {b.map((h, i) => (
            <i key={i} style={{ height: h + '%', animationDelay: (i % 9) * 0.06 + 's' }}
              className={i / b.length < prog ? 'lu' : ''} />
          ))}
        </div>
      </div>
      <div className="fl-audio-info">
        <span><b>{m.fichier_nom}</b>{duree ? ' · ' + mmss(duree) : ''}</span>
        <span>▶ {m.nb_ecoutes || 0} écoute{(m.nb_ecoutes || 0) > 1 ? 's' : ''}</span>
      </div>
      {url && (
        <audio ref={son} src={url} preload="metadata"
          onPlay={() => setLecture(true)} onPause={() => setLecture(false)} onEnded={() => { setLecture(false); setProg(1) }}
          onLoadedMetadata={(e) => setDuree(e.currentTarget.duration)}
          onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration) setProg(a.currentTime / a.duration) }} />
      )}
    </div>
  )
}

export function Texte({ contenu, membres }) {
  if (!contenu) return null
  return (
    <p className="fl-texte">
      {morceaux(contenu, membres).map((p, i) => {
        if (p.t === 'lien') return <a key={i} href={p.v} target="_blank" rel="noopener noreferrer">{p.v}</a>
        if (p.t === 'mention') return <span key={i} className="fl-mention">{p.v}</span>
        return <span key={i}>{p.v}</span>
      })}
    </p>
  )
}

export function Reactions({ m, reactions, moi, membres, onReagir, children }) {
  const [palette, setPalette] = useState(false)
  const parEmoji = {}
  ;(reactions || []).forEach((r) => {
    parEmoji[r.emoji] = parEmoji[r.emoji] || { n: 0, moi: false, qui: [] }
    parEmoji[r.emoji].n++
    parEmoji[r.emoji].qui.push(nomAffiche(membres[r.user_id]))
    if (r.user_id === moi) parEmoji[r.emoji].moi = true
  })

  function clic(e, emoji, dejaMis) {
    if (!dejaMis) eclater(e.currentTarget, emoji)
    onReagir(m, emoji, dejaMis)
  }

  return (
    <div className="fl-barre">
      {Object.entries(parEmoji).map(([emoji, r]) => (
        <button key={emoji} type="button" className={`fl-reac ${r.moi ? 'is-moi' : ''}`} title={r.qui.join(', ')}
          onClick={(e) => clic(e, emoji, r.moi)}>
          {emoji} <span>{r.n}</span>
        </button>
      ))}
      <div className="fl-reac-ajout">
        <button type="button" className="fl-reac fl-reac--plus" aria-label="Réagir" onClick={() => setPalette(!palette)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          +
        </button>
        {palette && (
          <div className="fl-palette" onMouseLeave={() => setPalette(false)}>
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={(ev) => { clic(ev, e, !!parEmoji[e]?.moi); setPalette(false) }}>{e}</button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function eclater(el, emoji) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = el.getBoundingClientRect()
  for (let k = 0; k < 6; k++) {
    const s = document.createElement('span')
    s.className = 'fl-eclat'
    s.textContent = emoji
    s.style.left = r.left + r.width / 2 - 10 + 'px'
    s.style.top = r.top + 'px'
    s.style.setProperty('--x', (Math.random() * 80 - 40) + 'px')
    s.style.setProperty('--y', (-30 - Math.random() * 50) + 'px')
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 800)
  }
}

export default function Post({
  m, membres, moi, admin, reactions, salon, onReagir, onFil, onModifier, onSupprimer, onEpingler, onSignaler, onEcoute,
}) {
  const auteur = membres[m.auteur_id]
  const [menu, setMenu] = useState(false)
  const [edition, setEdition] = useState(null)
  const estMoi = m.auteur_id === moi
  const annonce = salon?.ecriture === 'moderateurs' && auteur?.moderateur
  const audio = m.fichier_type?.startsWith('audio/')

  if (m.supprime_le) {
    return <article className="fl-post fl-post--supprime"><em>Publication supprimée</em></article>
  }

  async function valider(e) {
    e.preventDefault()
    const t = edition.trim()
    if (t && t !== m.contenu) await onModifier(m, t)
    setEdition(null)
  }

  // Avatars des derniers a avoir repondu : on n'a que le compteur, on affiche des pastilles neutres.
  const pastilles = Math.min(3, m.nb_reponses || 0)

  return (
    <article className={`fl-post ${annonce ? 'fl-post--annonce' : ''} ${m.epingle ? 'fl-post--epingle' : ''}`}>
      <header className="fl-post-tete">
        <Avatar membre={auteur} taille={42} />
        <div className="fl-post-qui">
          <div className="fl-nom">
            {nomAffiche(auteur)}
            {salon && <span className={`fl-pill ${annonce ? 'fl-pill--jaune' : ''}`}>{annonce ? 'Annonce' : (LIBELLES[salon.slug] || salon.nom)}</span>}
            {m.epingle && <span className="fl-pill fl-pill--jaune">Épinglé</span>}
          </div>
          <div className="fl-meta">{heure(m.created_at)}{m.modifie_le ? ' · modifié' : ''}</div>
        </div>
        <div className="fl-menu-zone">
          <button type="button" className="fl-plus" aria-label="Plus d'actions" onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <div className="fl-menu" onMouseLeave={() => setMenu(false)}>
              {estMoi && <button type="button" onClick={() => { setEdition(m.contenu); setMenu(false) }}>Modifier</button>}
              {admin && <button type="button" onClick={() => { onEpingler(m); setMenu(false) }}>{m.epingle ? 'Désépingler' : 'Épingler'}</button>}
              {(estMoi || admin) && <button type="button" className="is-danger" onClick={() => { setMenu(false); onSupprimer(m) }}>Supprimer</button>}
              {!estMoi && <button type="button" onClick={() => { setMenu(false); onSignaler(m) }}>Signaler à Jérôme</button>}
            </div>
          )}
        </div>
      </header>

      {edition !== null ? (
        <form className="fl-edition" onSubmit={valider}>
          <textarea value={edition} rows={3} autoFocus onChange={(e) => setEdition(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEdition(null) }} />
          <div><button type="submit">Enregistrer</button><button type="button" onClick={() => setEdition(null)}>Annuler</button></div>
        </form>
      ) : (
        annonce && m.contenu
          ? <AnnonceTexte contenu={m.contenu} membres={membres} />
          : <Texte contenu={m.contenu} membres={membres} />
      )}

      <Integration texte={m.contenu} />
      {audio ? <Audio m={m} surEcoute={onEcoute} /> : <Fichier m={m} />}

      <Reactions m={m} reactions={reactions} moi={moi} membres={membres} onReagir={onReagir}>
        <button type="button" className="fl-fil" onClick={() => onFil(m)}>
          {pastilles > 0 && <span className="fl-avs">{Array.from({ length: pastilles }, (_, i) => <span key={i} />)}</span>}
          {m.nb_reponses > 0 ? `${m.nb_reponses} réponse${m.nb_reponses > 1 ? 's' : ''}` : 'Répondre'}
        </button>
      </Reactions>
    </article>
  )
}

// Annonce : la premiere ligne devient le titre.
function AnnonceTexte({ contenu, membres }) {
  const [titre, ...reste] = contenu.split('\n')
  return (
    <>
      <h3 className="fl-titre">{titre}</h3>
      {reste.join('\n').trim() && <Texte contenu={reste.join('\n').trim()} membres={membres} />}
    </>
  )
}

export async function enregistrerEcoute(id) {
  const { data } = await supabase.rpc('comm_ecouter', { p_id: id })
  return data
}
