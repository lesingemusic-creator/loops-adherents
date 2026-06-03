import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const PACKS = ['demo', 'resident', 'headliner']
const PACK_LABELS = { demo: 'Démo', resident: 'Résident', headliner: 'Headliner' }

const EMPTY_FORM = {
  ordre: 1,
  pack_required: 'demo',
  titre: '',
  description: '',
  duree_min: '',
  video_youtube_id: '',
}

export default function Admin() {
  const { profile, loading: authLoading } = useAuth()
  const [formations, setFormations] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase
      .from('formations')
      .select('*')
      .order('ordre')
    if (!error) setFormations(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.role === 'admin') refresh()
  }, [profile?.role])

  if (authLoading) return null
  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  function startEdit(f) {
    setEditingId(f.id)
    setForm({
      ordre: f.ordre,
      pack_required: f.pack_required,
      titre: f.titre,
      description: f.description || '',
      duree_min: f.duree_min ?? '',
      video_youtube_id: f.video_youtube_id || '',
    })
    setFeedback(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startCreate() {
    setEditingId('new')
    const nextOrdre = (formations[formations.length - 1]?.ordre || 0) + 1
    setForm({ ...EMPTY_FORM, ordre: nextOrdre })
    setFeedback(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFeedback(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFeedback(null)

    const payload = {
      ordre: parseInt(form.ordre, 10) || 1,
      pack_required: form.pack_required,
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      duree_min: form.duree_min === '' ? null : parseInt(form.duree_min, 10),
      video_youtube_id: form.video_youtube_id.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.titre) {
      setFeedback({ type: 'error', msg: 'Le titre est obligatoire.' })
      setSaving(false)
      return
    }

    let result
    if (editingId === 'new') {
      result = await supabase.from('formations').insert(payload).select().single()
    } else {
      result = await supabase
        .from('formations')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()
    }

    if (result.error) {
      setFeedback({ type: 'error', msg: result.error.message })
    } else {
      setFeedback({ type: 'ok', msg: editingId === 'new' ? 'Module créé.' : 'Module mis à jour.' })
      await refresh()
      cancelEdit()
    }
    setSaving(false)
  }

  async function handleDelete(f) {
    if (!confirm(`Supprimer définitivement le module "${f.titre}" ? La progression des adhérents sur ce module sera aussi effacée.`)) return
    const { error } = await supabase.from('formations').delete().eq('id', f.id)
    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      setFeedback({ type: 'ok', msg: 'Module supprimé.' })
      await refresh()
    }
  }

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Panel admin</p>
        <h1 className="app-page-title">Gestion de l'espace</h1>
        <p className="app-page-subtitle">
          Tu peux gérer les modules de formation ici. Les adhérents verront uniquement les modules de leur parcours (ou inférieurs).
        </p>
      </header>

      {/* ====== Section Formations ====== */}
      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Modules de formation</h2>
          {editingId === null && (
            <button className="btn-primary" onClick={startCreate}>
              + Nouveau module
            </button>
          )}
        </div>

        {feedback && (
          <div className={`admin-feedback admin-feedback-${feedback.type}`}>
            {feedback.msg}
          </div>
        )}

        {/* ====== Formulaire d'édition / création ====== */}
        {editingId !== null && (
          <form className="admin-form" onSubmit={handleSave}>
            <h3>{editingId === 'new' ? 'Créer un module' : 'Éditer ce module'}</h3>

            <div className="admin-form-row">
              <label>
                <span>Ordre d'affichage</span>
                <input
                  type="number"
                  min="1"
                  value={form.ordre}
                  onChange={(e) => setForm({ ...form, ordre: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Parcours requis</span>
                <select
                  value={form.pack_required}
                  onChange={(e) => setForm({ ...form, pack_required: e.target.value })}
                >
                  {PACKS.map((p) => (
                    <option key={p} value={p}>{PACK_LABELS[p]}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Durée (min)</span>
                <input
                  type="number"
                  min="1"
                  value={form.duree_min}
                  onChange={(e) => setForm({ ...form, duree_min: e.target.value })}
                  placeholder="ex: 15"
                />
              </label>
            </div>

            <label>
              <span>Titre du module</span>
              <input
                type="text"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                placeholder="ex: Les bases du beatmatching"
                required
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Une ou deux phrases qui résument ce que l'adhérent va apprendre."
              />
            </label>

            <label>
              <span>ID YouTube de la vidéo</span>
              <input
                type="text"
                value={form.video_youtube_id}
                onChange={(e) => setForm({ ...form, video_youtube_id: e.target.value })}
                placeholder="ex: dQw4w9WgXcQ (juste l'ID, pas l'URL complète)"
              />
              <small>
                Sur YouTube, l'ID est la partie après <code>?v=</code> dans l'URL.
                Laisse vide tant que la vidéo n'est pas tournée — le module s'affichera "Bientôt".
              </small>
            </label>

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : (editingId === 'new' ? 'Créer le module' : 'Enregistrer')}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* ====== Tableau des modules existants ====== */}
        {loading ? (
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div className="col-num">#</div>
              <div className="col-titre">Titre</div>
              <div className="col-pack">Parcours</div>
              <div className="col-duree">Durée</div>
              <div className="col-video">Vidéo</div>
              <div className="col-actions" />
            </div>
            {formations.length === 0 && (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                Aucun module pour l'instant.
              </p>
            )}
            {formations.map((f) => (
              <div className="admin-table-row" key={f.id}>
                <div className="col-num">{String(f.ordre).padStart(2, '0')}</div>
                <div className="col-titre">{f.titre}</div>
                <div className="col-pack">
                  <span className={`pack-badge pack-${f.pack_required}`}>
                    {PACK_LABELS[f.pack_required]}
                  </span>
                </div>
                <div className="col-duree">{f.duree_min ? `${f.duree_min} min` : '—'}</div>
                <div className="col-video">
                  {f.video_youtube_id ? (
                    <span className="video-ok">✓ {f.video_youtube_id}</span>
                  ) : (
                    <span className="video-pending">Bientôt</span>
                  )}
                </div>
                <div className="col-actions">
                  <button className="link-btn" onClick={() => startEdit(f)}>Éditer</button>
                  <button className="link-btn link-btn-danger" onClick={() => handleDelete(f)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ====== Section Adhérents (placeholder Session 4) ====== */}
      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Adhérents</h2>
        </div>
        <div className="placeholder-block">
          <span className="badge">Session 4</span>
          <p>Gestion des adhérents (création, attribution de parcours, suppression) à venir.</p>
        </div>
      </section>
    </div>
  )
}
