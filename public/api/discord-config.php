<?php
/* =========================================================
   Cles Discord du Backstage
   ---------------------------------------------------------
   GET  : ce que l'app a le droit de savoir (Client ID public, pret ou non).
   POST : Jerome colle ses trois cles depuis son panneau admin. Elles sont
          verifiees aupres de Discord, puis ecrites HORS de la racine web.
          Personne d'autre ne les voit passer, pas meme mfdy.digital.
   ========================================================= */

require __DIR__ . '/_commun.php';

$cfg = lp_config();
$redirect = $cfg['url_backstage'] . '/api/discord-retour.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $d = lp_discord();
    lp_json(200, [
        'pret'         => $d !== null,
        'client_id'    => $d['client_id'] ?? null,
        'redirect_uri' => $redirect,
        'serveur'      => $d['guild_nom'] ?? null,
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    lp_json(405, ['erreur' => 'methode']);
}

lp_exiger_admin(lp_jeton_utilisateur());

$in = json_decode((string) file_get_contents('php://input'), true) ?: [];
$clientId = trim((string) ($in['client_id'] ?? ''));
$secret   = trim((string) ($in['client_secret'] ?? ''));
$bot      = trim((string) ($in['bot_token'] ?? ''));
$guildId  = trim((string) ($in['guild_id'] ?? ''));

if (!preg_match('/^\d{15,22}$/', $clientId) || !preg_match('/^\d{15,22}$/', $guildId)
    || strlen($secret) < 20 || strlen($bot) < 40) {
    lp_json(400, ['erreur' => 'Une des cles a un format inattendu. Vérifie le copier-coller.']);
}

// 1) Le bot existe et appartient bien a cette application
[$code, $moi] = lp_http('GET', 'https://discord.com/api/v10/users/@me', ['Authorization: Bot ' . $bot]);
if ($code !== 200) {
    lp_json(400, ['erreur' => 'Discord refuse le token du bot. Refais « Reset Token » dans l\'onglet Bot et recolle-le.']);
}

// 2) Le bot est bien sur le serveur
[$code, $guild] = lp_http('GET', 'https://discord.com/api/v10/guilds/' . $guildId, ['Authorization: Bot ' . $bot]);
if ($code !== 200) {
    lp_json(400, ['erreur' => 'Le bot n\'est pas sur ton serveur. Refais l\'étape « URL Generator » et invite-le.']);
}

// 3) Le couple Client ID / Secret est valide (echange client_credentials)
[$code] = lp_http('POST', 'https://discord.com/api/v10/oauth2/token',
    ['Content-Type: application/x-www-form-urlencoded'],
    http_build_query(['grant_type' => 'client_credentials', 'scope' => 'identify'], '', '&')
    . '&client_id=' . rawurlencode($clientId) . '&client_secret=' . rawurlencode($secret));
if ($code !== 200) {
    lp_json(400, ['erreur' => 'Le Client ID et le Client Secret ne vont pas ensemble. Refais « Reset Secret » dans OAuth2.']);
}

if (!is_dir(LP_DOSSIER_SECRETS) && !@mkdir(LP_DOSSIER_SECRETS, 0750, true)) {
    lp_json(500, ['erreur' => 'dossier des secrets inaccessible']);
}

$donnees = [
    'client_id'     => $clientId,
    'client_secret' => $secret,
    'bot_token'     => $bot,
    'guild_id'      => $guildId,
    'guild_nom'     => $guild['name'] ?? '',
    'bot_nom'       => $moi['username'] ?? '',
    'enregistre_le' => date('c'),
];
$ok = @file_put_contents(LP_DOSSIER_SECRETS . '/discord.json',
    json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
if ($ok === false) {
    lp_json(500, ['erreur' => 'écriture impossible']);
}
@chmod(LP_DOSSIER_SECRETS . '/discord.json', 0640);

lp_json(200, ['ok' => true, 'serveur' => $donnees['guild_nom'], 'bot' => $donnees['bot_nom']]);
