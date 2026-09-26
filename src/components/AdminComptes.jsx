import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FORMULES, DISCIPLINES } from '../lib/formules'

/**
 * Panneau admin : inscriptions recues et generateur de comptes.
 * Brief Jerome, sections 2 et 3 : l'eleve s'inscrit sur la page cachee,
 * paie sur Stripe ; Jerome verifie le paiement, puis clique "Generer".
 * Le compte est cree, l'identifiant et le mot de passe s'affichent,
 * Jerome les envoie lui-meme sur WhatsApp.
 */

const FORM_VIDE = { prenom: '', nom: '', email: '', formule: '', discipline: '', inscription_id: null }

const MODES = { comptant: 'comptant', '2x': '2 fois', '4x': '4 fois' }

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function messageWhatsApp(prenom, identifiant, motDePasse) {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `Salut ${prenom}, bienvenue chez Loops & Play !

Ton accès au Backstage, ton espace élève :
${url}

Identifiant : ${identifiant}
Mot de passe : ${motDePasse}

Tu y retrouves tes cours en vidéo, le calendrier pour réserver, tes séances filmées et la communauté des élèves.

Pour l'avoir en appli sur ton téléphone :
${url}installer`
}

export default function AdminComptes({ onCompteCree }) {
  const [inscriptions, setInscriptions] = useState([])
  const [voirTout, setVoirTout] = useState(false)
  const [form, setForm] = useState(FORM_VIDE)
  const [enCours, setEnCours] = useState(false)
  const [retour, setRetour] = useState(null)
  const [cree, setCree] = useState(null)
  const [copie, setCopie] = useState(false)

  async function charger() {
    const { data, error } = await supabase
      .from('inscriptions_admin')
      .select('*')
      .order('recu_le', { ascending: false })
      .limit(100)
    if (error) {
      setRetour({ type: 'error', msg: 'Inscriptions : ' + error.message })
      return
    }
    setInscriptions(data || [])
  }

  useEffect(() => { charger() }, [])

  const choixDiscipline = FORMULES[form.formule]?.discipline === 'choix'

  function depuisInscription(i) {
    setForm({
      prenom: i.prenom,
      nom: i.nom,
      email: i.email,
      formule: i.formation,
      discipline: i.discipline || '',
      inscription_id: i.id,
    })
    setCree(null)
    setRetour(null)
    document.getElementById('generateur')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function sansSuite(i) {
    if (!window.confirm(`Classer l'inscription de ${i.prenom} ${i.nom} sans suite ?\n\nÀ faire si le paiement n'est jamais arrivé.`)) return
    const { error } = await supabase
      .from('inscriptions')
      .update({ statut: 'sans_suite', traitee_le: new Date().toISOString() })
      .eq('id', i.id)
    if (error) {
      setRetour({ type: 'error', msg: error.message })
      return
    }
    charger()
  }

  async function generer(e) {
    e.preventDefault()
    if (enCours) return
    setRetour(null)
    setCree(null)

    if (!form.prenom.trim() || !form.nom.trim() || !form.email.trim() || !form.formule) {
      setRetour({ type: 'error', msg: 'Prénom, nom, email et formule sont obligatoires.' })
      return
    }
    if (choixDiscipline && !form.discipline) {
      setRetour({ type: 'error', msg: 'Choisis la discipline : DJ ou MAO.' })
      return
    }

    setEnCours(true)
    const { data, error } = await supabase.rpc('admin_creer_eleve', {
      p_prenom: form.prenom.trim(),
      p_nom: form.nom.trim(),
      p_email: form.email.trim(),
      p_formule: form.formule,
      p_discipline: choixDiscipline ? form.discipline : null,
      p_inscription_id: form.inscription_id,
    })
    setEnCours(false)

    if (error) {
      const msg = error.message.includes('existe deja')
        ? 'Un compte existe déjà avec cet email. Retrouve l\'élève dans la liste plus bas.'
        : error.message
      setRetour({ type: 'error', msg })
      return
    }

    const r = data?.[0]
    setCree({ prenom: form.prenom.trim(), ...r })
    setCopie(false)
    setForm(FORM_VIDE)
    charger()
    onCompteCree?.()
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(messageWhatsApp(cree.prenom, cree.identifiant, cree.mot_de_passe))
      setCopie(true)
    } catch {
      setCopie(false)
      window.prompt('Copie ce message :', messageWhatsApp(cree.prenom, cree.identifiant, cree.mot_de_passe))
    }
  }

  const aTraiter = inscriptions.filter((i) => i.statut === 'nouvelle')
  const liste = voirTout ? inscriptions : aTraiter

  return (
    <div className="admin-comptes">
      {/* ---------- Inscriptions ---------- */}
      <div className="admin-subhead">
        <h3>Inscriptions reçues {aTraiter.length > 0 && <span className="admin-compteur">{aTraiter.length}</span>}</h3>
        <button type="button" className="admin-link" onClick={() => setVoirTout(!voirTout)}>
          {voirTout ? 'Voir seulement celles à traiter' : 'Voir tout l\'historique'}
        </button>
      </div>

      <p className="admin-hint">
        Chaque formulaire envoyé depuis ta page d'inscription arrive ici, juste avant le paiement Stripe.
        Vérifie que le paiement est bien arrivé sur Stripe, puis clique « Créer le compte ».
      </p>

      {liste.length === 0 ? (
        <p className="admin-vide">{voirTout ? 'Aucune inscription pour l\'instant.' : 'Rien à traiter.'}</p>
      ) : (
        <div className="admin-cartes">
          {liste.map((i) => (
            <article key={i.id} className={`admin-carte admin-carte-${i.statut}`}>
              <header>
                <strong>{i.prenom} {i.nom}</strong>
                <span>{dateCourte(i.recu_le)}</span>
              </header>
              <p>
                {FORMULES[i.formation]?.label} {i.discipline && i.formation !== 'pack3' ? DISCIPLINES[i.discipline] : ''}
                {' · '}{FORMULES[i.formation]?.prix} {MODES[i.mode_paiement]}
              </p>
              <p className="admin-carte-contact">
                <a href={`mailto:${i.email}`}>{i.email}</a> · <a href={`tel:${i.telephone.replace(/\s/g, '')}`}>{i.telephone}</a>
              </p>
              <footer>
                {i.statut === 'nouvelle' && (
                  <>
                    <button type="button" className="btn-primary btn-small" onClick={() => depuisInscription(i)}>Créer le compte</button>
                    <button type="button" className="admin-link" onClick={() => sansSuite(i)}>Sans suite</button>
                  </>
                )}
                {i.statut === 'compte_cree' && <span className="admin-badge admin-badge-ok">Compte créé</span>}
                {i.statut === 'sans_suite' && <span className="admin-badge">Sans suite</span>}
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* ---------- Generateur ---------- */}
      <form id="generateur" className="admin-form" onSubmit={generer}>
        <h3>Générer un compte élève</h3>
        <p className="admin-hint">
          Pré-rempli quand tu pars d'une inscription. Tu peux aussi le remplir à la main pour un élève
          inscrit autrement (WhatsApp, au studio).
        </p>

        {retour && <div className={`admin-feedback admin-feedback-${retour.type}`}>{retour.msg}</div>}

        <div className="admin-form-row">
          <label>
            <span>Prénom</span>
            <input type="text" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          </label>
          <label>
            <span>Nom</span>
            <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </label>
        </div>

        <div className="admin-form-row">
          <label>
            <span>Email (ce sera son identifiant)</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            <span>Formule</span>
            <select value={form.formule} onChange={(e) => setForm({ ...form, formule: e.target.value, discipline: '' })}>
              <option value="">Choisir...</option>
              {Object.entries(FORMULES).map(([cle, f]) => (
                <option key={cle} value={cle}>{f.label} ({f.prix})</option>
              ))}
            </select>
          </label>
          {choixDiscipline && (
            <label>
              <span>Discipline</span>
              <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                <option value="">Choisir...</option>
                <option value="dj">DJ</option>
                <option value="mao">MAO</option>
              </select>
            </label>
          )}
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="btn-primary" disabled={enCours}>
            {enCours ? 'Création...' : 'Générer le compte'}
          </button>
          {form.inscription_id && (
            <button type="button" className="admin-link" onClick={() => setForm(FORM_VIDE)}>Vider</button>
          )}
        </div>
      </form>

      {cree && (
        <div className="admin-identifiants" role="status">
          <p className="admin-identifiants-titre">Compte créé pour {cree.prenom}</p>
          <dl>
            <dt>Identifiant</dt><dd>{cree.identifiant}</dd>
            <dt>Mot de passe</dt><dd className="admin-mdp">{cree.mot_de_passe}</dd>
          </dl>
          <p className="admin-hint">
            Le mot de passe ne sera plus affiché. Envoie-le maintenant. S'il est perdu, tu pourras en générer un nouveau depuis la fiche de l'élève.
          </p>
          <div className="admin-form-actions">
            <button type="button" className="btn-primary" onClick={copier}>
              {copie ? 'Message copié' : 'Copier le message WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
