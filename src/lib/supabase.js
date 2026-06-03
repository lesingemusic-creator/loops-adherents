import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase partagé pour toute l'app.
 * Lit les credentials depuis .env (variables préfixées VITE_ pour être exposées au client).
 *
 * IMPORTANT : la anon key est PUBLIQUE par design.
 * La sécurité repose sur les Row Level Security (RLS) policies définies dans Supabase.
 * Ne JAMAIS exposer la service_role key côté client.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variables d\'environnement manquantes. ' +
    'Copie .env.example vers .env et remplis les clés.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)
