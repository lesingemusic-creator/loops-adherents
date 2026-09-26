<?php
/* =========================================================
   Communaute maison : mails recapitulatifs
   ---------------------------------------------------------
   Prevenir par mail un membre qui a, depuis plus de 10 minutes, un
   message prive, une mention, une reponse a son message ou une annonce
   de Jerome qu'il n'a pas lu. Un seul mail par passage et par personne.

   Lance par le cron Hostinger (ligne de commande, toutes les 15 min),
   ou en HTTP avec l'en-tete X-Cle (cle serveur) pour un test.
   Ecrit _lp_backstage/notifs-heartbeat.json a chaque passage :
   communaute-sante.php le relit, et le keep-alive GitHub crie si le
   dernier passage date de plus de deux heures.
   ========================================================= */

require __DIR__ . '/_commun.php';

$cfg = lp_config();
$cli = PHP_SAPI === 'cli';

if (!$cli) {
    $cle = $_SERVER['HTTP_X_CLE'] ?? '';
    if (!hash_equals((string) $cfg['cle_serveur'], (string) $cle)) {
        lp_json(403, ['erreur' => 'interdit']);
    }
}

function battement(array $etat) {
    @file_put_contents(LP_DOSSIER_SECRETS . '/notifs-heartbeat.json',
        json_encode($etat + ['le' => date('c')], JSON_UNESCAPED_UNICODE), LOCK_EX);
}

if (empty($cfg['mail_actif'])) {
    battement(['ok' => true, 'envoyes' => 0, 'note' => 'mails coupes']);
    lp_json(200, ['envoyes' => 0, 'raison' => 'mails coupes']);
}

[$code, $lignes] = lp_rpc('comm_notifs_a_envoyer', ['p_cle' => $cfg['cle_serveur']]);
if ($code !== 200 || !is_array($lignes)) {
    battement(['ok' => false, 'erreur' => 'rpc ' . $code]);
    error_log('[communaute-notifs] rpc ' . $code);
    lp_json(502, ['erreur' => 'rpc ' . $code]);
}

$url = $cfg['url_backstage'] . '/communaute';
$envoyes = 0;
$echecs = 0;

foreach ($lignes as $l) {
    $email = (string) ($l['email'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
    $prenom = trim((string) ($l['prenom'] ?? ''));
    $nb = (int) ($l['nb'] ?? 0);
    $details = is_array($l['details'] ?? null) ? $l['details'] : [];

    $lignesTexte = [];
    $lignesHtml = [];
    foreach (array_slice($details, 0, 6) as $d) {
        $de = (string) ($d['de'] ?? 'Quelqu\'un');
        $extrait = trim((string) ($d['extrait'] ?? ''));
        if (mb_strlen($extrait) >= 160) $extrait .= '...';
        switch ($d['type'] ?? '') {
            case 'prive':   $quoi = "$de t'a écrit en privé"; break;
            case 'mention': $quoi = "$de t'a mentionné dans #" . ($d['salon'] ?? ''); break;
            case 'reponse': $quoi = "$de a répondu à ton message dans #" . ($d['salon'] ?? ''); break;
            case 'annonce': $quoi = "Nouvelle publication de $de dans #" . ($d['salon'] ?? ''); break;
            default:        $quoi = "Nouveau message de $de";
        }
        $lignesTexte[] = "- $quoi" . ($extrait !== '' ? " : « $extrait »" : '');
        $lignesHtml[] = '<tr><td style="padding:10px 0;border-bottom:1px solid #262626;font-size:14px;line-height:1.5;color:#cfcfcf">'
            . '<strong style="color:#fff">' . htmlspecialchars($quoi, ENT_QUOTES, 'UTF-8') . '</strong>'
            . ($extrait !== '' ? '<br><span style="color:#9a9a9a">« ' . htmlspecialchars($extrait, ENT_QUOTES, 'UTF-8') . ' »</span>' : '')
            . '</td></tr>';
    }
    if (count($details) > 6) {
        $reste = count($details) - 6;
        $lignesTexte[] = "- et $reste autre" . ($reste > 1 ? 's' : '');
    }

    $salut = $prenom !== '' ? "Salut $prenom" : 'Salut';
    $sujet = $nb > 1 ? "$nb nouveaux messages pour toi dans la Communauté" : 'Un nouveau message pour toi dans la Communauté';
    $texte = "$salut,\n\n" . implode("\n", $lignesTexte)
        . "\n\nPour répondre : $url\n\nTu peux couper ces mails dans ton Profil du Backstage.\n\nLoops & Play";

    $p = htmlspecialchars($salut, ENT_QUOTES, 'UTF-8');
    $u = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    $corps = implode('', $lignesHtml);
    $html = <<<HTML
<!doctype html><html lang="fr"><body style="margin:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td style="padding-bottom:20px;font-size:20px;font-weight:bold">Loops <span style="color:#FFE713">//</span> Play</td></tr>
<tr><td style="background:#141414;border:1px solid #262626;border-radius:12px;padding:26px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FFE713">Communauté</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#fff">$p, on t'attend dans la Communauté.</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">$corps</table>
<p style="margin:22px 0 6px"><a href="$u" style="display:inline-block;background:#FFE713;color:#0a0a0a;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Répondre</a></p>
</td></tr>
<tr><td style="padding:16px 4px 0;font-size:12px;color:#6b6b6b">Tu reçois ce mail parce qu'on t'a écrit dans la Communauté du Backstage Loops &amp; Play. Tu peux couper ces mails dans ton Profil.</td></tr>
</table></td></tr></table></body></html>
HTML;

    if (lp_mail($email, $sujet, $html, $texte)) {
        $envoyes++;
    } else {
        $echecs++;
        error_log('[communaute-notifs] echec pour ' . $email);
    }
}

battement(['ok' => $echecs === 0, 'envoyes' => $envoyes, 'echecs' => $echecs]);
lp_json(200, ['envoyes' => $envoyes, 'echecs' => $echecs]);
