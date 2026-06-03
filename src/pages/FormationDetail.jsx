import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const PACK_LABELS = {
  demo: 'Démo',
  resident: 'Résident',
  headliner: 'Headliner',
}

export default function FormationDetail() {
  const { id } = useParams()
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [formation, setFormation] = useState(null)
  const [allFormations, setAllFormations] = useState([])
  const [completedAt, setCompletedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading || !profile?.id || !id) return

    async function fetch() {
      setLoading(true)
      setError(null)

      const [formRes, allRes, progRes] = await Promise.all([
        supabase.from('formations').select('*').eq('id', id).maybeSingle(),
        supabase.from('formations').select('id, ordre, titre, pack_required').order('ordre'),
        supabase
          .from('formations_progression')
          .select('completed_at')
          .eq('user_id', profile.id)
          .eq('formation_id', id)
          .maybeSingle(),
      ])

      if (formRes.error) {
        setError(formRes.error.message)
      }
      if (!formRes.data) {
        setError('Module introuvable ou inaccessible avec ton parcours actuel.')
      }

      setFormation(formRes.data)
      setAllFormations(allRes.data || [])
      setCompletedAt(progRes.data?.completed_at || null)
      setLoading(false)
    }

    fetch()
  }, [id, profile?.id, authLoading])

  async function toggleComplete() {
    if (marking || !formation) return
    setMarking(true)

    if (completedAt) {
      const { error } = await supabase
        .from('formations_progression')
        .delete()
        .eq('user_id', profile.id)
        .eq('formation_id', formation.id)
      if (!error) setCompletedAt(null)
    } else {
      const { data, error } = await supabase
        .from('formations_progression')
        .upsert({
          user_id: profile.id,
          formation_id: formation.id,
          completed_at: new Date().toISOString(),
        })
        .select('completed_at')
        .single()
      if (!error && data) setCompletedAt(data.completed_at)
    }

    setMarking(false)
  }

  if (authLoading || loading) {
    return (
      <div className="container">
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement du module…</p>
      </div>
    )
  }

  if (error || !formation) {
    return (
      <div className="container">
        <Link to="/formations" className="formation-back">← Retour aux formations</Link>
        <div className="placeholder-block" style={{ marginTop: '2rem' }}>
          <span className="badge">Erreur</span>
          <p>{error || 'Module indisponible.'}</p>
        </div>
      </div>
    )
  }

  const currentIdx = allFormations.findIndex((f) => f.id === formation.id)
  const prev = currentIdx > 0 ? allFormations[currentIdx - 1] : null
  const next = currentIdx < allFormations.length - 1 ? allFormations[currentIdx + 1] : null

  return (
    <div className="container formation-detail">
      <Link to="/formations" className="formation-back">← Retour aux formations</Link>

      <header className="formation-detail-header">
        <p className="app-page-eyebrow">
          Module {String(formation.ordre).padStart(2, '0')} · Parcours {PACK_LABELS[formation.pack_required]}
        </p>
        <h1 className="app-page-title">{formation.titre}</h1>
        {formation.duree_min && (
          <p className="app-page-subtitle">{formation.duree_min} min de cours</p>
        )}
      </header>

      <div className="formation-video">
        {formation.video_youtube_id ? (
          <iframe
            src={`https://www.youtube.com/embed/${formation.video_youtube_id}?rel=0&modestbranding=1`}
            title={formation.titre}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="formation-video-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <p>Vidéo à venir</p>
            <small>Ce module sera bientôt disponible. Jérôme y travaille.</small>
          </div>
        )}
      </div>

      {formation.description && (
        <div className="formation-description">
          <h3>Description</h3>
          <p>{formation.description}</p>
        </div>
      )}

      <div className="formation-actions">
        <button
          className={`btn-primary formation-mark-btn${completedAt ? ' is-done' : ''}`}
          onClick={toggleComplete}
          disabled={marking || !formation.video_youtube_id}
        >
          {completedAt
            ? `✓ Vu le ${new Date(completedAt).toLocaleDateString('fr-FR')} · Décocher`
            : 'Marquer comme vu'}
        </button>
        {!formation.video_youtube_id && (
          <small className="formation-mark-hint">
            Tu pourras marquer ce module comme vu quand la vidéo sera publiée.
          </small>
        )}
      </div>

      <nav className="formation-nav">
        {prev ? (
          <Link to={`/formations/${prev.id}`} className="formation-nav-link formation-nav-prev">
            <span className="formation-nav-label">← Module précédent</span>
            <span className="formation-nav-title">
              {String(prev.ordre).padStart(2, '0')} · {prev.titre}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link to={`/formations/${next.id}`} className="formation-nav-link formation-nav-next">
            <span className="formation-nav-label">Module suivant →</span>
            <span className="formation-nav-title">
              {String(next.ordre).padStart(2, '0')} · {next.titre}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </div>
  )
}
