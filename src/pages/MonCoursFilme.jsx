import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  urlLecteurDrive,
  urlTelechargementDrive,
  joursRestants,
  dateLimiteTelechargement,
  formaterDate,
} from '../lib/drive'
import '../styles/cours-filme.css'

const ROTATION_MAX = 5

export default function MonCoursFilme() {
  const { user, profile } = useAuth()
  const [cours, setCours] = useState([])
  const [actif, setActif] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let annule = false

    async function charger() {
      setChargement(true)
      const { data, error } = await supabase
        .from('cours_filmes')
        .select('*')
        .eq('user_id', user.id)
        .order('date_seance', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (annule) return

      if (error) {
        setErreur(error.message)
        setChargement(false)
        return
      }

      // Formule Annee : liste glissante des 5 seances les plus recentes.
      const visibles = profile?.retention_videos === 'rotation5'
        ? (data || []).slice(0, ROTATION_MAX)
        : (data || [])

      setCours(visibles)
      setActif(visibles[0] || null)
      setChargement(false)
    }

    charger()
    return () => { annule = true }
  }, [user?.id, profile?.retention_videos])

  // Des que l'eleve ouvre une video jamais vue, on retire la pastille.
  useEffect(() => {
    if (!actif || actif.vu_le) return
    let annule = false

    supabase.rpc('marquer_cours_vu', { p_cours_id: actif.id }).then(({ error }) => {
      if (annule || error) return
      const maintenant = new Date().toISOString()
      setCours((liste) => liste.map((c) => (c.id === actif.id ? { ...c, vu_le: maintenant } : c)))
      setActif((c) => (c && c.id === actif.id ? { ...c, vu_le: maintenant } : c))
    })

    return () => { annule = true }
  }, [actif?.id])

  /* ---------- Fenetre de telechargement ---------- */

  const dateLimite = profile?.retention_videos === 'rotation5'
    ? null
    : dateLimiteTelechargement(profile?.fin_pack)
  const restants = joursRestants(dateLimite)

  /* ---------- Rendu ---------- */

  if (chargement) {
    return (
      <div className="container">
        <EnTete />
        <p className="cf-vide">Chargement de tes séances...</p>
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="container">
        <EnTete />
        <div className="cf-alerte cf-alerte--erreur">
          Impossible de charger tes séances pour le moment. Réessaie dans un instant,
          et si ça persiste, préviens Jérôme.
        </div>
      </div>
    )
  }

  if (cours.length === 0) {
    return (
      <div className="container">
        <EnTete />
        <div className="cf-vide-bloc">
          <p className="cf-vide-titre">Rien ici pour l'instant</p>
          <p className="cf-vide-texte">
            Tes séances filmées apparaîtront sur cette page dès que Jérôme les aura mises en
            ligne. En général, dans les jours qui suivent ton cours.
          </p>
        </div>
      </div>
    )
  }

  const lecteur = actif ? urlLecteurDrive(actif.drive_url) : null
  const telechargement = actif ? urlTelechargementDrive(actif.drive_url) : null

  return (
    <div className="container">
      <EnTete />

      {restants !== null && restants > 0 && restants <= 30 && (
        <div className="cf-alerte cf-alerte--attention">
          <strong>Pense à télécharger tes séances.</strong> Elles restent disponibles encore{' '}
          {restants} jour{restants > 1 ? 's' : ''}, jusqu'au {formaterDate(dateLimite)}.
          Après cette date, elles sont supprimées.
        </div>
      )}

      {restants !== null && restants <= 0 && (
        <div className="cf-alerte cf-alerte--erreur">
          La fenêtre de téléchargement est passée depuis le {formaterDate(dateLimite)}.
          Si tu as besoin d'une séance, écris à Jérôme au plus vite.
        </div>
      )}

      <div className="cf-layout">
        {/* ---------- Lecteur ---------- */}
        <div className="cf-lecteur">
          {lecteur ? (
            <div className="cf-video">
              <iframe
                src={lecteur}
                title={actif.titre}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="cf-video cf-video--casse">
              <p>
                Cette vidéo ne s'affiche pas ici. Ouvre-la directement dans Drive,
                et préviens Jérôme pour qu'il corrige le lien.
              </p>
              <a href={actif.drive_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Ouvrir dans Drive
              </a>
            </div>
          )}

          <div className="cf-meta">
            <div>
              <h2 className="cf-titre">{actif.titre}</h2>
              {actif.date_seance && (
                <p className="cf-date">Séance du {formaterDate(actif.date_seance)}</p>
              )}
            </div>
            {telechargement && (
              <a
                href={telechargement}
                target="_blank"
                rel="noopener noreferrer"
                className="cf-dl"
              >
                Télécharger
              </a>
            )}
          </div>
        </div>

        {/* ---------- Liste ---------- */}
        {cours.length > 1 && (
          <aside className="cf-liste">
            <p className="cf-liste-titre">
              Tes séances
              <span className="cf-liste-compte">{cours.length}</span>
            </p>
            <ul>
              {cours.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`cf-item ${actif?.id === c.id ? 'is-actif' : ''}`}
                    onClick={() => setActif(c)}
                  >
                    <span className="cf-item-txt">
                      <span className="cf-item-titre">{c.titre}</span>
                      {c.date_seance && (
                        <span className="cf-item-date">{formaterDate(c.date_seance)}</span>
                      )}
                    </span>
                    {!c.vu_le && <span className="cf-pastille" aria-label="Nouvelle séance" />}
                  </button>
                </li>
              ))}
            </ul>

            {profile?.retention_videos === 'rotation5' && (
              <p className="cf-liste-note">
                Ta formule garde les {ROTATION_MAX} séances les plus récentes. Les plus
                anciennes laissent la place au fur et à mesure, pense à télécharger.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function EnTete() {
  return (
    <header className="app-page-header">
      <p className="app-page-eyebrow">Backstage</p>
      <h1 className="app-page-title">Mon cours filmé</h1>
      <p className="app-page-subtitle">
        Tes propres séances, filmées en studio. Rien à voir avec les modules de formation :
        ici, c'est toi à la platine.
      </p>
    </header>
  )
}
