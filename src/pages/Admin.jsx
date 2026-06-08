import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const PACKS = ['demo', 'resident', 'headliner']
const PACK_LABELS = { demo: 'Démo', resident: 'Résident', headliner: 'Headliner' }
const CATEGORIES = [
  { value: 'mix', label: 'Cours de Mix' },
  { value: 'mao', label: 'Cours de MAO' },
]
const BUCKET = 'formation-documents'

const EMPTY_FORM = {
  ordre: 1,
  pack_required: 'demo',
  categorie: 'mix',
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

  // ------- Documents (PDFs) attachés au module en cours d'édition -------
  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase
      .from('formations')
      .select('*')
      .order('ordre')
    if (!error) setFormations(data || [])
    setLoading(false)
  }

  async function loadDocuments(formationId) {
    if (!formationId || formationId === 'new') {
      setDocuments([])
      return
    }
    const { data, error } = await supabase
      .from('formation_documents')
      .select('*')
      .eq('formation_id', formationId)
      .order('ordre', { ascending: true })
    if (!error) setDocuments(data || [])
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
      categorie: f.categorie || 'mix',
      titre: f.titre,
      description: f.description || '',
      duree_min: f.duree_min ?? '',
      video_youtube_id: f.video_youtube_id || '',
    })
    loadDocuments(f.id)
    setFeedback(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startCreate() {
    setEditingId('new')
    const nextOrdre = (formations[formations.length - 1]?.ordre || 0) + 1
    setForm({ ...EMPTY_FORM, ordre: nextOrdre })
    setDocuments([])
    setFeedback(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDocuments([])
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
      categorie: form.categorie,
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
      // En mode création, on garde la formation ouverte pour permettre l'upload de PDFs
      if (editingId === 'new') {
        setEditingId(result.data.id)
        loadDocuments(result.data.id)
      } else {
        cancelEdit()
      }
    }
    setSaving(false)
  }

  async function handleDelete(f) {
    if (!confirm(`Supprimer définitivement le module "${f.titre}" ? La progression des adhérents et les documents associés seront aussi effacés.`)) return
    const { error } = await supabase.from('formations').delete().eq('id', f.id)
    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      setFeedback({ type: 'ok', msg: 'Module supprimé.' })
      await refresh()
    }
  }

  // ------- Upload PDF -------
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !editingId || editingId === 'new') return
    setUploadingDoc(true)
    setFeedback(null)

    const errors = []
    for (const file of files) {
      // Validation taille (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name} dépasse 50 MB`)
        continue
      }
      // Validation type
      if (file.type !== 'application/pdf') {
        errors.push(`${file.name} n'est pas un PDF`)
        continue
      }

      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const path = `formations/${editingId}/${Date.now()}_${cleanName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        })

      if (uploadError) {
        errors.push(`${file.name} : ${uploadError.message}`)
        continue
      }

      // Insert dans la table formation_documents
      const { error: insertError } = await supabase
        .from('formation_documents')
        .insert({
          formation_id: editingId,
          titre: file.name.replace(/\.pdf$/i, ''),
          fichier_path: path,
          taille_kb: Math.round(file.size / 1024),
          ordre: documents.length + 1,
        })

      if (insertError) {
        errors.push(`${file.name} : ${insertError.message}`)
      }
    }

    await loadDocuments(editingId)
    setUploadingDoc(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (errors.length) {
      setFeedback({ type: 'error', msg: errors.join(' • ') })
    } else {
      setFeedback({ type: 'ok', msg: `${files.length} document${files.length > 1 ? 's' : ''} ajouté${files.length > 1 ? 's' : ''}.` })
    }
  }

  async function handleDocDelete(doc) {
    if (!confirm(`Supprimer le document "${doc.titre}" ?`)) return

    // Suppression du fichier dans Storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.fichier_path])

    if (storageError) {
      console.warn('[storage] delete error:', storageError)
    }

    // Suppression de l'entrée DB
    const { error } = await supabase
      .from('formation_documents')
      .delete()
      .eq('id', doc.id)

    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      await loadDocuments(editingId)
      setFeedback({ type: 'ok', msg: 'Document supprimé.' })
    }
  }

  async function handleDocRename(doc) {
    const newTitle = prompt('Nouveau titre du document :', doc.titre)
    if (!newTitle || newTitle === doc.titre) return
    const { error } = await supabase
      .from('formation_documents')
      .update({ titre: newTitle.trim() })
      .eq('id', doc.id)
    if (error) {
      setFeedback({ type: 'error', msg: error.message })
    } else {
      await loadDocuments(editingId)
    }
  }

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Panel admin</p>
        <h1 className="app-page-title">Gestion de l'espace</h1>
        <p className="app-page-subtitle">
          Tu peux gérer les modules de formation ici. Les adhérents verront uniquement les modules de leur catégorie et de leur niveau.
        </p>
      </header>

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
                <span>Catégorie</span>
                <select
                  value={form.categorie}
                  onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Niveau requis</span>
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
                Laisse vide tant que la vidéo n'est pas tournée.
              </small>
            </label>

            {/* ====== Section Documents PDF ====== */}
            {editingId !== 'new' && (
              <div className="admin-docs">
                <div className="admin-docs-header">
                  <span>Documents PDF attachés ({documents.length})</span>
                  <label className="btn-secondary admin-docs-upload-btn">
                    {uploadingDoc ? 'Upload…' : '+ Ajouter PDF'}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploadingDoc}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {documents.length === 0 ? (
                  <p className="admin-docs-empty">Aucun PDF pour l'instant. Tu peux en ajouter plusieurs à la fois.</p>
                ) : (
                  <ul className="admin-docs-list">
                    {documents.map((doc) => (
                      <li key={doc.id} className="admin-docs-item">
                        <div className="admin-docs-item-info">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span className="admin-docs-item-title">{doc.titre}</span>
                          {doc.taille_kb && (
                            <span className="admin-docs-item-size">{Math.round(doc.taille_kb / 1024 * 10) / 10} MB</span>
                          )}
                        </div>
                        <div className="admin-docs-item-actions">
                          <button type="button" className="link-btn" onClick={() => handleDocRename(doc)}>Renommer</button>
                          <button type="button" className="link-btn link-btn-danger" onClick={() => handleDocDelete(doc)}>Supprimer</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {editingId === 'new' && (
              <div className="admin-docs-hint">
                <small>💡 Crée d'abord le module, puis tu pourras lui attacher des PDFs.</small>
              </div>
            )}

            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : (editingId === 'new' ? 'Créer le module' : 'Enregistrer')}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                {editingId === 'new' ? 'Annuler' : 'Fermer'}
              </button>
            </div>
          </form>
        )}

        {/* ====== Tableau des modules ====== */}
        {loading ? (
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div className="col-num">#</div>
              <div className="col-titre">Titre</div>
              <div className="col-cat">Cat.</div>
              <div className="col-pack">Niveau</div>
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
                <div className="col-cat">
                  <span className={`cat-badge cat-${f.categorie || 'mix'}`}>
                    {f.categorie === 'mao' ? 'MAO' : 'MIX'}
                  </span>
                </div>
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

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Adhérents</h2>
        </div>
        <div className="placeholder-block">
          <span className="badge">Session 4</span>
          <p>Gestion des adhérents (création, attribution mix_pack / mao_pack, suppression) à venir.</p>
        </div>
      </section>
    </div>
  )
}
