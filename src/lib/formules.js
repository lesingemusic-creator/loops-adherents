/**
 * Formules vendues et ce qu'elles ouvrent (reponse de Jerome du 23/09/2026).
 * La correspondance acces <-> formule vit en base, fonction acces_formule :
 * ce fichier ne sert qu'a l'affichage.
 */

export const FORMULES = {
  pack1:  { label: 'Pack 1', prix: '449 €', discipline: 'choix' },
  pack2:  { label: 'Pack 2', prix: '849 €', discipline: 'choix' },
  pack3:  { label: 'Pack 3', prix: '1 490 €', discipline: 'les_deux' },
  annee:  { label: 'Année', prix: '1 349 €', discipline: 'choix' },
  dj119:  { label: 'Cours en ligne DJ', prix: '119 €', discipline: 'dj' },
  mao119: { label: 'Cours en ligne MAO', prix: '119 €', discipline: 'mao' },
}

export const DISCIPLINES = { dj: 'DJ', mao: 'MAO', les_deux: 'DJ et MAO' }

// Les modules sont ranges en 3 blocs. pack_required garde ses anciennes
// valeurs en base : demo = bloc 1, resident = bloc 2, headliner = bloc 3.
export const BLOCS = { demo: 'Bloc 1', resident: 'Bloc 2', headliner: 'Bloc 3' }

// Ce qu'un eleve voit dans une discipline, selon la valeur de mix_pack / mao_pack.
export const NIVEAUX_ACCES = [
  { value: '', label: 'Aucun accès' },
  { value: 'demo', label: 'Bloc 1' },
  { value: 'resident', label: 'Blocs 1 et 2' },
  { value: 'headliner', label: 'Blocs 1 à 3' },
]

export function libelleFormule(profil) {
  if (!profil?.formule) return null
  const f = FORMULES[profil.formule]
  if (!f) return profil.formule
  if (profil.formule === 'annee' || profil.formule === 'pack1' || profil.formule === 'pack2') {
    return profil.discipline ? `${f.label} ${DISCIPLINES[profil.discipline]}` : f.label
  }
  return f.label
}

export const WHATSAPP_JEROME = '33759541545'
