import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, FAQ, chercher } from '../lib/faq'
import { lancerTutoriel } from '../lib/tutoriel'
import { WHATSAPP_JEROME } from '../lib/formules'
import '../styles/aide.css'

function Reponse({ f, ouvert }) {
  return (
    <details className="aide-item" open={ouvert}>
      <summary>
        <span>{f.q}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </summary>
      <div className="aide-reponse">
        <p>{f.r}</p>
        {f.lien && <Link to={f.lien.to} className="aide-lien">{f.lien.label} →</Link>}
        {f.action === 'tuto' && (
          <button type="button" className="aide-lien" onClick={lancerTutoriel}>Revoir le tutoriel →</button>
        )}
      </div>
    </details>
  )
}

export default function Aide() {
  const [question, setQuestion] = useState('')
  const q = question.trim()
  const resultats = useMemo(() => (q ? chercher(q) : []), [q])
  const whatsapp = `https://wa.me/${WHATSAPP_JEROME}?text=${encodeURIComponent(
    `Salut Jérôme ! J'ai une question sur le Backstage : ${q || ''}`.trim()
  )}`

  return (
    <div className="container aide">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Aide</p>
        <h1 className="app-page-title">Une question ?</h1>
        <p className="app-page-subtitle">Écris-la avec tes mots, on cherche la réponse pour toi.</p>
      </header>

      <form className="aide-recherche" role="search" onSubmit={(e) => e.preventDefault()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <label htmlFor="aide-q" className="sr-only">Pose ta question</label>
        <input
          id="aide-q"
          type="search"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex : comment je poste mon mix ?"
          autoComplete="off"
          enterKeyHint="search"
        />
        {question && (
          <button type="button" className="aide-effacer" aria-label="Effacer la question" onClick={() => setQuestion('')}>×</button>
        )}
      </form>

      {q ? (
        <section className="aide-resultats" aria-live="polite">
          {resultats.length > 0 ? (
            <>
              <p className="aide-compte">{resultats.length === 1 ? 'Une réponse trouvée' : `${resultats.length} réponses trouvées`}</p>
              {resultats.map((f, n) => <Reponse key={f.q} f={f} ouvert={n === 0} />)}
            </>
          ) : (
            <p className="aide-compte">Pas de réponse toute prête à cette question.</p>
          )}
        </section>
      ) : (
        <>
          <button type="button" className="aide-tuto" onClick={lancerTutoriel}>
            <span className="aide-tuto-icone" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </span>
            <span>
              <strong>Revoir le tutoriel</strong>
              <small>La visite guidée du Backstage, en 30 secondes.</small>
            </span>
          </button>

          {CATEGORIES.map((c) => (
            <section key={c.id} className="aide-categorie">
              <h2>{c.titre}</h2>
              {FAQ.filter((f) => f.cat === c.id).map((f) => <Reponse key={f.q} f={f} />)}
            </section>
          ))}
        </>
      )}

      <aside className="aide-contact">
        <h2>Tu n'as pas trouvé ?</h2>
        <p>Pose ta question directement à Jérôme, il te répond vite.</p>
        <div className="aide-contact-actions">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary">Écrire à Jérôme sur WhatsApp</a>
          <Link to="/communaute" className="aide-secondaire">Demander à la Communauté</Link>
        </div>
      </aside>
    </div>
  )
}
