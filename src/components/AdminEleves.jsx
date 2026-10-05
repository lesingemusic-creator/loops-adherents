import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  extraireIdDrive,
  formaterDate,
  dateLimiteTelechargement,
} from '../lib/drive'
import { libelleFormule, NIVEAUX_ACCES } from '../lib/formules'

/**
 * Panneau admin : les eleves et leurs cours filmes.
 *
 * Jerome organise ses videos sur Drive par nom et prenom, puis colle le lien
 * dans la fiche de l'eleve. Aucun systeme de correspondance automatique a
 * construire, c'est une consigne explicite du brief du 18/09/2026.
 */

const FORM_VIDE = { titre: '', drive_url: '', date_seance: '' }

export default function AdminEleves() {
  const [eleves, setEleves] = useState([])
  const [chargement, setChargement] = useState(true)
  const [eleveId, setEleveId] = useState('')
  const [fiche, setFiche] = useState(null)

  const [cours, setCours] = useState([])
  const [form, setForm] = useState(FORM_VIDE)
  const [enCours, setEnCours] = useState(false)
  const [retour, setRetour] = useState(null)

  /* ---------- Liste des eleves ---------- */

  useEffect(() => {
    async function charger() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, prenom, pseudo_dj, role, email, formule, discipline, mix_pack, mao_pack, fin_pack, retention_videos, compte_genere_le, active_le')
        .order('nom', { ascending: true, nullsFirst: false })

      if (error) {
        setRetour({ type: 'error', msg: 'Chargement des élèves : ' + error.message })
      } else {
        setEleves(data || [])
      }
      setChargement(false)
    }
    charger()
  }, [])

  /* ---------- Fiche de l'eleve choisi ---------- */

  useEffect(() => {
    if (!eleveId) {
      setFiche(null)
      setCours([])
      return
    }
    setFiche(eleves.find((e) => e.id === eleveId) || null)
    chargerCours(eleveId)
    setForm(FORM_VIDE)
    setRetour(null)
  }, [eleveId, eleves])

  async function chargerCours(id) {
    const { data, error } = await supabase
      .from('cours_filmes')
      .select('*')
      .eq('user_id', id)
      .order('date_seance', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      setRetour({ type: 'error', msg: 'Chargement des séances : ' + error.message })
      return
    }
    setCours(data || [])
  }

  /* ---------- Reglages de retention ---------- */

  async function majFiche(champs) {
    if (!eleveId) return
    const { error } = await supabase.from('profiles').update(champs).eq('id', eleveId)
    if (error) {
      setRetour({ type: 'error', msg: error.message })
      return
    }
    setEleves((liste) => liste.map((e) => (e.id === eleveId ? { ...e, ...champs } : e)))
    setRetour({ type: 'ok', msg: 'Fiche mise à jour.' })
  }

  /* ---------- Nouveau mot de passe ---------- */

  const [nouveauMdp, setNouveauMdp] = useState(null)
  useEffect(() => { setNouveauMdp(null) }, [eleveId])

  async function regenererMdp() {
    if (!window.confirm("Générer un nouveau mot de passe pour cet élève ? L'ancien ne fonctionnera plus.")) return
    const { data, error } = await supabase.rpc('admin_nouveau_mot_de_passe', { p_user_id: eleveId })
    if (error) {
      setRetour({ type: 'error', msg: error.message })
      return
    }
    setNouveauMdp(data)
    setRetour(null)
  }

  /* ---------- Ajout d'une seance ---------- */

  async function ajouterCours(e) {
    e.preventDefault()
    if (enCours || !eleveId) return

    const titre = form.titre.trim()
    const url = form.drive_url.trim()

    if (!titre) {
      setRetour({ type: 'error', msg: 'Donne un titre à la séance.' })
      return
    }
    if (!extraireIdDrive(url)) {
      setRetour({
        type: 'error',
        msg: "Ce lien Drive n'est pas reconnu. Colle le lien de partage complet, du type https://drive.google.com/file/d/.../view",
      })
      return
    }

    setEnCours(true)
    const { error } = await supabase.from('cours_filmes').insert({
      user_id: eleveId,
      titre,
      drive_url: url,
      date_seance: form.date_seance || null,
    })
    setEnCours(false)

    if (error) {
      setRetour({ type: 'error', msg: error.message })
      return
    }

    setForm(FORM_VIDE)
    setRetour({ type: 'ok', msg: 'Séance ajoutée. Elle apparaît chez l\'élève avec une pastille.' })
    chargerCours(eleveId)
  }

  async function supprimerCours(c) {
    if (!window.confirm(`Supprimer "${c.titre}" de la fiche de cet élève ?\n\nLa vidéo reste sur ton Drive, seul le lien est retiré du Backstage.`)) {
      return
    }
    const { error } = await supabase.from('cours_filmes').delete().eq('id', c.id)
    if (error) {
      setRetour({ type: 'error', msg: error.message })
      return
    }
    setRetour({ type: 'ok', msg: 'Séance retirée.' })
    chargerCours(eleveId)
  }

  /* ---------- Rendu ---------- */

  if (chargement) {
    return <p className="admin-vide">Chargement des élèves...</p>
  }

  const limite = fiche?.retention_videos === 'rotation5'
    ? null
    : dateLimiteTelechargement(fiche?.fin_pack)

  return (
    <div className="admin-eleves">
      {retour && (
        <div className={`admin-feedback admin-feedback-${retour.type}`}>{retour.msg}</div>
      )}

      <div className="admin-form-row">
        <label>
          <span>Choisis un élève</span>
          <select value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
            <option value="">{eleves.length} élève(s) dans le Backstage</option>
            {eleves.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom || e.pseudo_dj || 'Sans nom'}
                {e.pseudo_dj && e.nom ? ` (${e.pseudo_dj})` : ''}
                {e.role === 'admin' ? ' [admin]' : ''}
                {e.role !== 'admin' && e.compte_genere_le && !e.active_le ? ' · pas encore connecté' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!fiche && (
        <p className="admin-vide">
          Sélectionne un élève pour voir ses séances filmées et y ajouter un lien Drive.
        </p>
      )}

      {fiche && (
        <>
          {/* ---------- Etat du compte ---------- */}
          <div className="admin-fiche-etat">
            {fiche.email && <span>Identifiant <strong>{fiche.email}</strong></span>}
            {fiche.formule && <span>Formule <strong>{libelleFormule(fiche)}</strong></span>}
            <span>
              Compte{' '}
              {fiche.active_le
                ? <span className="admin-badge admin-badge-ok">activé le {formaterDate(fiche.active_le.slice(0, 10))}</span>
                : <span className="admin-badge admin-badge-attente">pas encore connecté</span>}
            </span>
          </div>

          {/* ---------- Prenom et nom (05/10/2026) : le prenom sert dans les mails ---------- */}
          <div className="admin-form-row" key={`noms-${fiche.id}`}>
            <label>
              <span>Prénom (utilisé dans les mails)</span>
              <input
                type="text"
                defaultValue={fiche.prenom || ''}
                onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== (fiche.prenom || '')) majFiche({ prenom: v }) }}
              />
            </label>
            <label>
              <span>Nom complet</span>
              <input
                type="text"
                defaultValue={fiche.nom || ''}
                onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== (fiche.nom || '')) majFiche({ nom: v }) }}
              />
            </label>
          </div>

          {/* ---------- Acces ---------- */}
          <div className="admin-form-row">
            <label>
              <span>Accès cours DJ (Mix)</span>
              <select
                value={fiche.mix_pack || ''}
                onChange={(ev) => majFiche({ mix_pack: ev.target.value || null })}
                disabled={fiche.role === 'admin'}
              >
                {NIVEAUX_ACCES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label>
              <span>Accès cours MAO</span>
              <select
                value={fiche.mao_pack || ''}
                onChange={(ev) => majFiche({ mao_pack: ev.target.value || null })}
                disabled={fiche.role === 'admin'}
              >
                {NIVEAUX_ACCES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            {fiche.role !== 'admin' && (
              <label>
                <span>Mot de passe perdu</span>
                <button type="button" className="btn-secondary" onClick={regenererMdp}>Nouveau mot de passe</button>
              </label>
            )}
          </div>

          <p className="admin-hint">
            Les accès sont réglés automatiquement à la création du compte, selon la formule. Tu peux les ajuster ici
            au cas par cas (un bloc en plus, l'autre discipline offerte).
          </p>

          {nouveauMdp && (
            <div className="admin-identifiants" role="status">
              <dl>
                <dt>Identifiant</dt><dd>{fiche.email}</dd>
                <dt>Nouveau mot de passe</dt><dd className="admin-mdp">{nouveauMdp}</dd>
              </dl>
              <p className="admin-hint">Envoie-le à l'élève maintenant, il ne sera plus affiché.</p>
            </div>
          )}

          {/* ---------- Reglages ---------- */}
          <div className="admin-form-row">
            <label>
              <span>Ce que l'élève voit</span>
              <select
                value={fiche.retention_videos || 'historique'}
                onChange={(ev) => majFiche({ retention_videos: ev.target.value })}
              >
                <option value="historique">Tout l'historique de son pack</option>
                <option value="rotation5">Les 5 séances les plus récentes (formule Année)</option>
              </select>
            </label>

            <label>
              <span>Dernière heure de cours</span>
              <input
                type="date"
                value={fiche.fin_pack || ''}
                onChange={(ev) => majFiche({ fin_pack: ev.target.value || null })}
                disabled={fiche.retention_videos === 'rotation5'}
              />
            </label>
          </div>

          <p className="admin-hint">
            {fiche.retention_videos === 'rotation5'
              ? "La formule Année tourne en continu : pas de date de fin, la 6e séance fait disparaître la plus ancienne."
              : limite
                ? `L'élève voit un compte à rebours et peut télécharger jusqu'au ${formaterDate(limite)}. La suppression sur ton Drive reste à faire à la main : pose-toi un rappel.`
                : "Renseigne la dernière heure de cours pour que l'élève voie sa fenêtre de 15 jours."}
          </p>

          {/* ---------- Ajout ---------- */}
          <form className="admin-form" onSubmit={ajouterCours}>
            <h3>Ajouter une séance filmée</h3>

            <div className="admin-form-row">
              <label>
                <span>Titre</span>
                <input
                  type="text"
                  value={form.titre}
                  onChange={(ev) => setForm({ ...form, titre: ev.target.value })}
                  placeholder="Séance 3, travail sur les transitions"
                />
              </label>
              <label>
                <span>Date de la séance</span>
                <input
                  type="date"
                  value={form.date_seance}
                  onChange={(ev) => setForm({ ...form, date_seance: ev.target.value })}
                />
              </label>
            </div>

            <div className="admin-form-row">
              <label style={{ flex: '1 1 100%' }}>
                <span>Lien Drive</span>
                <input
                  type="url"
                  value={form.drive_url}
                  onChange={(ev) => setForm({ ...form, drive_url: ev.target.value })}
                  placeholder="https://drive.google.com/file/d/..../view?usp=sharing"
                />
              </label>
            </div>

            <p className="admin-hint">
              Le fichier doit être partagé en <strong>« Tout le monde avec le lien »</strong> sur
              ton Drive, sinon l'élève voit une page blanche. Ça veut dire que l'URL seule
              ouvre la vidéo, même en dehors du Backstage.
            </p>

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={enCours}>
                {enCours ? 'Ajout...' : 'Ajouter la séance'}
              </button>
            </div>
          </form>

          {/* ---------- Liste ---------- */}
          {cours.length === 0 ? (
            <p className="admin-vide">Aucune séance filmée pour cet élève.</p>
          ) : (
            <div className="admin-table">
              <div className="admin-table-head">
                <span>Titre</span>
                <span>Date</span>
                <span>Vue</span>
                <span></span>
              </div>
              {cours.map((c) => (
                <div className="admin-table-row" key={c.id}>
                  <span>{c.titre}</span>
                  <span>{c.date_seance ? formaterDate(c.date_seance) : 'Non datée'}</span>
                  <span>{c.vu_le ? 'Oui' : 'Pas encore'}</span>
                  <span>
                    <button
                      type="button"
                      className="admin-link-danger"
                      onClick={() => supprimerCours(c)}
                    >
                      Retirer
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
