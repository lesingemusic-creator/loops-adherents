/**
 * Tutoriel de premiere ouverture (29/09/2026).
 * Le « deja vu » est garde par appareil et par compte : sur un nouveau
 * telephone ou dans l'appli installee, l'eleve le revoit une fois.
 * Il se relance a tout moment depuis la page Aide.
 */

const cle = (uid) => `lp-tuto-vu-${uid || 'anonyme'}`

export function tutoVu(uid) {
  try { return localStorage.getItem(cle(uid)) === '1' } catch { return true }
}

export function marquerTutoVu(uid) {
  try { localStorage.setItem(cle(uid), '1') } catch { /* stockage bloque : tant pis */ }
}

export function lancerTutoriel() {
  window.dispatchEvent(new Event('lp-tuto'))
}

// Chaque etape vise un element marque data-tuto="...". Une etape dont la
// cible est absente (appli deja installee, ecran trop etroit) est sautee.
export const ETAPES = [
  {
    titre: 'Bienvenue dans le Backstage 🎧',
    texte: "Ton espace d'élève Loops & Play. On fait le tour en 30 secondes, promis.",
  },
  {
    cible: 'formations',
    titre: 'Formations',
    texte: 'Tes cours vidéo, rangés par bloc. Un module grisé « Bientôt disponible » arrive très vite : il s\'ouvrira tout seul.',
  },
  {
    cible: 'calendrier',
    titre: 'Calendrier',
    texte: 'Réserve ton créneau de cours au studio avec Jérôme, en deux clics.',
  },
  {
    cible: 'cours-filme',
    titre: 'Mon cours filmé',
    texte: 'Tes séances filmées arrivent ici après ton cours. Pense à les télécharger.',
  },
  {
    cible: 'communaute',
    titre: 'Communauté',
    texte: 'Les annonces de Jérôme en stories, le défi de la semaine, et tes mix à partager. Un point jaune = du nouveau.',
  },
  {
    cible: 'ressources',
    titre: 'Ressources',
    texte: 'Sample packs, sorties du label et bons plans pour produire.',
  },
  {
    cible: 'profil',
    titre: 'Profil',
    texte: 'Ton pseudo DJ, ta photo et tes liens. Tu choisis aussi ici les mails que tu reçois.',
  },
  {
    cible: 'installer',
    titre: "L'appli",
    texte: "Mets le Backstage sur ton écran d'accueil, comme une vraie appli. Gratuit, sans store.",
  },
  {
    cible: 'aide',
    titre: 'Une question ?',
    texte: "L'aide est ici, avec une barre de recherche. Tu peux aussi y relancer ce tutoriel quand tu veux.",
  },
]
