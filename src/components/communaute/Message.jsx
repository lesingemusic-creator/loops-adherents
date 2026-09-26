import { useEffect, useState } from 'react'
import {
  EMOJIS, heure, morceaux, nomAffiche, premierLienIntegrable, tailleLisible, urlFichier,
} from '../../lib/communaute'

function Avatar({ membre, taille = 38 }) {
  const nom = nomAffiche(membre)
  return (
    <div className="cm-avatar" style={{ width: taille, height: taille }} aria-hidden="true">
      {membre?.photo_url ? <img src={membre.photo_url} alt="" /> : <span>{nom.charAt(0).toUpperCase()}</span>}
    </div>
  )
}
export { Avatar }

function Fichier({ m }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let vivant = true
    urlFichier(m.fichier_chemin).then((u) => { if (vivant) setUrl(u) })
    return () => { vivant = false }
  }, [m.fichier_chemin])

  if (!m.fichier_chemin) return null
  const type = m.fichier_type || ''
  if (type.startsWith('image/')) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="cm-image">
        <img src={url} alt={m.fichier_nom || 'Image'} loading="lazy" />
      </a>
    ) : <div className="cm-image cm-image--chargement" />
  }
  if (type.startsWith('audio/')) {
    return (
      <div className="cm-audio">
        <div className="cm-audio-titre">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <span>{m.fichier_nom}</span>
          <small>{tailleLisible(m.fichier_taille)}</small>
        </div>
        {url && <audio controls preload="none" src={url} />}
      </div>
    )
  }
  return (
    <a className="cm-doc" href={url || '#'} target="_blank" rel="noopener noreferrer">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>{m.fichier_nom}</span>
      <small>{tailleLisible(m.fichier_taille)}</small>
    </a>
  )
}

function Integration({ texte }) {
  const e = premierLienIntegrable(texte)
  if (!e) return null
  const h = e.type === 'soundcloud' ? 166 : e.type === 'spotify' ? 152 : undefined
  return (
    <div className={`cm-embed cm-embed--${e.type}`}>
      <iframe
        src={e.src}
        title={e.type}
        height={h}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

export default function Message({
  m, membres, moi, admin, reactions, continuation,
  onReagir, onRepondre, onModifier, onSupprimer, onEpingler, onSignaler, dansFil,
}) {
  const auteur = membres[m.auteur_id]
  const estMoi = m.auteur_id === moi
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const [edition, setEdition] = useState(null)

  const parEmoji = {}
  ;(reactions || []).forEach((r) => {
    parEmoji[r.emoji] = parEmoji[r.emoji] || { n: 0, moi: false, qui: [] }
    parEmoji[r.emoji].n++
    parEmoji[r.emoji].qui.push(nomAffiche(membres[r.user_id]))
    if (r.user_id === moi) parEmoji[r.emoji].moi = true
  })

  if (m.supprime_le) {
    return (
      <div className={`cm-msg cm-msg--supprime ${continuation ? 'cm-msg--suite' : ''}`}>
        <div className="cm-msg-gouttiere" />
        <div className="cm-msg-corps"><em>Message supprimé</em></div>
      </div>
    )
  }

  async function validerEdition(e) {
    e.preventDefault()
    const t = edition.trim()
    if (t && t !== m.contenu) await onModifier(m, t)
    setEdition(null)
  }

  return (
    <div className={`cm-msg ${continuation ? 'cm-msg--suite' : ''} ${m.epingle ? 'cm-msg--epingle' : ''}`}
      onMouseLeave={() => { setMenu(false); setPalette(false) }}>
      <div className="cm-msg-gouttiere">
        {continuation ? <span className="cm-msg-heure-mini">{heure(m.created_at).slice(-5)}</span> : <Avatar membre={auteur} />}
      </div>

      <div className="cm-msg-corps">
        {!continuation && (
          <div className="cm-msg-entete">
            <strong className={auteur?.moderateur ? 'cm-nom cm-nom--modo' : 'cm-nom'}>{nomAffiche(auteur)}</strong>
            {auteur?.moderateur && <span className="cm-badge">Équipe</span>}
            <span className="cm-msg-heure">{heure(m.created_at)}</span>
            {m.epingle && <span className="cm-badge cm-badge--epingle">Épinglé</span>}
          </div>
        )}

        {edition !== null ? (
          <form className="cm-edition" onSubmit={validerEdition}>
            <textarea value={edition} onChange={(e) => setEdition(e.target.value)} autoFocus rows={3}
              onKeyDown={(e) => { if (e.key === 'Escape') setEdition(null); if (e.key === 'Enter' && !e.shiftKey) validerEdition(e) }} />
            <div><button type="submit" className="cm-lien">Enregistrer</button> · <button type="button" className="cm-lien" onClick={() => setEdition(null)}>Annuler</button></div>
          </form>
        ) : (
          m.contenu && (
            <div className="cm-texte">
              {morceaux(m.contenu, membres).map((p, i) => {
                if (p.t === 'lien') return <a key={i} href={p.v} target="_blank" rel="noopener noreferrer">{p.v}</a>
                if (p.t === 'mention') return <span key={i} className="cm-mention">{p.v}</span>
                return <span key={i}>{p.v}</span>
              })}
              {m.modifie_le && <span className="cm-modifie"> (modifié)</span>}
            </div>
          )
        )}

        <Integration texte={m.contenu} />
        <Fichier m={m} />

        {(Object.keys(parEmoji).length > 0) && (
          <div className="cm-reactions">
            {Object.entries(parEmoji).map(([emoji, r]) => (
              <button key={emoji} type="button" className={`cm-reaction ${r.moi ? 'is-moi' : ''}`}
                title={r.qui.join(', ')} onClick={() => onReagir(m, emoji, r.moi)}>
                {emoji} <span>{r.n}</span>
              </button>
            ))}
          </div>
        )}

        {!dansFil && m.nb_reponses > 0 && (
          <button type="button" className="cm-fil-lien" onClick={() => onRepondre(m)}>
            {m.nb_reponses} réponse{m.nb_reponses > 1 ? 's' : ''} <span>· voir le fil</span>
          </button>
        )}
      </div>

      <div className={`cm-actions ${menu || palette ? 'is-ouvert' : ''}`}>
        <button type="button" title="Réagir" aria-label="Réagir" onClick={() => { setPalette(!palette); setMenu(false) }}>☺</button>
        {!dansFil && <button type="button" title="Répondre en fil" aria-label="Répondre en fil" onClick={() => onRepondre(m)}>↩</button>}
        <button type="button" title="Plus" aria-label="Plus d'actions" onClick={() => { setMenu(!menu); setPalette(false) }}>⋯</button>

        {palette && (
          <div className="cm-palette">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => { onReagir(m, e, !!parEmoji[e]?.moi); setPalette(false) }}>{e}</button>
            ))}
          </div>
        )}

        {menu && (
          <div className="cm-menu">
            {estMoi && <button type="button" onClick={() => { setEdition(m.contenu); setMenu(false) }}>Modifier</button>}
            {admin && m.salon_id && !dansFil && (
              <button type="button" onClick={() => { onEpingler(m); setMenu(false) }}>{m.epingle ? 'Désépingler' : 'Épingler'}</button>
            )}
            {(estMoi || admin) && (
              <button type="button" className="is-danger" onClick={() => { setMenu(false); onSupprimer(m) }}>Supprimer</button>
            )}
            {!estMoi && <button type="button" onClick={() => { setMenu(false); onSignaler(m) }}>Signaler à Jérôme</button>}
          </div>
        )}
      </div>
    </div>
  )
}
