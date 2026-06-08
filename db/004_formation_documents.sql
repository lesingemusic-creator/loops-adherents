-- ============================================================
--  Loops & Play — Migration 004 : Documents (PDFs) par module
--  À exécuter dans le SQL Editor Supabase
-- ============================================================

-- 1) Table formation_documents
create table if not exists public.formation_documents (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  titre text not null,
  fichier_path text not null,   -- chemin dans le bucket Storage (ex: "formations/abc-123/cours.pdf")
  taille_kb int,                -- taille en KB (pour affichage)
  ordre int default 0,
  created_at timestamptz default now()
);

create index if not exists formation_documents_formation_idx
  on public.formation_documents(formation_id);

-- 2) RLS
alter table public.formation_documents enable row level security;

-- Drop anciennes policies au cas où on relance
drop policy if exists "documents_select_via_formation" on public.formation_documents;
drop policy if exists "documents_admin_write" on public.formation_documents;

-- Lecture : l'utilisateur peut voir le document si il peut voir la formation parente
-- (la policy sur formations gère déjà la cascade catégorie + pack)
create policy "documents_select_via_formation"
  on public.formation_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.formations f
      where f.id = formation_id
        and (
          public.is_admin(auth.uid())
          or (
            f.categorie = 'mix' and
            public.user_can_see_pack(
              (select mix_pack from public.profiles where id = auth.uid()),
              f.pack_required
            )
          )
          or (
            f.categorie = 'mao' and
            public.user_can_see_pack(
              (select mao_pack from public.profiles where id = auth.uid()),
              f.pack_required
            )
          )
        )
    )
  );

-- Écriture : admin uniquement
create policy "documents_admin_write"
  on public.formation_documents
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ============================================================
--  ⚠️ ÉTAPE MANUELLE : créer le bucket Storage
-- ============================================================
-- Dans Supabase Dashboard → Storage → New Bucket :
--
--   Name: formation-documents
--   Public bucket: NON (privé — accès via signed URLs)
--   File size limit: 50 MB
--   Allowed MIME types: application/pdf
--
-- Ensuite, ajouter ces policies sur le bucket (Storage → Policies) :
--
--   Policy 1 — "Admin upload" :
--     - Operation: INSERT
--     - Roles: authenticated
--     - Definition: bucket_id = 'formation-documents' AND public.is_admin(auth.uid())
--
--   Policy 2 — "Admin delete" :
--     - Operation: DELETE
--     - Roles: authenticated
--     - Definition: bucket_id = 'formation-documents' AND public.is_admin(auth.uid())
--
--   Policy 3 — "Authenticated read" :
--     - Operation: SELECT
--     - Roles: authenticated
--     - Definition: bucket_id = 'formation-documents'
--   (La RLS sur formation_documents filtre déjà l'accès, donc on peut laisser lecture libre
--    pour les authentifiés — c'est le path qu'on doit récupérer via la table qui protège.)
