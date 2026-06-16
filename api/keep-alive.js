/**
 * Vercel Cron endpoint pour empêcher Supabase free tier de mettre le projet en pause.
 *
 * Appelle la fonction publique `public.keep_alive()` créée via migration 005.
 * Le simple fait d'exécuter cette fonction RPC génère une activité DB,
 * ce qui réinitialise le timer de pause auto (7 jours d'inactivité sinon).
 *
 * Déclenché automatiquement par Vercel Cron — voir vercel.json.
 * Schedule : tous les jours à 07:00 UTC (09:00 heure de Paris en été).
 *
 * URL et anon key publiques par design (mêmes valeurs que côté client React).
 */

const SUPABASE_URL = 'https://tisypqtknflvtlbgjqqw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpc3lwcXRrbmZsdnRsYmdqcXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODU1MDYsImV4cCI6MjA5NjA2MTUwNn0.y1q7z5ICVueCSQHGIf2jKKDpcDZh2PkKZn0ImzsjZ1Y'

export default async function handler(req, res) {
  const startedAt = new Date().toISOString()

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keep_alive`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await response.text()

    if (!response.ok) {
      console.error('[keep-alive] failed', response.status, body)
      return res.status(response.status).json({
        ok: false,
        status: response.status,
        body,
        startedAt,
      })
    }

    console.log('[keep-alive] ok', body)
    return res.status(200).json({
      ok: true,
      startedAt,
      supabaseResponse: body,
    })
  } catch (err) {
    console.error('[keep-alive] exception', err)
    return res.status(500).json({
      ok: false,
      error: err.message,
      startedAt,
    })
  }
}
