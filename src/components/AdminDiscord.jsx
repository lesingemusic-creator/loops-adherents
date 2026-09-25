import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Panneau admin : branchement Discord.
 * Jerome colle lui-meme les cles de SON application Discord. Elles partent
 * directement au serveur de loopsplay.com, qui les verifie aupres de Discord
 * et les range hors de la racine web. Elles ne sont jamais relues par l'app.
 */

const API = `${import.meta.env.BASE_URL}api/discord-config.php`
const SERVEUR_LOOPS = '1539956962840678450'
const VIDE = { client_id: '', client_secret: '', bot_token: '', guild_id: SERVEUR_LOOPS }

export default function AdminDiscord() {
  const [etat, setEtat] = useState(null)
  const [ouvert, setOuvert] = useState(false)
  const [form, setForm] = useState(VIDE)
  const [enCours, setEnCours] = useState(false)
  const [retour, setRetour] = useState(null)

  function charger() {
    fetch(API).then((r) => r.json()).then(setEtat).catch(() => setEtat({ pret: false }))
  }
  useEffect(charger, [])

  async function enregistrer(e) {
    e.preventDefault()
    if (enCours) return
    setEnCours(true)
    setRetour(null)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erreur || 'Erreur ' + r.status)
      setRetour({ type: 'ok', msg: `C'est branché : le bot ${j.bot} est prêt sur le serveur ${j.serveur}.` })
      setForm(VIDE)
      setOuvert(false)
      charger()
    } catch (err) {
      setRetour({ type: 'error', msg: err.message })
    }
    setEnCours(false)
  }

  if (!etat) return <p className="admin-vide">Chargement...</p>

  return (
    <div>
      {retour && <div className={`admin-feedback admin-feedback-${retour.type}`}>{retour.msg}</div>}

      <div className="admin-fiche-etat">
        <span>
          Onglet Communauté{' '}
          {etat.pret
            ? <span className="admin-badge admin-badge-ok">branché{etat.serveur ? ` sur ${etat.serveur}` : ''}</span>
            : <span className="admin-badge admin-badge-attente">en attente de tes clés</span>}
        </span>
      </div>

      {!ouvert && (
        <button type="button" className="btn-secondary" onClick={() => setOuvert(true)}>
          {etat.pret ? 'Remplacer les clés' : 'Coller mes clés Discord'}
        </button>
      )}

      {ouvert && (
        <form className="admin-form" onSubmit={enregistrer} autoComplete="off">
          <h3>Clés de ton application Discord</h3>
          <p className="admin-hint">
            Sur <strong>discord.com/developers/applications</strong>, application « Loops Backstage ».
            Dans OAuth2 &gt; Redirects, ajoute exactement cette adresse :<br />
            <strong>{etat.redirect_uri}</strong>
          </p>

          <div className="admin-discord-cles">
            <label>
              <span>Client ID (onglet OAuth2)</span>
              <input type="text" inputMode="numeric" value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value.trim() })} />
            </label>
            <label>
              <span>Client Secret (onglet OAuth2, « Reset Secret »)</span>
              <input type="password" value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value.trim() })} />
            </label>
            <label>
              <span>Token du bot (onglet Bot, « Reset Token »)</span>
              <input type="password" value={form.bot_token}
                onChange={(e) => setForm({ ...form, bot_token: e.target.value.trim() })} />
            </label>
            <label>
              <span>ID du serveur Discord</span>
              <input type="text" inputMode="numeric" value={form.guild_id}
                onChange={(e) => setForm({ ...form, guild_id: e.target.value.trim() })} />
              <small>Déjà rempli avec ton serveur Loops &amp; Play.</small>
            </label>
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="btn-primary" disabled={enCours}>
              {enCours ? 'Vérification auprès de Discord...' : 'Vérifier et enregistrer'}
            </button>
            <button type="button" className="admin-link" onClick={() => { setOuvert(false); setForm(VIDE) }}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  )
}
