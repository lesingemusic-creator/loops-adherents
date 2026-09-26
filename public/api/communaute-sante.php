<?php
/* =========================================================
   Sante des mails de la Communaute
   ---------------------------------------------------------
   Repond 200 si le script des mails recapitulatifs a tourne il y a
   moins de deux heures, 503 sinon. Interroge chaque jour par le
   workflow keep-alive de GitHub : un 503 fait echouer le workflow, et
   GitHub envoie un mail. Aucune donnee personnelle exposee.
   ========================================================= */

require __DIR__ . '/_commun.php';

$f = LP_DOSSIER_SECRETS . '/notifs-heartbeat.json';
$etat = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
$age = $etat && !empty($etat['le']) ? time() - strtotime($etat['le']) : null;

$ok = $age !== null && $age < 7200 && !empty($etat['ok']);
lp_json($ok ? 200 : 503, [
    'ok'              => $ok,
    'dernier_passage' => $etat['le'] ?? null,
    'il_y_a_minutes'  => $age === null ? null : intdiv($age, 60),
]);
