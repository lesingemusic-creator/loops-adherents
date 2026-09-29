/**
 * Aide du Backstage (29/09/2026) : questions frequentes et recherche.
 * Pour ajouter une question : une entree dans FAQ, avec des « mots »
 * (synonymes, fautes courantes) pour que la recherche la trouve.
 * « lien » ouvre une page du Backstage, « action: 'tuto' » relance la visite.
 */

export const CATEGORIES = [
  { id: 'compte', titre: 'Compte et connexion' },
  { id: 'cours', titre: 'Formations et cours' },
  { id: 'communaute', titre: 'Communauté' },
  { id: 'appli', titre: "L'appli et les mails" },
]

export const FAQ = [
  // Compte et connexion
  {
    cat: 'compte',
    q: 'Comment je me connecte au Backstage ?',
    r: "Avec l'adresse mail et le mot de passe reçus après ton inscription. Une fois connecté, le Backstage te garde en mémoire sur cet appareil.",
    mots: 'connexion connecter login identifiant identifiants acces entrer compte',
  },
  {
    cat: 'compte',
    q: "J'ai oublié mon mot de passe, je fais comment ?",
    r: "Sur la page de connexion, touche « Mot de passe oublié ? » : ça ouvre un message WhatsApp pour Jérôme, qui te génère un nouveau mot de passe tout de suite.",
    mots: 'mdp password oublie perdu reinitialiser nouveau bloque',
  },
  {
    cat: 'compte',
    q: 'Comment changer mon pseudo DJ, ma photo ou ma bio ?',
    r: 'Dans Profil : pseudo DJ, photo, bio et tes liens SoundCloud, Instagram, TikTok. Ton pseudo et ta photo s\'affichent dans la Communauté.',
    mots: 'pseudo nom photo avatar image bio profil modifier changer liens soundcloud instagram tiktok',
    lien: { to: '/profil', label: 'Ouvrir mon profil' },
  },
  {
    cat: 'compte',
    q: 'Comment changer de formule ou passer au pack supérieur ?',
    r: 'Écris directement à Jérôme : il ouvre les nouveaux accès sur ton compte, sans que tu perdes ta progression.',
    mots: 'formule pack upgrade changer passer superieur payer paiement prix tarif abonnement',
  },

  // Formations et cours
  {
    cat: 'cours',
    q: 'Pourquoi un module est grisé « Bientôt disponible » ?',
    r: "Jérôme est en train de tourner la vidéo. Le module s'ouvrira tout seul dès qu'elle sera en ligne, tu n'as rien à faire.",
    mots: 'grise bientot disponible module video manquante vide bloque ouvre pas',
  },
  {
    cat: 'cours',
    q: 'Je ne vois pas tous les blocs de cours, c\'est normal ?',
    r: "Ce que tu vois dépend de ta formule (DJ, MAO, et le nombre de blocs). Si un bloc te semble manquer, écris à Jérôme, il vérifie ton accès.",
    mots: 'bloc blocs manque acces formation cours dj mao niveau voir pas',
    lien: { to: '/formations', label: 'Voir mes formations' },
  },
  {
    cat: 'cours',
    q: 'Comment je suis ma progression ?',
    r: 'En bas de chaque module, touche « Marquer comme vu ». Le compteur de chaque bloc avance et le module passe en vert.',
    mots: 'progression vu marquer termine fini avancement suivi compteur',
  },
  {
    cat: 'cours',
    q: 'Comment réserver un cours au studio ?',
    r: 'Page Calendrier : choisis un créneau libre dans le planning de Jérôme, tu reçois la confirmation par mail.',
    mots: 'reserver reservation creneau rdv rendez vous cours studio calendrier planning date heure calendly',
    lien: { to: '/calendrier', label: 'Ouvrir le calendrier' },
  },
  {
    cat: 'cours',
    q: 'Comment annuler ou déplacer un cours ?',
    r: 'Utilise le lien « annuler » ou « reprogrammer » dans le mail de confirmation de ta réservation. En cas de souci, préviens Jérôme sur WhatsApp.',
    mots: 'annuler annulation deplacer decaler reporter reprogrammer changer creneau absent',
  },
  {
    cat: 'cours',
    q: 'Où sont les vidéos de mon cours au studio ?',
    r: "Dans « Mon cours filmé », en général dans les jours qui suivent ton cours. Télécharge-les : elles ne restent en ligne qu'un temps, la date limite s'affiche sur la page.",
    mots: 'video filme filmee seance enregistrement cours telecharger telechargement replay',
    lien: { to: '/mon-cours-filme', label: 'Mon cours filmé' },
  },

  // Communaute
  {
    cat: 'communaute',
    q: 'Comment partager mon mix ou ma prod ?',
    r: "Dans la Communauté, va dans #showcase (ou #feedback-mix si tu veux des retours), touche le bouton pour joindre un fichier et ajoute ton audio, ou colle un lien SoundCloud, YouTube ou Spotify : il s'écoute directement dans le fil.",
    mots: 'partager poster publier mix prod son audio morceau fichier soundcloud youtube spotify envoyer showcase feedback',
    lien: { to: '/communaute', label: 'Aller dans la Communauté' },
  },
  {
    cat: 'communaute',
    q: "C'est quoi le défi de la semaine ?",
    r: "Chaque semaine, Jérôme lance un défi. Poste ta réponse dans le salon indiqué avant la date de fin, la barre montre combien d'élèves l'ont relevé.",
    mots: 'defi challenge semaine relever participer concours',
  },
  {
    cat: 'communaute',
    q: 'Les ronds en haut de la Communauté, c\'est quoi ?',
    r: "Ce sont les stories : les annonces de Jérôme. Un rond jaune, c'est une annonce que tu n'as pas encore vue.",
    mots: 'story stories rond ronds annonce annonces haut jaune',
  },
  {
    cat: 'communaute',
    q: 'Que veut dire la flamme 🔥 et le nombre de jours ?',
    r: "C'est ta série : le nombre de jours d'affilée où tu passes dans le Backstage. Passe chaque jour pour la faire grimper.",
    mots: 'flamme serie jours affilee streak feu compteur',
  },
  {
    cat: 'communaute',
    q: 'Comment envoyer un message privé à un élève ?',
    r: "Dans la Communauté, touche « Écrire à quelqu'un » dans les messages privés et choisis l'élève.",
    mots: 'message prive mp dm ecrire parler contacter eleve discuter conversation',
  },
  {
    cat: 'communaute',
    q: 'Comment signaler un message qui pose problème ?',
    r: 'Touche les trois points « ⋯ » du message, puis « Signaler ». Jérôme est prévenu directement.',
    mots: 'signaler signalement probleme abus insulte spam moderation bloquer',
  },

  // Appli et mails
  {
    cat: 'appli',
    q: 'Comment mettre le Backstage sur mon téléphone ?',
    r: "Pas besoin de store : ouvre la page L'appli et suis les 3 gestes. Sur iPhone, ça passe par Safari, bouton Partager, puis « Sur l'écran d'accueil ».",
    mots: 'appli application installer telephone iphone android ecran accueil store telecharger mobile safari',
    lien: { to: '/installer', label: "Installer l'appli" },
  },
  {
    cat: 'appli',
    q: 'Je ne reçois pas les mails du Backstage',
    r: "Regarde dans tes spams et ajoute no-reply@loopsplay.com à tes contacts. Vérifie aussi dans Profil que la case des mails de la Communauté est cochée.",
    mots: 'mail mails email recois pas spam courrier indesirable notification notifications',
  },
  {
    cat: 'appli',
    q: 'Comment arrêter les mails de la Communauté ?',
    r: 'Dans Profil, décoche « Me prévenir par mail quand on me parle dans la Communauté ».',
    mots: 'arreter couper desactiver stop mails notifications trop desabonner',
    lien: { to: '/profil', label: 'Ouvrir mon profil' },
  },
  {
    cat: 'appli',
    q: 'Comment revoir le tutoriel du début ?',
    r: 'Touche le bouton ci-dessous : la visite guidée repart depuis le Dashboard.',
    mots: 'tutoriel tuto visite guide aide debut revoir comment ca marche decouvrir',
    action: 'tuto',
  },
]

