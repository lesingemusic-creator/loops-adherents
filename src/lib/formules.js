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
  visio219: { label: 'MAO en visio', prix: '219 €', discipline: 'mao' },
}

export const DISCIPLINES = { dj: 'DJ', mao: 'MAO', les_deux: 'DJ et MAO' }

// Les modules sont ranges en 3 blocs. pack_required garde ses anciennes
// valeurs en base : demo = bloc 1, resident = bloc 2, headliner = bloc 3.
export const BLOCS = { demo: 'Bloc 1', resident: 'Bloc 2', headliner: 'Bloc 3' }

// Acces aux videos d'une discipline (mix_pack / mao_pack). Depuis le 01/10/2026,
// la formation en ligne est un produit a part : plus de niveau par pack, c'est
// tout ou rien. Seuls les cours en ligne l'ouvrent ; Jerome peut l'ouvrir a la main.
export const NIVEAUX_ACCES = [
  { value: '', label: 'Aucun accès' },
  { value: 'headliner', label: 'Accès complet' },
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
