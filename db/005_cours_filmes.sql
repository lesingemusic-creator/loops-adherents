-- ============================================================
--  Loops & Play, Migration 005 : Mon cours filme
--  Brique 4 du brief Jerome du 18/09/2026.
--  A executer dans le SQL Editor Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table des seances filmees
-- ------------------------------------------------------------
-- Une ligne par video. Jerome colle lui-meme le lien Drive depuis le
-- panneau admin : pas de systeme de correspondance automatique a
-- construire, c'est une consigne explicite du brief.

create table if not exists public.cours_filmes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  titre       text not null,
  drive_url   text not null,
  date_seance date,
  vu_le       timestamptz,               -- null tant que l'eleve n'a pas ouvert la video
  created_at  timestamptz default now()
);

create index if not exists cours_filmes_user_idx
  on public.cours_filmes(user_id, date_seance desc nulls last, created_at desc);

-- ------------------------------------------------------------
-- 2) Deux colonnes sur profiles
-- ------------------------------------------------------------
-- fin_pack : la derniere heure de cours de l'eleve. Le brief fixe une
-- fenetre de 15 jours apres cette date pour telecharger, puis suppression.
-- La suppression reste MANUELLE en V1 (consigne du brief), cette date
-- sert uniquement a afficher le compte a rebours a l'eleve.

alter table public.profiles
  add column if not exists fin_pack date;

-- retention_videos : comment l'eleve voit ses seances.
--   'historique' : tout l'historique du pack (Pack 1, Pack 2, Pack 3)
--   'rotation5'  : les 5 seances les plus recentes, en continu (formule Annee)
-- Volontairement independant de la taxonomie des packs, qui n'est pas
-- encore tranchee (question Q1 du mail du 18/09/2026). Jerome choisit
-- directement dans la fiche de l'eleve.

alter table public.profiles
  add column if not exists retention_videos text
  check (retention_videos in ('historique', 'rotation5'))
  default 'historique';

update public.profiles
  set retention_videos = 'historique'
  where retention_videos is null;

-- ------------------------------------------------------------
-- 3) RLS
-- ------------------------------------------------------------

alter table public.cours_filmes enable row level security;

drop policy if exists "cours_filmes_select_own" on public.cours_filmes;
drop policy if exists "cours_filmes_admin_write" on public.cours_filmes;

-- Lecture : chacun ses propres seances, l'admin voit tout.
create policy "cours_filmes_select_own"
  on public.cours_filmes
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- Ecriture : admin uniquement.
-- L'eleve ne peut PAS modifier ses lignes, meme les siennes : sinon il
-- pourrait reecrire le lien Drive. Le seul geste qu'on lui autorise,
-- marquer une video comme vue, passe par la fonction ci-dessous.
create policy "cours_filmes_admin_write"
  on public.cours_filmes
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3 bis) L'admin doit pouvoir lire et editer toutes les fiches
-- ------------------------------------------------------------
-- Le panneau "Eleves et cours filmes" liste les profils et met a jour
-- fin_pack et retention_videos. Ces deux policies s'ajoutent a celles
-- qui existent deja (les policies se cumulent en OU), elles ne retirent
-- donc rien a l'eleve sur sa propre fiche.

drop policy if exists "profiles_admin_select_all" on public.profiles;
drop policy if exists "profiles_admin_update_all" on public.profiles;

create policy "profiles_admin_select_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "profiles_admin_update_all"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 4) Marquer une video comme vue
-- ------------------------------------------------------------
-- SECURITY DEFINER : la fonction passe outre la policy d'ecriture, mais
-- elle ne touche QUE la colonne vu_le, et seulement sur une ligne qui
-- appartient a l'appelant. C'est la façon propre d'ouvrir une seule
-- colonne en ecriture, RLS ne sachant pas filtrer par colonne.

create or replace function public.marquer_cours_vu(p_cours_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cours_filmes
     set vu_le = now()
   where id = p_cours_id
     and user_id = auth.uid()
     and vu_le is null;
end;
$$;

revoke all on function public.marquer_cours_vu(uuid) from public;
grant execute on function public.marquer_cours_vu(uuid) to authenticated;

-- ============================================================
--  Verifications
-- ============================================================
-- select column_name from information_schema.columns
--   where table_name = 'profiles' and column_name in ('fin_pack','retention_videos');
--   -> doit retourner les 2 lignes
--
-- select * from public.cours_filmes;  -- vide au depart