// ---------------------------------------------------------------
// Recherche : sans accent, sans mots vides, avec un radical grossier
// (« telecharger » trouve « telechargement »).
// ---------------------------------------------------------------
const VIDES = new Set(('a au aux avec ce ces c ca comment d de des du elle en est et il j je l la le les leur lui m ma me mes moi mon n ne on ou par pas pour qu que quel quelle qui s sa se ses son sur t ta te tes toi ton tu un une vos votre vous y est-ce faire fait peux peut veux')
  .split(' '))

export function normaliser(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function mots(s) {
  return normaliser(s).split(' ').filter((m) => m.length > 1 && !VIDES.has(m))
}

function radical(m) {
  return m.length > 5 ? m.slice(0, Math.max(5, m.length - 3)) : m
}

function correspond(motQ, motsTexte) {
  const r = radical(motQ)
  return motsTexte.some((t) => t === motQ || (r.length >= 4 && t.startsWith(r)) || (t.length >= 5 && motQ.startsWith(radical(t))))
}

const INDEX = FAQ.map((f) => ({ f, q: mots(f.q), k: mots(f.mots), r: mots(f.r) }))

export function chercher(question) {
  const qm = mots(question)
  if (!qm.length) return []
  return INDEX
    .map(({ f, q, k, r }) => {
      let score = 0
      let trouves = 0
      qm.forEach((m) => {
        const s = (correspond(m, q) ? 3 : 0) + (correspond(m, k) ? 2 : 0) + (correspond(m, r) ? 1 : 0)
        if (s) trouves++
        score += s
      })
      // Bonus quand la plupart des mots de la question sont couverts
      return { f, score: score * (trouves / qm.length) }
    })
    .filter((x) => x.score >= 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.f)
}
