import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Panneau admin : l'onglet Communaute.
 * Jerome ecrit le defi de la semaine, traite les signalements et bloque
 * ou debloque un membre.
 */
export default function AdminCommunaute() {
  const [signalements, setSignalements] = useState([])
  const [eleves, setEleves] = useState([])
  const [retour, setRetour] = useState(null)
  const [defi, setDefi] = useState({ titre: '', texte: '', salon: 'showcase', fin: '' })

  async function charger() {
    const [s, e, d] = await Promise.all([
      supabase.from('comm_signalements').select('*').eq('traite', false).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nom, pseudo_dj, role, communaute_bloque').neq('role', 'admin').order('nom'),
      supabase.from('reglages_app').select('valeur').eq('cle', 'defi').maybeSingle(),
    ])
    if (d.data?.valeur) { try { setDefi({ salon: 'showcase', fin: '', ...JSON.parse(d.data.valeur) }) } catch { /* reglage illisible */ } }
    setSignalements(s.data || [])
    setEleves(e.data || [])
  }
  useEffect(() => { charger() }, [])

  const nom = (id) => {
    const p = eleves.find((x) => x.id === id)
    return p ? (p.pseudo_dj || p.nom) : 'un membre'
  }

  async function enregistrerDefi(e) {
    e.preventDefault()
    const valeur = JSON.stringify({ ...defi, titre: defi.titre.trim(), texte: defi.texte.trim(), debut: defi.debut || new Date().toISOString() })
    const { error } = await supabase.from('reglages_app').upsert({ cle: 'defi', valeur, modifie_le: new Date().toISOString() })
    if (error) { setRetour({ type: 'error', msg: error.message }); return }
    setDefi(JSON.parse(valeur))
    setRetour({ type: 'ok', msg: defi.titre.trim() ? "Défi en ligne : il s'affiche en haut de la Communauté." : 'Défi retiré.' })
  }

  async function nouveauDefi() {
    setDefi({ titre: '', texte: '', salon: 'showcase', fin: '', debut: new Date().toISOString() })
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

      <form className="admin-form" onSubmit={enregistrerDefi}>
        <h3>Défi de la semaine</h3>
        <p className="admin-hint">
          Il s'affiche en haut de la Communauté avec une barre de progression : le nombre d'élèves qui ont publié dans le salon
          choisi depuis le lancement du défi. Laisse le titre vide pour le retirer.
        </p>
        <div className="admin-form-row">
          <label style={{ gridColumn: 'span 2' }}>
            <span>Titre</span>
            <input type="text" value={defi.titre} maxLength={80} placeholder="Un mix de 15 min sans toucher au crossfader"
              onChange={(e) => setDefi({ ...defi, titre: e.target.value })} />
          </label>
          <label>
            <span>Fin du défi</span>
            <input type="date" value={defi.fin || ''} onChange={(e) => setDefi({ ...defi, fin: e.target.value })} />
          </label>
        </div>
        <div className="admin-form-row">
          <label style={{ gridColumn: 'span 2' }}>
            <span>Consigne (facultatif)</span>
            <input type="text" value={defi.texte} maxLength={200} placeholder="Poste-le dans #showcase avant dimanche."
              onChange={(e) => setDefi({ ...defi, texte: e.target.value })} />
          </label>
          <label>
            <span>Salon où l'on poste</span>
            <select value={defi.salon} onChange={(e) => setDefi({ ...defi, salon: e.target.value })}>
              <option value="showcase">Showcase</option>
              <option value="feedback-mix">Feedback mix</option>
              <option value="general">Général</option>
            </select>
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="btn-primary">Enregistrer le défi</button>
          <button type="button" className="admin-link" onClick={nouveauDefi}>Nouveau défi (remet le compteur à zéro)</button>
        </div>
      </form>

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
