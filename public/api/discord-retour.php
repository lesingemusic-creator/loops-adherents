<?php
/* =========================================================
   Retour de Discord apres le clic "Autoriser" (onglet Communaute)
   ---------------------------------------------------------
   Brief Jerome, section 3 : popup OAuth2, ajout automatique au serveur
   (scope guilds.join), sans lien d'invitation. Le role @Actif reste
   donne a la main par Jerome : ici, le membre arrive sans role.

   Le membre est renomme avec son nom Backstage (pseudo DJ sinon nom),
   pour que Jerome sache a qui donner @Actif.
   ========================================================= */

require __DIR__ . '/_commun.php';

function fin(bool $ok, string $message) {
    $payload = json_encode(['source' => 'lp-discord', 'ok' => $ok, 'message' => $message],
        JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    $m = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo <<<HTML
<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Discord</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#f2f2f2;font-family:Arial,sans-serif;text-align:center;padding:24px">
<p style="max-width:360px;line-height:1.5">$m</p>
<script>
try { if (window.opener) { window.opener.postMessage($payload, location.origin); setTimeout(function(){ window.close(); }, 600); } } catch (e) {}
</script></body></html>
HTML;
    exit;
}

$d = lp_discord();
if ($d === null) {
    fin(false, 'La connexion Discord n\'est pas encore branchée. Préviens Jérôme.');
}

if (isset($_GET['error'])) {
    fin(false, 'Autorisation annulée. Tu peux réessayer quand tu veux depuis l\'onglet Communauté.');
}

$codeOauth = (string) ($_GET['code'] ?? '');
$jeton     = (string) ($_GET['state'] ?? '');
if ($codeOauth === '' || !preg_match('/^[a-f0-9]{36}$/', $jeton)) {
    fin(false, 'Lien incomplet. Relance depuis l\'onglet Communauté.');
}

$cfg = lp_config();

// 1) Code -> jeton d'acces de l'eleve
[$code, $tok] = lp_http('POST', 'https://discord.com/api/v10/oauth2/token',
    ['Content-Type: application/x-www-form-urlencoded'],
    http_build_query([
        'grant_type'    => 'authorization_code',
        'code'          => $codeOauth,
        'redirect_uri'  => $cfg['url_backstage'] . '/api/discord-retour.php',
        'client_id'     => $d['client_id'],
        'client_secret' => $d['client_secret'],
    ], '', '&'));
if ($code !== 200 || empty($tok['access_token'])) {
    error_log('[discord] echange du code : ' . $code);
    fin(false, 'Discord n\'a pas validé la demande. Réessaie dans un instant.');
}

// 2) Qui est-ce ?
[$code, $moi] = lp_http('GET', 'https://discord.com/api/v10/users/@me',
    ['Authorization: Bearer ' . $tok['access_token']]);
if ($code !== 200 || empty($moi['id'])) {
    fin(false, 'Impossible de lire ton compte Discord. Réessaie.');
}
$pseudo = (string) ($moi['global_name'] ?? $moi['username'] ?? '');

// 3) Lien avec la fiche Backstage (jeton a usage unique)
[$code, $nom] = lp_rpc('discord_lier', [
    'p_cle' => $cfg['cle_serveur'], 'p_jeton' => $jeton,
    'p_discord_id' => (string) $moi['id'], 'p_pseudo' => (string) ($moi['username'] ?? $pseudo),
]);
if ($code !== 200) {
    fin(false, 'Ta session a expiré. Ferme cette fenêtre et reclique sur « Rejoindre le Discord ».');
}
$surnom = mb_substr(trim((string) $nom) !== '' ? (string) $nom : $pseudo, 0, 32);

// 4) Ajout au serveur (201 = ajoute, 204 = deja membre)
[$code] = lp_http('PUT',
    'https://discord.com/api/v10/guilds/' . $d['guild_id'] . '/members/' . $moi['id'],
    ['Authorization: Bot ' . $d['bot_token'], 'Content-Type: application/json'],
    json_encode(['access_token' => $tok['access_token'], 'nick' => $surnom], JSON_UNESCAPED_UNICODE));

if ($code === 201) {
    fin(true, 'C\'est fait, tu es sur le serveur Loops & Play. Ouvre Discord : Jérôme t\'ouvre les salons élèves très vite.');
}
if ($code === 204) {
    fin(true, 'Tu étais déjà sur le serveur, tout est en ordre.');
}
error_log('[discord] ajout au serveur : ' . $code);
fin(false, 'Discord a refusé l\'ajout au serveur. Préviens Jérôme, il vérifie les droits du bot.');
