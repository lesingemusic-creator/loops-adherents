import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const PACK_LABELS = {
  demo: 'Démo',
  resident: 'Résident',
  headliner: 'Headliner',
}

const CATEGORIE_LABELS = {
  mix: 'Cours de Mix',
  mao: 'Cours de MAO',
}

const BUCKET = 'formation-documents'

export default function FormationDetail() {
  const { id } = useParams()
  const { profile, loading: authLoading } = useAuth()

  const [formation, setFormation] = useState(null)
  const [allFormations, setAllFormations] = useState([])
  const [completedAt, setCompletedAt] = useState(null)
  const [documents, setDocuments] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)         // ID du PDF actuellement ouvert dans le viewer
  const [activeDocUrl, setActiveDocUrl] = useState(null)   // URL signée du PDF ouvert
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading || !profile?.id || !id) return

    async function fetch() {
      setLoading(true)
      setError(null)

      const [formRes, allRes, progRes, docsRes] = await Promise.all([
        supabase.from('formations').select('*').eq('id', id).maybeSingle(),
        supabase.from('formations').select('id, ordre, titre, categorie, pack_required').order('ordre'),
        supabase
          .from('formations_progression')
          .select('completed_at')
          .eq('user_id', profile.id)
          .eq('formation_id', id)
          .maybeSingle(),
        supabase
          .from('formation_documents')
          .select('*')
          .eq('formation_id', id)
          .order('ordre', { ascending: true }),
      ])

      if (formRes.error) setError(formRes.error.message)
      if (!formRes.data) {
        setError('Module introuvable ou inaccessible avec ton parcours actuel.')
      }

      setFormation(formRes.data)
      setAllFormations(allRes.data || [])
      setCompletedAt(progRes.data?.completed_at || null)
      setDocuments(docsRes.data || [])
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

  async function openDocument(doc) {
    // Génère une URL signée (valable 1h) pour le PDF
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.fichier_path, 3600)
    if (error) {
      console.error('[doc] signed url error:', error)
      return
    }
    setActiveDoc(doc.id)
    setActiveDocUrl(data.signedUrl)
    // Scroll vers le viewer
    setTimeout(() => {
      document.getElementById('doc-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  async function downloadDocument(doc) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.fichier_path, 3600, {
        download: doc.titre.endsWith('.pdf') ? doc.titre : `${doc.titre}.pdf`,
      })
    if (error) {
      console.error('[doc] download url error:', error)
      return
    }
    // Force le téléchargement
    window.location.href = data.signedUrl
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

  // Navigation prev/next limitée aux modules de la même catégorie
  const sameCategoryList = allFormations.filter((f) => f.categorie === formation.categorie)
  const currentIdx = sameCategoryList.findIndex((f) => f.id === formation.id)
  const prev = currentIdx > 0 ? sameCategoryList[currentIdx - 1] : null
  const next = currentIdx < sameCategoryList.length - 1 ? sameCategoryList[currentIdx + 1] : null

  return (
    <div className="container formation-detail">
      <Link to="/formations" className="formation-back">← Retour aux formations</Link>

      <header className="formation-detail-header">
        <p className="app-page-eyebrow">
          {CATEGORIE_LABELS[formation.categorie] || 'Formation'} · Niveau {PACK_LABELS[formation.pack_required]} · Module {String(formation.ordre).padStart(2, '0')}
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

      {/* ====== Documents PDF ====== */}
      {documents.length > 0 && (
        <div className="formation-docs">
          <h3>Documents du cours ({documents.length})</h3>
          <ul className="formation-docs-list">
            {documents.map((doc) => (
              <li key={doc.id} className={`formation-docs-item${activeDoc === doc.id ? ' is-active' : ''}`}>
                <div className="formation-docs-item-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="formation-docs-item-title">{doc.titre}</span>
                  {doc.taille_kb && (
                    <span className="formation-docs-item-size">
                      {doc.taille_kb < 1024 ? `${doc.taille_kb} KB` : `${Math.round(doc.taille_kb / 1024 * 10) / 10} MB`}
                    </span>
                  )}
                </div>
                <div className="formation-docs-item-actions">
                  <button type="button" className="btn-secondary btn-small" onClick={() => openDocument(doc)}>
                    {activeDoc === doc.id ? 'Ouvert' : 'Lire'}
                  </button>
                  <button type="button" className="btn-secondary btn-small" onClick={() => downloadDocument(doc)}>
                    Télécharger
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Viewer inline */}
          {activeDocUrl && (
            <div id="doc-viewer" className="formation-doc-viewer">
              <div className="formation-doc-viewer-header">
                <span>Lecteur PDF</span>
                <button type="button" className="link-btn" onClick={() => { setActiveDoc(null); setActiveDocUrl(null); }}>
                  Fermer ✕
                </button>
              </div>
              <iframe
                src={activeDocUrl}
                title="Document PDF"
                className="formation-doc-viewer-frame"
              />
              <small className="formation-doc-viewer-hint">
                Si le PDF ne s'affiche pas sur ton téléphone, utilise le bouton "Télécharger" pour le lire dans ton appli PDF.
              </small>
            </div>
          )}
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
