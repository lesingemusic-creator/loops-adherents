import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Panneau admin : l'onglet Communaute.
 * Jerome traite les signalements et bloque ou debloque un membre.
 */
export default function AdminCommunaute() {
  const [signalements, setSignalements] = useState([])
  const [eleves, setEleves] = useState([])
  const [retour, setRetour] = useState(null)

  async function charger() {
    const [s, e] = await Promise.all([
      supabase.from('comm_signalements').select('*').eq('traite', false).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nom, pseudo_dj, role, communaute_bloque').neq('role', 'admin').order('nom'),
    ])
    setSignalements(s.data || [])
    setEleves(e.data || [])
  }
  useEffect(() => { charger() }, [])

  const nom = (id) => {
    const p = eleves.find((x) => x.id === id)
    return p ? (p.pseudo_dj || p.nom) : 'un membre'
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

  const bloques = eleves.filter((e) => e.communaute_bloque)

  return (
    <div>
      {retour && <div className={`admin-feedback admin-feedback-${retour.type}`}>{retour.msg}</div>}

      <p className="admin-hint">
        La communauté des élèves vit dans le Backstage, onglet Communauté. Tu publies seul dans #annonces, #règles,
        #ressources et #contenu-exclusif, et chaque annonce prévient tous les élèves. En tant que modérateur, le menu ⋯
        d'un message te permet de l'épingler ou de le supprimer.
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
