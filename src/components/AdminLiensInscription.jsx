import { useState } from 'react'

// Liens d'inscription par pack (demande de Jerome, 10/11/2026).
// Chaque lien ouvre la fiche d'inscription privee avec la formule deja choisie,
// puis l'eleve passe au paiement Stripe. Jamais le lien Stripe seul : c'est la
// fiche qui cree la ligne d'inscription utilisee pour creer le compte.
// Les prix ne servent qu'a l'affichage ; ils vivent dans inscription.js et le PHP.
const PAGE = 'https://loopsplay.com/inscription-k7m3q9'

const LIENS = [
  { id: 'pack1-dj', label: 'Pack 1, DJ', detail: '12h, 449 €, en 1, 2 ou 4 fois', formule: 'pack1', discipline: 'dj' },
  { id: 'pack1-mao', label: 'Pack 1, MAO', detail: '12h, 449 €, en 1, 2 ou 4 fois', formule: 'pack1', discipline: 'mao' },
  { id: 'pack2-dj', label: 'Pack 2, DJ', detail: '24h, 849 €, en 1, 2 ou 4 fois', formule: 'pack2', discipline: 'dj' },
  { id: 'pack2-mao', label: 'Pack 2, MAO', detail: '24h, 849 €, en 1, 2 ou 4 fois', formule: 'pack2', discipline: 'mao' },
  { id: 'pack3', label: 'Pack 3, Artist Starter', detail: '30h Mix et MAO, 1 490 €, en 1, 2 ou 4 fois', formule: 'pack3' },
  { id: 'annee-dj', label: 'Mix Année', detail: '34h + 10 séances libres, 1 349 €, en 1, 2 ou 4 fois', formule: 'annee', discipline: 'dj' },
  { id: 'annee-mao', label: 'MAO Année', detail: '34h + 10 séances libres, 1 349 €, en 1, 2 ou 4 fois', formule: 'annee', discipline: 'mao' },
  { id: 'visio219', label: 'MAO en visio', detail: '8h en individuel, 219 €, en une fois', formule: 'visio219' },
  { id: 'mao119', label: 'Cours en ligne MAO Débutant', detail: '119 €, en une fois', formule: 'mao119' },
]

function url(l) {
  const p = new URLSearchParams({ formule: l.formule })
  if (l.discipline) p.set('discipline', l.discipline)
  return `${PAGE}?${p.toString()}`
}

function message(l) {
  return `Voici ton lien d'inscription pour le ${l.label} : ${url(l)}\nTu remplis la fiche, tu choisis comment tu règles, et je t'envoie tes accès au Backstage dans la foulée.`
}

export default function AdminLiensInscription() {
  const [copie, setCopie] = useState(null)

  async function copier(l) {
    try {
      await navigator.clipboard.writeText(url(l))
      setCopie(l.id)
      setTimeout(() => setCopie((c) => (c === l.id ? null : c)), 2000)
    } catch {
      window.prompt('Copie ce lien :', url(l))
    }
  }

  return (
    <div className="admin-liens">
      <p className="admin-hint">
        À donner pendant le cours d'essai, selon le pack choisi. Le lien ouvre la fiche d'inscription avec le pack déjà sélectionné, puis le paiement. L'inscription arrive ensuite dans « Inscriptions et comptes ». Ces liens ne sont visibles que par toi.
      </p>
      <ul className="admin-liens-liste">
        {LIENS.map((l) => (
          <li key={l.id} className="admin-liens-ligne">
            <div className="admin-liens-texte">
              <strong>{l.label}</strong>
              <span>{l.detail}</span>
            </div>
            <div className="admin-liens-actions">
              <button type="button" className="btn-primary btn-small" onClick={() => copier(l)}>
                {copie === l.id ? 'Lien copié' : 'Copier'}
              </button>
              <a
                className="btn-secondary btn-small"
                href={`https://wa.me/?text=${encodeURIComponent(message(l))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
