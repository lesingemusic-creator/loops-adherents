import { useRef, useState } from 'react'
import { deposerFichier, nomAffiche, tailleLisible, TAILLE_MAX_MO } from '../../lib/communaute'
import { Avatar } from './Message.jsx'

/**
 * Zone de saisie : Entree envoie, Maj+Entree passe a la ligne,
 * @ propose les membres, trombone pour un audio, une image ou un PDF.
 */
export default function Composer({ placeholder, membres, moi, onEnvoyer, desactive, messageDesactive }) {
  const [texte, setTexte] = useState('')
  const [fichier, setFichier] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [suggestion, setSuggestion] = useState(null) // { debut, requete }
  const [choix, setChoix] = useState(0)
  const mentions = useRef(new Map())
  const zone = useRef(null)
  const inputFichier = useRef(null)

  if (desactive) {
    return <div className="cm-composer cm-composer--off">{messageDesactive}</div>
  }

  const candidats = suggestion
    ? Object.values(membres)
        .filter((m) => m.id !== moi && nomAffiche(m).toLowerCase().includes(suggestion.requete.toLowerCase()))
        .slice(0, 6)
    : []

  function surSaisie(e) {
    const v = e.target.value
    setTexte(v)
    const pos = e.target.selectionStart
    const avant = v.slice(0, pos)
    const m = avant.match(/(^|\s)@([^\s@]{0,30})$/)
    if (m) {
      setSuggestion({ debut: pos - m[2].length - 1, requete: m[2] })
      setChoix(0)
    } else {
      setSuggestion(null)
    }
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  function inserer(membre) {
    const nom = nomAffiche(membre)
    const fin = zone.current.selectionStart
    const nouveau = texte.slice(0, suggestion.debut) + '@' + nom + ' ' + texte.slice(fin)
    mentions.current.set(nom, membre.id)
    setTexte(nouveau)
    setSuggestion(null)
    requestAnimationFrame(() => {
      const p = suggestion.debut + nom.length + 2
      zone.current.focus()
      zone.current.setSelectionRange(p, p)
    })
  }

  async function envoyer() {
    const t = texte.trim()
    if ((!t && !fichier) || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      let pj = {}
      if (fichier) pj = await deposerFichier(moi, fichier)
      const ids = [...mentions.current.entries()].filter(([nom]) => t.includes('@' + nom)).map(([, id]) => id)
      await onEnvoyer({ contenu: t, mentions: [...new Set(ids)], ...pj })
      setTexte('')
      setFichier(null)
      mentions.current.clear()
      if (zone.current) zone.current.style.height = 'auto'
    } catch (err) {
      setErreur(err.message)
    }
    setEnvoi(false)
  }

  function surTouche(e) {
    if (suggestion && candidats.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setChoix((c) => (c + 1) % candidats.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setChoix((c) => (c - 1 + candidats.length) % candidats.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); inserer(candidats[choix]); return }
      if (e.key === 'Escape') { setSuggestion(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      envoyer()
    }
  }

  function choisirFichier(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > TAILLE_MAX_MO * 1024 * 1024) {
      setErreur(`Fichier trop lourd : ${TAILLE_MAX_MO} Mo maximum. Pour un mix complet, colle plutôt ton lien SoundCloud.`)
      return
    }
    setErreur(null)
    setFichier(f)
  }

  return (
    <div className="cm-composer">
      {suggestion && candidats.length > 0 && (
        <ul className="cm-suggestions" role="listbox">
          {candidats.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === choix}
              className={i === choix ? 'is-actif' : ''}
              onMouseDown={(e) => { e.preventDefault(); inserer(m) }}>
              <Avatar membre={m} taille={24} /> {nomAffiche(m)}
              {m.moderateur && <span className="cm-badge">Équipe</span>}
            </li>
          ))}
        </ul>
      )}

      {fichier && (
        <div className="cm-pj">
          <span>{fichier.name}</span> <small>{tailleLisible(fichier.size)}</small>
          <button type="button" aria-label="Retirer le fichier" onClick={() => setFichier(null)}>×</button>
        </div>
      )}
      {erreur && <p className="cm-erreur">{erreur}</p>}

      <div className="cm-composer-ligne">
        <button type="button" className="cm-trombone" aria-label="Joindre un audio, une image ou un PDF"
          title="Joindre un audio, une image ou un PDF (25 Mo max)" onClick={() => inputFichier.current.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input ref={inputFichier} type="file" hidden accept="audio/*,image/*,application/pdf" onChange={choisirFichier} />
        <textarea
          ref={zone}
          rows={1}
          value={texte}
          placeholder={placeholder}
          onChange={surSaisie}
          onKeyDown={surTouche}
          maxLength={4000}
          aria-label={placeholder}
        />
        <button type="button" className="cm-envoyer" onClick={envoyer} disabled={envoi || (!texte.trim() && !fichier)} aria-label="Envoyer">
          {envoi ? '…' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          )}
        </button>
      </div>
    </div>
  )
}
