<?php
/* =========================================================
   Backstage Loops & Play : outils communs des scripts serveur
   ---------------------------------------------------------
   Pose le 25/09/2026 par mfdy.digital.

   Les secrets ne sont JAMAIS dans ce dossier (il est servi en public) :
   ils vivent dans _lp_backstage/, au-dessus de public_html.
     _lp_backstage/config.php   : cle serveur, reglages mail (depose a la main)
     _lp_backstage/discord.json : cles Discord, ecrit par Jerome depuis l'admin
   ========================================================= */

declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === '_commun.php') {
    http_response_code(404);
    exit;
}

const LP_DOSSIER_SECRETS = __DIR__ . '/../../../_lp_backstage';

function lp_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $fichier = LP_DOSSIER_SECRETS . '/config.php';
        if (!is_file($fichier)) {
            error_log('[backstage] config.php introuvable dans ' . LP_DOSSIER_SECRETS);
            lp_json(500, ['erreur' => 'configuration serveur absente']);
        }
        $cfg = require $fichier;
    }
    return $cfg;
}

function lp_json(int $code, array $data) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Jeton de session Supabase envoye par l'app (en-tete Authorization). */
function lp_jeton_utilisateur(): string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([A-Za-z0-9._-]+)$/', $h, $m)) {
        lp_json(401, ['erreur' => 'non connecte']);
    }
    return $m[1];
}

/** Appel HTTP minimal (cURL). Retourne [code, corps decode ou brut]. */
function lp_http(string $methode, string $url, array $entetes = [], $corps = null): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $methode,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => $entetes,
    ]);
    if ($corps !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $corps);
    }
    $rep  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($rep === false) {
        error_log('[backstage] cURL ' . $url . ' : ' . curl_error($ch));
    }
    curl_close($ch);
    $json = is_string($rep) ? json_decode($rep, true) : null;
    return [$code, $json ?? $rep];
}

/** Appel d'une fonction Supabase, avec le jeton de l'eleve ou en anonyme. */
function lp_rpc(string $fonction, array $params = [], ?string $jeton = null): array {
    $cfg = lp_config();
    return lp_http('POST', $cfg['supabase_url'] . '/rest/v1/rpc/' . $fonction, [
        'apikey: ' . $cfg['supabase_anon_key'],
        'Authorization: Bearer ' . ($jeton ?? $cfg['supabase_anon_key']),
        'Content-Type: application/json',
    ], json_encode($params, JSON_UNESCAPED_UNICODE));
}

/** Verifie que le jeton appartient a un admin du Backstage. */
function lp_exiger_admin(string $jeton): string {
    $cfg = lp_config();
    [$code, $user] = lp_http('GET', $cfg['supabase_url'] . '/auth/v1/user', [
        'apikey: ' . $cfg['supabase_anon_key'],
        'Authorization: Bearer ' . $jeton,
    ]);
    if ($code !== 200 || empty($user['id'])) {
        lp_json(401, ['erreur' => 'session invalide']);
    }
    [$code, $lignes] = lp_http('GET',
        $cfg['supabase_url'] . '/rest/v1/profiles?select=role&id=eq.' . rawurlencode($user['id']), [
        'apikey: ' . $cfg['supabase_anon_key'],
        'Authorization: Bearer ' . $jeton,
    ]);
    if ($code !== 200 || ($lignes[0]['role'] ?? '') !== 'admin') {
        lp_json(403, ['erreur' => 'reserve a l\'admin']);
    }
    return $user['id'];
}

/** Cles Discord deposees par Jerome, ou null. */
function lp_discord(): ?array {
    $f = LP_DOSSIER_SECRETS . '/discord.json';
    if (!is_file($f)) return null;
    $d = json_decode((string) file_get_contents($f), true);
    return is_array($d) ? $d : null;
}

/**
 * Envoi d'un mail. Coupe tant que $cfg['mail_actif'] est faux : le SPF de
 * loopsplay.com n'autorise qu'OVH (v=spf1 include:mx.ovh.com -all), un
 * mail parti d'Hostinger serait rejete. A activer une fois
 * include:_spf.mail.hostinger.com ajoute chez OVH.
 */
function lp_mail(string $a, string $sujet, string $html, string $texte, ?string $repondreA = null): bool {
    $cfg = lp_config();
    if (empty($cfg['mail_actif'])) {
        return false;
    }
    $frontiere = 'lp' . bin2hex(random_bytes(8));
    $entetes  = 'From: ' . $cfg['mail_expediteur_nom'] . ' <' . $cfg['mail_expediteur'] . ">\r\n";
    if ($repondreA && filter_var($repondreA, FILTER_VALIDATE_EMAIL)) {
        $entetes .= 'Reply-To: ' . $repondreA . "\r\n";
    }
    $entetes .= "MIME-Version: 1.0\r\n";
    $entetes .= 'Content-Type: multipart/alternative; boundary="' . $frontiere . "\"\r\n";

    $corps  = "--$frontiere\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $corps .= chunk_split(base64_encode($texte)) . "\r\n";
    $corps .= "--$frontiere\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $corps .= chunk_split(base64_encode($html)) . "\r\n";
    $corps .= "--$frontiere--\r\n";

    return @mail($a, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $corps, $entetes,
                 '-f' . $cfg['mail_expediteur']);
}
