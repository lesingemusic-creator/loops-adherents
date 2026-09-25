import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import '../styles/communaute.css'

/**
 * Onglet Communaute (brief Jerome, section 3).
 * Un clic ouvre une popup d'autorisation Discord ; au retour, le serveur
 * ajoute l'eleve au Discord Loops & Play (scope guilds.join), sans lien
 * d'invitation. Le role @Actif reste donne a la main par Jerome.
 */

const API = `${import.meta.env.BASE_URL}api/`

export default function Communaute() {
  const { profile, refreshProfile } = useAuth()
  const [config, setConfig] = useState(null)
  const [etat, setEtat] = useState('repos') // repos | attente | ok | erreur
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(API + 'discord-config.php')
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => setConfig({ pret: false }))
  }, [])

  // Message renvoye par la popup a la fin du parcours Discord
  useEffect(() => {
    function recevoir(ev) {
      if (ev.origin !== window.location.origin) return
      if (ev.data?.source !== 'lp-discord') return
      setEtat(ev.data.ok ? 'ok' : 'erreur')
      setMessage(ev.data.message || '')
      if (ev.data.ok) refreshProfile()
    }
    window.addEventListener('message', recevoir)
    return () => window.removeEventListener('message', recevoir)
  }, [refreshProfile])

  async function rejoindre() {
    // La popup s'ouvre tout de suite (sinon le navigateur la bloque),
    // puis on lui donne l'adresse Discord une fois le jeton obtenu.
    const largeur = 480
    const hauteur = 760
    const gauche = window.screenX + (window.outerWidth - largeur) / 2
    const haut = window.screenY + (window.outerHeight - hauteur) / 2
    const popup = window.open('', 'lp-discord',
      `width=${largeur},height=${hauteur},left=${gauche},top=${haut}`)

    setEtat('attente')
    setMessage('')

    const { data: jeton, error } = await supabase.rpc('discord_jeton')
    if (error || !jeton) {
      popup?.close()
      setEtat('erreur')
      setMessage('Impossible de préparer la connexion. Recharge la page et réessaie.')
      return
    }

    const params = new URLSearchParams({
      client_id: config.client_id,
      response_type: 'code',
      scope: 'identify guilds.join',
      redirect_uri: config.redirect_uri,
      state: jeton,
      prompt: 'consent',
    })
    const url = `https://discord.com/oauth2/authorize?${params}`

    if (popup && !popup.closed) {
      popup.location.href = url
    } else {
      // Popup bloquee (souvent sur mobile) : on passe en pleine page.
      window.location.href = url
    }
  }

  const dejaLie = !!profile?.discord_id

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Communauté</p>
        <h1 className="app-page-title">Le Discord des élèves</h1>
        <p className="app-page-subtitle">
          Échanges, entraide, tes mix et tes prods en showcase, les retours des autres élèves,
          et les replays des Zoom collectifs.
        </p>
      </header>

      <section className="communaute-carte">
        {config === null && <p className="communaute-texte">Chargement...</p>}

        {config && !config.pret && (
          <p className="communaute-texte">
            La connexion au Discord arrive très vite. En attendant, demande l'accès à Jérôme sur WhatsApp.
          </p>
        )}

        {config?.pret && (
          <>
            {dejaLie && etat !== 'ok' && (
              <p className="communaute-statut">
                Ton compte Discord <strong>{profile.discord_pseudo}</strong> est relié au Backstage.
              </p>
            )}

            <button
              type="button"
              className="communaute-bouton"
              onClick={rejoindre}
              disabled={etat === 'attente'}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>
              {etat === 'attente' ? 'Fenêtre Discord ouverte...' : dejaLie ? 'Ouvrir à nouveau l\'accès' : 'Rejoindre le Discord'}
            </button>

            {message && (
              <p className={`communaute-retour communaute-retour-${etat}`}>{message}</p>
            )}

            <div className="communaute-aide">
              <h2>Comment ça marche</h2>
              <ol>
                <li>Une fenêtre Discord s'ouvre. Tu cliques sur « Autoriser ».</li>
                <li>Tu arrives directement sur le serveur Loops &amp; Play, pas de lien d'invitation à chercher.</li>
                <li>Jérôme t'ouvre ensuite les salons élèves (rôle @Actif).</li>
              </ol>
              <p>
                Pas encore de compte Discord ? La fenêtre te propose de le créer (email et mot de passe),
                c'est une étape imposée par Discord. Une fois créé, reviens ici et reclique sur le bouton.
              </p>
            </div>

            {etat === 'ok' && (
              <a className="communaute-lien" href="https://discord.com/channels/@me" target="_blank" rel="noopener noreferrer">
                Ouvrir Discord
              </a>
            )}
          </>
        )}
      </section>
    </div>
  )
}
