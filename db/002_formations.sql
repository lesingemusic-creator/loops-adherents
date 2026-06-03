-- ============================================================
--  Loops & Play — Migration 002 : Formations
--  À exécuter dans le SQL Editor Supabase
-- ============================================================

-- 1) Table formations
create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  ordre int not null,
  pack_required text not null check (pack_required in ('demo', 'resident', 'headliner')),
  titre text not null,
  description text,
  duree_min int,
  video_youtube_id text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists formations_ordre_idx on public.formations(ordre);
create index if not exists formations_pack_idx on public.formations(pack_required);

-- 2) Table de progression utilisateur
create table if not exists public.formations_progression (
  user_id uuid not null references auth.users(id) on delete cascade,
  formation_id uuid not null references public.formations(id) on delete cascade,
  completed_at timestamptz default now(),
  primary key (user_id, formation_id)
);

-- 3) Fonction utilitaire : cascade des packs
-- Démo voit les modules Démo
-- Résident voit Démo + Résident
-- Headliner voit tout
create or replace function public.user_can_see_pack(viewer_pack text, formation_pack text)
returns boolean
language sql
immutable
as $$
  select case
    when viewer_pack = 'headliner' then true
    when viewer_pack = 'resident' then formation_pack in ('demo', 'resident')
    when viewer_pack = 'demo' then formation_pack = 'demo'
    else false
  end;
$$;

-- 4) Activation RLS
alter table public.formations enable row level security;
alter table public.formations_progression enable row level security;

-- 5) Policies formations

-- Drop anciennes versions si on relance la migration
drop policy if exists "formations_select_by_pack" on public.formations;
drop policy if exists "formations_admin_write" on public.formations;

-- Lecture : admin voit tout, sinon cascade des packs
create policy "formations_select_by_pack"
  on public.formations
  for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or public.user_can_see_pack(
      (select pack from public.profiles where id = auth.uid()),
      pack_required
    )
  );

-- Écriture : admin uniquement
create policy "formations_admin_write"
  on public.formations
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 6) Policies progression : chacun gère la sienne

drop policy if exists "progression_own" on public.formations_progression;

create policy "progression_own"
  on public.formations_progression
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 7) Seed initial : 15 modules vides
-- (Jérôme remplira les video_youtube_id depuis le panel admin)

insert into public.formations (ordre, pack_required, titre, description, duree_min) values
  -- DÉMO (3 modules de découverte)
  (1, 'demo', 'Bienvenue chez Loops & Play',
   'Présentation de la philosophie de l''école et tour du studio à Lyon.', 5),
  (2, 'demo', 'Les bases du beatmatching',
   'Comprendre les BPM et caler deux morceaux à la main, sans bouton sync.', 15),
  (3, 'demo', 'Ton premier mix en 10 minutes',
   'Mettre en pratique sur deux morceaux compatibles, pas à pas.', 12),

  -- RÉSIDENT (5 modules pour structurer le mix)
  (4, 'resident', 'L''EQ : ton meilleur ami',
   'Utiliser les graves, médiums, aigus pour des transitions propres.', 18),
  (5, 'resident', 'Lecture de piste : anticiper la structure',
   'Identifier intro, drop, breakdown, outro pour mixer juste.', 20),
  (6, 'resident', 'Construire un set de A à Z',
   'Construire une progression sur 1h, gérer l''énergie, raconter une histoire.', 25),
  (7, 'resident', 'Les effets : filtres, delays, reverb',
   'Utiliser les FX sans en abuser. Quand et comment.', 18),
  (8, 'resident', 'Enregistrer et réécouter tes mixes',
   'La méthode pour progresser vite en s''écoutant à froid.', 12),

  -- HEADLINER (7 modules pour aller pro)
  (9, 'headliner', 'Mixer en harmonique (Camelot Wheel)',
   'Mixer dans la même tonalité pour un son cohérent et émotionnel.', 22),
  (10, 'headliner', 'Hot cues et looping créatif',
   'Aller au-delà du mix linéaire avec cues et loops.', 25),
  (11, 'headliner', 'Construire un set de 2h en club',
   'Gestion de l''énergie sur la longueur, lecture du public.', 30),
  (12, 'headliner', 'Mixer en vinyle (initiation)',
   'Découvrir le mix tactile, la nostalgie qui sert encore aujourd''hui.', 28),
  (13, 'headliner', 'Production : ton premier track',
   'De l''idée à l''export, les bases de la production électronique.', 35),
  (14, 'headliner', 'Démarcher des clubs et résidences',
   'Comment se vendre, à qui parler, quels supports envoyer.', 18),
  (15, 'headliner', 'Préparer un live set vs un DJ set',
   'Différences techniques et émotionnelles entre les deux exercices.', 22)
on conflict do nothing;

-- ============================================================
--  Vérifications post-migration
-- ============================================================
-- select count(*) from public.formations;  -- doit retourner 15
-- select pack_required, count(*) from public.formations group by pack_required;
-- (3 demo, 5 resident, 7 headliner)
