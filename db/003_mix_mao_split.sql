-- ============================================================
--  Loops & Play — Migration 003 : Split Mix / MAO
--  À exécuter dans le SQL Editor Supabase
-- ============================================================

-- 1) Ajouter la colonne categorie sur formations
alter table public.formations
  add column if not exists categorie text
  check (categorie in ('mix', 'mao'))
  default 'mix';

-- 2) Classifier les 15 modules existants
-- Modules 1-12 + 14 + 15 = Mix (beatmatching, EQ, sets, harmonique, vinyle, démarchage, live)
-- Module 13 = MAO (Production : ton premier track)
update public.formations set categorie = 'mix';
update public.formations set categorie = 'mao' where ordre = 13;

-- 3) Ajouter les nouvelles colonnes d'accès sur profiles
alter table public.profiles
  add column if not exists mix_pack text
  check (mix_pack in ('demo', 'resident', 'headliner'));

alter table public.profiles
  add column if not exists mao_pack text
  check (mao_pack in ('demo', 'resident', 'headliner'));

-- 4) Migrer l'ancienne colonne `pack` vers `mix_pack` (par défaut)
-- Les utilisateurs existants avaient un pack généraliste = Mix
update public.profiles
  set mix_pack = pack
  where pack is not null and mix_pack is null;

-- 5) Mettre à jour Jérôme (admin) pour qu'il ait les 2 catégories en headliner
update public.profiles
  set mix_pack = 'headliner', mao_pack = 'headliner'
  where role = 'admin';

-- 6) Mettre à jour la policy RLS sur formations
-- Drop ancienne policy
drop policy if exists "formations_select_by_pack" on public.formations;

-- Nouvelle policy : visibilité selon catégorie + pack correspondant
create policy "formations_select_by_category_and_pack"
  on public.formations
  for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or (
      categorie = 'mix' and
      public.user_can_see_pack(
        (select mix_pack from public.profiles where id = auth.uid()),
        pack_required
      )
    )
    or (
      categorie = 'mao' and
      public.user_can_see_pack(
        (select mao_pack from public.profiles where id = auth.uid()),
        pack_required
      )
    )
  );

-- 7) Index pour performance
create index if not exists formations_categorie_idx on public.formations(categorie);

-- ============================================================
--  Vérifications
-- ============================================================
-- select categorie, count(*) from public.formations group by categorie;
-- → mix: 14, mao: 1
-- select id, role, pack, mix_pack, mao_pack from public.profiles;
-- → Jérôme doit avoir mix_pack='headliner' ET mao_pack='headliner'
