import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Panneau admin : l'onglet Communaute.
 * Jerome choisit entre son Discord et la Communaute maison, traite les
 * signalements et bloque ou debloque un membre.
 */
export default function AdminCommunaute() {
  const [mode, setMode] = useState(null)
  const [signalements, setSignalements] = useState([])
  const [eleves, setEleves] = useState([])
  const [retour, setRetour] = useState(null)

  async function charger() {
    const [m, s, e] = await Promise.all([
      supabase.from('reglages_app').select('valeur').eq('cle', 'communaute_mode').maybeSingle(),
      supabase.from('comm_signalements').select('*').eq('traite', false).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nom, pseudo_dj, role, communaute_bloque').neq('role', 'admin').order('nom'),
    ])
    setMode(m.data?.valeur || 'discord')
    setSignalements(s.data || [])
    setEleves(e.data || [])
  }
  useEffect(() => { charger() }, [])

  const nom = (id) => {
    const p = eleves.find((x) => x.id === id)
    return p ? (p.pseudo_dj || p.nom) : 'un membre'
  }

  async function changerMode(v) {
    const libelle = v === 'maison' ? 'la Communauté maison' : 'Discord'
    if (!window.confirm(`Les élèves verront ${libelle} dans l'onglet Communauté. On y va ?`)) return
    const { error } = await supabase.from('reglages_app')
      .update({ valeur: v, modifie_le: new Date().toISOString() }).eq('cle', 'communaute_mode')
    if (error) { setRetour({ type: 'error', msg: error.message }); return }
    setMode(v)
    setRetour({ type: 'ok', msg: `C'est en place : l'onglet Communauté affiche ${libelle}.` })
  }

  async function traiter(s) {
    await supabase.from('comm_signalements').update({ traite: true }).eq('id', s.id)
    setSignalements((l) => l.filter((x) => x.id !== s.id))
  }

  async function bloquer(userId, bloque) {
    const { error } = await supabase.rpc('comm_bloquer', { p_user: userId, p_bloque: bloque })
    if (error) { setRetour({ type: 'error', msg: error.message }); return }
    setEleves((l) => l.map((x) => (x.id === userId ? { ...x, communaute_bloque: bloque } : x)))
    setRetour({ type: 'ok', msg: bloque ? 'Membre bloqué : il ne voit plus la communauté.' : 'Membre débloqué.' })
  }

  if (!mode) return <p className="admin-vide">Chargement...</p>

  const bloques = eleves.filter((e) => e.communaute_bloque)

  return (
    <div>
      {retour && <div className={`admin-feedback admin-feedback-${retour.type}`}>{retour.msg}</div>}

      <div className="admin-form-row">
        <label className="admin-form-label-libre">
          <span>Ce que voient les élèves dans l'onglet Communauté</span>
          <select value={mode} onChange={(e) => changerMode(e.target.value)}>
            <option value="discord">Ton serveur Discord</option>
            <option value="maison">La Communauté maison, dans le Backstage</option>
          </select>
        </label>
      </div>

      <p className="admin-hint">
        {mode === 'discord'
          ? <>Les élèves rejoignent ton Discord. Tu peux essayer la Communauté maison en aperçu, sans que les élèves la voient : <Link to="/communaute" className="admin-link">ouvrir l'onglet Communauté</Link> puis « L'essayer en aperçu ».</>
          : <>Les élèves échangent directement dans le Backstage. Tu publies seul dans #annonces, #règles, #ressources et #contenu-exclusif, chaque annonce prévient tout le monde. Tu peux épingler et supprimer n'importe quel message.</>}
      </p>

      <div className="admin-subhead">
        <h3>Signalements {signalements.length > 0 && <span className="admin-compteur">{signalements.length}</span>}</h3>
      </div>
      {signalements.length === 0 ? (
        <p className="admin-vide">Aucun signalement en attente.</p>
      ) : (
        <div className="admin-cartes">
          {signalements.map((s) => (
            <article key={s.id} className="admin-carte admin-carte-nouvelle">
              <header>
                <strong>Message de {nom(s.auteur_id)}</strong>
                <span>{new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
              </header>
              <p>« {s.extrait || 'fichier'} »</p>
              {s.raison && <p>Raison : {s.raison}</p>}
              <p>Signalé par {nom(s.signale_par)}</p>
              <footer>
                <button type="button" className="btn-primary btn-small" onClick={() => traiter(s)}>Traité</button>
                {s.auteur_id && <button type="button" className="admin-link-danger" onClick={() => bloquer(s.auteur_id, true)}>Bloquer l'auteur</button>}
              </footer>
            </article>
          ))}
        </div>
      )}

      <p className="admin-hint">
        Pour supprimer le message signalé, ouvre-le dans la Communauté : en tant que modérateur, le menu ⋯ te donne « Supprimer » sur tous les messages.
      </p>

      {bloques.length > 0 && (
        <>
          <div className="admin-subhead"><h3>Membres bloqués</h3></div>
          <div className="admin-cartes">
            {bloques.map((e) => (
              <article key={e.id} className="admin-carte">
                <header><strong>{e.pseudo_dj || e.nom}</strong></header>
                <footer><button type="button" className="admin-link" onClick={() => bloquer(e.id, false)}>Débloquer</button></footer>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
