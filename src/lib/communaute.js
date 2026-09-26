import { supabase } from './supabase'

/**
 * Outils de la Communaute maison (plan B, 26/09/2026).
 * Annuaire des membres, fichiers (bucket prive), liens integres.
 */

export const BUCKET = 'communaute'
export const TAILLE_MAX_MO = 25
export const EMOJIS = ['🔥', '👍', '❤️', '😂', '🎧', '🙌', '👀', '💯']

export const CATEGORIES = [
  { cle: 'info', label: 'Info' },
  { cle: 'communaute', label: 'Communauté' },
  { cle: 'bonus', label: 'Bonus' },
]

/* ---------- Membres ---------- */

let cacheMembres = null

export async function chargerMembres(force = false) {
  if (cacheMembres && !force) return cacheMembres
  const { data, error } = await supabase.rpc('comm_membres')
  if (error) throw error
  cacheMembres = Object.fromEntries((data || []).map((m) => [m.id, m]))
  return cacheMembres
}

export function nomAffiche(m) {
  if (!m) return 'Ancien membre'
  return m.pseudo_dj || m.nom || 'Membre'
}

/* ---------- Fichiers ---------- */

const cacheUrls = new Map()

export async function urlFichier(chemin) {
  if (!chemin) return null
  const c = cacheUrls.get(chemin)
  if (c && c.expire > Date.now()) return c.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 3600)
  if (error) return null
  cacheUrls.set(chemin, { url: data.signedUrl, expire: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}

export async function deposerFichier(userId, fichier) {
  if (fichier.size > TAILLE_MAX_MO * 1024 * 1024) {
    throw new Error(`Fichier trop lourd : ${TAILLE_MAX_MO} Mo maximum. Pour un mix complet, colle plutôt ton lien SoundCloud.`)
  }
  const propre = fichier.name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
  const chemin = `${userId}/${crypto.randomUUID()}-${propre}`
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    contentType: fichier.type || undefined,
    upsert: false,
  })
  if (error) {
    throw new Error(error.message.includes('mime')
      ? 'Ce type de fichier n\'est pas accepté. Audio, image ou PDF uniquement.'
      : 'Envoi du fichier impossible : ' + error.message)
  }
  return { fichier_chemin: chemin, fichier_type: fichier.type, fichier_nom: fichier.name, fichier_taille: fichier.size }
}

export function tailleLisible(o) {
  if (!o) return ''
  if (o < 1024 * 1024) return Math.round(o / 1024) + ' Ko'
  return (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'
}

/* ---------- Liens integres ---------- */

const RE_URL = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g

export function premierLienIntegrable(texte) {
  const urls = texte?.match(RE_URL) || []
  for (const u of urls) {
    if (/soundcloud\.com\//i.test(u)) {
      return { type: 'soundcloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23ffe713&auto_play=false&hide_related=true&show_comments=false&visual=false` }
    }
    const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i)
    if (yt) return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
    const sp = u.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([\w]+)/i)
    if (sp) return { type: 'spotify', src: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}` }
  }
  return null
}

/** Decoupe un texte en morceaux : texte, lien, mention. */
export function morceaux(texte, membres) {
  if (!texte) return []
  const pseudos = Object.values(membres || {})
    .map((m) => nomAffiche(m))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const reMention = pseudos.length ? `@(?:${pseudos.join('|')})` : '@\\u0000'
  const re = new RegExp(`(https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]'"])|(${reMention})`, 'g')
  const out = []
  let dernier = 0
  let m
  while ((m = re.exec(texte)) !== null) {
    if (m.index > dernier) out.push({ t: 'texte', v: texte.slice(dernier, m.index) })
    if (m[1]) out.push({ t: 'lien', v: m[1] })
    else out.push({ t: 'mention', v: m[2] })
    dernier = m.index + m[0].length
  }
  if (dernier < texte.length) out.push({ t: 'texte', v: texte.slice(dernier) })
  return out
}

/* ---------- Dates ---------- */

export function heure(iso) {
  const d = new Date(iso)
  const auj = new Date()
  const hier = new Date(Date.now() - 86400000)
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === auj.toDateString()) return hm
  if (d.toDateString() === hier.toDateString()) return 'hier ' + hm
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + hm
}

export function jourSeparateur(iso) {
  const d = new Date(iso)
  const auj = new Date()
  if (d.toDateString() === auj.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
