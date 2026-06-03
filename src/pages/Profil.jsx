import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import '../styles/profil.css'

const MAX_AVATAR_MB = 2

export default function Profil() {
  const { user, profile, refreshProfile } = useAuth()

  const [form, setForm] = useState({
    nom: '',
    pseudo_dj: '',
    bio: '',
    lien_soundcloud: '',
    lien_instagram: '',
    lien_tiktok: '',
  })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'success' | 'error', text }

  // Hydrate le form depuis le profil
  useEffect(() => {
    if (profile) {
      setForm({
        nom: profile.nom || '',
        pseudo_dj: profile.pseudo_dj || '',
        bio: profile.bio || '',
        lien_soundcloud: profile.lien_soundcloud || '',
        lien_instagram: profile.lien_instagram || '',
        lien_tiktok: profile.lien_tiktok || '',
      })
      setAvatarPreview(profile.photo_url || null)
    }
  }, [profile])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'Le fichier doit être une image (jpg, png, webp).' })
      return
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setMsg({ type: 'error', text: `Image trop lourde. Max ${MAX_AVATAR_MB} Mo.` })
      return
    }
    setMsg(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar() {
    if (!avatarFile || !user) return null
    const ext = avatarFile.name.split('.').pop().toLowerCase()
    const path = `${user.id}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: false, cacheControl: '3600' })

    if (uploadError) {
      throw new Error('Upload photo : ' + uploadError.message)
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)

    try {
      // Upload photo si nouvelle
      let photoUrl = profile?.photo_url || null
      if (avatarFile) {
        photoUrl = await uploadAvatar()
      }

      const updates = {
        nom: form.nom.trim() || null,
        pseudo_dj: form.pseudo_dj.trim() || null,
        bio: form.bio.trim() || null,
        lien_soundcloud: form.lien_soundcloud.trim() || null,
        lien_instagram: form.lien_instagram.trim() || null,
        lien_tiktok: form.lien_tiktok.trim() || null,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (updateError) throw new Error(updateError.message)

      await refreshProfile()
      setAvatarFile(null)
      setMsg({ type: 'success', text: 'Profil sauvegardé. 🎯' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const initial = (form.pseudo_dj || form.nom || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Mon profil</p>
        <h1 className="app-page-title">Ton identité DJ</h1>
        <p className="app-page-subtitle">Ces infos seront visibles sur ton profil dans l'espace adhérent.</p>
      </header>

      <form className="profil-form" onSubmit={handleSubmit} noValidate>

        {/* Avatar */}
        <div className="profil-avatar-block">
          <div className="profil-avatar">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="profil-avatar-actions">
            <label htmlFor="avatar-input" className="profil-avatar-btn">
              {avatarPreview ? 'Changer la photo' : 'Ajouter une photo'}
            </label>
            <input id="avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            <p className="profil-hint">JPG, PNG ou WebP. Max {MAX_AVATAR_MB} Mo.</p>
          </div>
        </div>

        {/* Identité */}
        <div className="profil-section">
          <h2 className="profil-section-title">Identité</h2>
          <div className="profil-grid-2">
            <div className="profil-field">
              <label htmlFor="nom">Nom complet</label>
              <input id="nom" type="text" value={form.nom} onChange={(e) => update('nom', e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div className="profil-field">
              <label htmlFor="pseudo_dj">Pseudo DJ</label>
              <input id="pseudo_dj" type="text" value={form.pseudo_dj} onChange={(e) => update('pseudo_dj', e.target.value)} placeholder="DJ Headliner" />
            </div>
          </div>
          <div className="profil-field">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={4}
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              placeholder="Quelques mots sur toi, ton style, tes influences…"
            />
          </div>
        </div>

        {/* Liens sociaux */}
        <div className="profil-section">
          <h2 className="profil-section-title">Liens sociaux</h2>
          <div className="profil-field">
            <label htmlFor="lien_soundcloud">SoundCloud</label>
            <input id="lien_soundcloud" type="url" value={form.lien_soundcloud} onChange={(e) => update('lien_soundcloud', e.target.value)} placeholder="https://soundcloud.com/tonpseudo" />
          </div>
          <div className="profil-field">
            <label htmlFor="lien_instagram">Instagram</label>
            <input id="lien_instagram" type="url" value={form.lien_instagram} onChange={(e) => update('lien_instagram', e.target.value)} placeholder="https://instagram.com/tonpseudo" />
          </div>
          <div className="profil-field">
            <label htmlFor="lien_tiktok">TikTok</label>
            <input id="lien_tiktok" type="url" value={form.lien_tiktok} onChange={(e) => update('lien_tiktok', e.target.value)} placeholder="https://tiktok.com/@tonpseudo" />
          </div>
        </div>

        {/* Message + submit */}
        {msg && <p className={`profil-msg ${msg.type}`}>{msg.text}</p>}

        <div className="profil-actions">
          <button type="submit" className="profil-save" disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  )
}
