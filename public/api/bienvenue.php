<?php
/* =========================================================
   Mail de bienvenue, envoye une seule fois apres la 1re connexion.
   Brief Jerome, section 3 : "des la premiere connexion de l'eleve,
   son compte passe au statut active et declenche automatiquement un
   email de bienvenue". Texte a faire valider par Jerome.

   L'app appelle ce script a chaque connexion tant que la fiche n'a pas
   de date d'envoi. Tant que les mails sont coupes (SPF), rien n'est
   reserve : l'eleve le recevra a sa prochaine connexion une fois
   l'envoi active.
   ========================================================= */

require __DIR__ . '/_commun.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    lp_json(405, ['erreur' => 'POST attendu']);
}

$jeton = lp_jeton_utilisateur();
$cfg   = lp_config();

if (empty($cfg['mail_actif'])) {
    lp_json(200, ['envoye' => false, 'raison' => 'mails coupes']);
}

[$code, $lignes] = lp_rpc('reserver_mail_bienvenue', [], $jeton);
if ($code !== 200) {
    lp_json(502, ['erreur' => 'reservation impossible']);
}
if (empty($lignes[0]['email'])) {
    lp_json(200, ['envoye' => false, 'raison' => 'deja envoye']);
}

$email  = $lignes[0]['email'];
$prenom = trim((string) ($lignes[0]['prenom'] ?? ''));
$url    = $cfg['url_backstage'];
$salut  = $prenom !== '' ? 'Salut ' . $prenom : 'Salut';
$p      = htmlspecialchars($salut, ENT_QUOTES, 'UTF-8');
$u      = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');

$sujet = 'Bienvenue dans le Backstage Loops & Play';

$texte = <<<TXT
$salut,

Ton compte Backstage est actif. C'est ton espace d'élève Loops & Play, tout est au même endroit :

- Formations : les vidéos de tes blocs, module par module, avec les PDF à télécharger.
- Calendrier : tu réserves tes séances au studio.
- Mon cours filmé : tes séances filmées au studio apparaissent ici. Une pastille te prévient quand une nouvelle vidéo arrive.
- Communauté : tu retrouves les autres élèves, pour échanger, partager tes mix et demander des retours.
- Profil : ton pseudo DJ, ta photo, tes liens SoundCloud, Insta, TikTok.

Pour revenir : $url
Tu te connectes avec l'email et le mot de passe que je t'ai envoyés.
Pour l'avoir en appli sur ton téléphone (gratuit, sans store) : $url/installer

Une question, un souci de connexion : écris-moi sur WhatsApp au 07 59 54 15 45.

À très vite au studio,
Jérôme
Loops & Play, Lyon 7e
TXT;

$html = <<<HTML
<!doctype html><html lang="fr"><body style="margin:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td style="padding-bottom:24px;font-size:20px;font-weight:bold;letter-spacing:.5px">Loops <span style="color:#FFE713">//</span> Play</td></tr>
<tr><td style="background:#141414;border:1px solid #262626;border-radius:12px;padding:28px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FFE713">Backstage</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#ffffff">$p, ton compte est actif.</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#cfcfcf">C'est ton espace d'élève Loops &amp; Play. Tout est au même endroit :</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.55;color:#cfcfcf">
<tr><td style="padding:0 0 10px"><strong style="color:#fff">Formations</strong> : les vidéos de tes blocs, module par module, avec les PDF à télécharger.</td></tr>
<tr><td style="padding:0 0 10px"><strong style="color:#fff">Calendrier</strong> : tu réserves tes séances au studio.</td></tr>
<tr><td style="padding:0 0 10px"><strong style="color:#fff">Mon cours filmé</strong> : tes séances filmées au studio. Une pastille te prévient quand une nouvelle vidéo arrive.</td></tr>
<tr><td style="padding:0 0 10px"><strong style="color:#fff">Communauté</strong> : tu retrouves les autres élèves, pour échanger, partager tes mix et demander des retours.</td></tr>
<tr><td style="padding:0 0 10px"><strong style="color:#fff">Profil</strong> : ton pseudo DJ, ta photo, tes liens SoundCloud, Insta, TikTok.</td></tr>
</table>
<p style="margin:22px 0"><a href="$u" style="display:inline-block;background:#FFE713;color:#0a0a0a;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px">Entrer dans le Backstage</a></p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#cfcfcf"><strong style="color:#fff">L'appli sur ton téléphone :</strong> ouvre <a href="$u/installer" style="color:#FFE713">$u/installer</a> et suis les 3 gestes. Gratuit, sans passer par un store.</p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#9a9a9a">Tu te connectes avec l'email et le mot de passe que je t'ai envoyés. Un souci de connexion : écris-moi sur WhatsApp au 07 59 54 15 45.</p>
<p style="margin:18px 0 0;font-size:15px;color:#cfcfcf">À très vite au studio,<br><strong style="color:#fff">Jérôme</strong></p>
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;color:#6b6b6b">Loops &amp; Play, école de DJ et de MAO, Lyon 7e. Tu reçois ce mail parce que ton compte Backstage vient d'être activé.</td></tr>
</table></td></tr></table></body></html>
HTML;

$ok = lp_mail($email, $sujet, $html, $texte, $cfg['mail_jerome']);

if (!$ok) {
    // On rend la main : l'envoi sera retente a la prochaine connexion.
    lp_rpc('annuler_mail_bienvenue', [], $jeton);
    error_log('[backstage] echec du mail de bienvenue pour ' . $email);
    lp_json(502, ['envoye' => false, 'raison' => 'echec envoi']);
}

lp_json(200, ['envoye' => true]);
