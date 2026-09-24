/**
 * Outils pour les liens Google Drive.
 *
 * Jerome colle le lien de partage tel que Drive le lui donne. Ce lien ouvre
 * une page Drive, il ne se lit pas dans un lecteur embarque. On en extrait
 * l'identifiant du fichier pour construire l'URL /preview, qui elle
 * s'affiche dans une iframe.
 */

/**
 * Extrait l'identifiant d'un fichier Drive, quel que soit le format du lien.
 * Renvoie null si on ne reconnait rien.
 */
export function extraireIdDrive(url) {
  if (typeof url !== 'string') return null
  const u = url.trim()
  if (!u) return null

  const motifs = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,   // .../file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]{10,})/,       // .../open?id=ID
    /\/d\/([a-zA-Z0-9_-]{10,})/,         // .../d/ID/...
  ]

  for (const motif of motifs) {
    const trouve = u.match(motif)
    if (trouve) return trouve[1]
  }

  // Cas ou Jerome colle uniquement l'identifiant
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) return u

  return null
}

/** URL a mettre dans l'iframe du lecteur. null si le lien n'est pas reconnu. */
export function urlLecteurDrive(url) {
  const id = extraireIdDrive(url)
  return id ? `https://drive.google.com/file/d/${id}/preview` : null
}

/** URL de telechargement direct. null si le lien n'est pas reconnu. */
export function urlTelechargementDrive(url) {
  const id = extraireIdDrive(url)
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null
}

/**
 * Nombre de jours restants avant la date passee.
 * Renvoie null si pas de date. Peut etre negatif si la date est passee.
 */
export function joursRestants(dateIso) {
  if (!dateIso) return null
  const cible = new Date(dateIso + 'T23:59:59')
  if (Number.isNaN(cible.getTime())) return null
  const diff = cible.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Fin de la fenetre de telechargement : 15 jours apres la fin du pack.
 * Regle fixee par le brief Jerome du 18/09/2026, section 4.
 */
export const JOURS_APRES_FIN_PACK = 15

export function dateLimiteTelechargement(finPack) {
  if (!finPack) return null
  const d = new Date(finPack + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + JOURS_APRES_FIN_PACK)

  // Surtout pas toISOString() ici : la date est construite en heure locale,
  // et toISOString la repasse en UTC. En France (UTC+1 ou +2), minuit local
  // devient la veille 22h ou 23h en UTC, et l'eleve voit un jour de moins
  // que ce a quoi il a droit. On reformate donc a la main.
  const an = d.getFullYear()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${an}-${mois}-${jour}`
}

/** "12 septembre 2026" a partir de "2026-09-12". */
export function formaterDate(dateIso) {
  if (!dateIso) return ''
  const d = new Date(dateIso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
