-- ============================================================
--  Loops & Play, Migration 006 : inscriptions, comptes, Discord
--  Briques 1, 2 et 3 du brief Jerome du 18/09/2026,
--  avec ses reponses du 23/09/2026.
--  Appliquee le 25/09/2026 par connexion directe (pooler).
--  Rejouable sans casse : tout est en "if not exists" / "or replace".
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 0) Schema prive : rien ici n'est expose par l'API REST
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Reglages serveur. La cle partagee n'est connue que des scripts PHP
-- de loopsplay.com : sans elle, impossible d'ecrire une inscription ou
-- de lier un compte Discord en appelant l'API a la main.
create table if not exists private.reglages (
  cle    text primary key,
  valeur text not null
);
insert into private.reglages (cle, valeur)
  values ('cle_serveur', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (cle) do nothing;

create or replace function private.verifier_cle(p_cle text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_cle is null or p_cle <> (select valeur from private.reglages where cle = 'cle_serveur') then
    raise exception 'cle serveur invalide' using errcode = '42501';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) Colonnes ajoutees sur profiles
-- ------------------------------------------------------------
alter table public.profiles add column if not exists prenom text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists telephone text;
alter table public.profiles add column if not exists formule text
  check (formule in ('pack1','pack2','pack3','annee','dj119','mao119'));
alter table public.profiles add column if not exists discipline text
  check (discipline in ('dj','mao','les_deux'));
alter table public.profiles add column if not exists compte_genere_le timestamptz;
alter table public.profiles add column if not exists active_le timestamptz;
alter table public.profiles add column if not exists bienvenue_envoyee_le timestamptz;
alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_pseudo text;
alter table public.profiles add column if not exists discord_lie_le timestamptz;
alter table public.profiles add column if not exists inscription_id uuid;

-- Les comptes deja la (Jerome, compte de test) sont consideres actives.
update public.profiles set active_le = coalesce(active_le, created_at, now())
  where active_le is null and role = 'admin';

-- ------------------------------------------------------------
-- 2) FAILLE CORRIGEE : un eleve pouvait modifier toute sa fiche
-- ------------------------------------------------------------
-- La policy "Users can update own profile" n'a pas de restriction de
-- colonne : un eleve pouvait se passer role = 'admin' depuis la console.
-- Ce trigger remet les colonnes sensibles a leur valeur d'origine quand
-- l'auteur n'est pas admin. Seuls les champs du profil public restent
-- libres : nom, prenom, pseudo_dj, photo_url, bio, liens.
-- Les fonctions systeme ci-dessous levent le verrou via lp.systeme.

create or replace function public.proteger_colonnes_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lp.systeme', true), '') = '1' then
    return new;
  end if;
  if auth.uid() is null then          -- SQL Editor, connexion directe
    return new;
  end if;
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  new.id                   := old.id;
  new.role                 := old.role;
  new.pack                 := old.pack;
  new.mix_pack             := old.mix_pack;
  new.mao_pack             := old.mao_pack;
  new.fin_pack             := old.fin_pack;
  new.retention_videos     := old.retention_videos;
  new.email                := old.email;
  new.telephone            := old.telephone;
  new.formule              := old.formule;
  new.discipline           := old.discipline;
  new.compte_genere_le     := old.compte_genere_le;
  new.active_le            := old.active_le;
  new.bienvenue_envoyee_le := old.bienvenue_envoyee_le;
  new.discord_id           := old.discord_id;
  new.discord_pseudo       := old.discord_pseudo;
  new.discord_lie_le       := old.discord_lie_le;
  new.inscription_id       := old.inscription_id;
  new.created_at           := old.created_at;
  return new;
end $$;

drop trigger if exists proteger_colonnes_profil on public.profiles;
create trigger proteger_colonnes_profil
  before update on public.profiles
  for each row execute function public.proteger_colonnes_profil();

-- ------------------------------------------------------------
-- 3) Table des inscriptions (brique 1)
-- ------------------------------------------------------------
create table if not exists public.inscriptions (
  id               uuid primary key default gen_random_uuid(),
  recu_le          timestamptz not null default now(),
  prenom           text not null,
  nom              text not null,
  email            text not null,
  telephone        text not null,
  adresse          text not null,
  formation        text not null check (formation in ('pack1','pack2','pack3','annee','dj119','mao119')),
  discipline       text check (discipline in ('dj','mao','les_deux')),
  mode_paiement    text not null check (mode_paiement in ('comptant','2x','4x')),
  cgv_acceptees    boolean not null default true,
  -- Consentement parental : justificatif interne, jamais affiche dans
  -- le panneau admin ni dans une notification (brief, section 2).
  mineur           boolean not null default false,
  parent_nom       text,
  parent_telephone text,
  parent_accord    boolean not null default false,
  ip               text,
  statut           text not null default 'nouvelle'
                   check (statut in ('nouvelle','compte_cree','sans_suite')),
  user_id          uuid references auth.users(id) on delete set null,
  traitee_le       timestamptz
);
create index if not exists inscriptions_recu_idx on public.inscriptions(recu_le desc);

alter table public.inscriptions enable row level security;

drop policy if exists "inscriptions_admin_select" on public.inscriptions;
drop policy if exists "inscriptions_admin_update" on public.inscriptions;
drop policy if exists "inscriptions_admin_delete" on public.inscriptions;
create policy "inscriptions_admin_select" on public.inscriptions
  for select to authenticated using (public.is_admin(auth.uid()));
create policy "inscriptions_admin_update" on public.inscriptions
  for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "inscriptions_admin_delete" on public.inscriptions
  for delete to authenticated using (public.is_admin(auth.uid()));
-- Pas de policy d'insertion : tout passe par la fonction ci-dessous.

-- Le panneau admin ne lit que cette vue : les colonnes du mineur n'y
-- figurent pas. security_invoker = la RLS de la table s'applique.
create or replace view public.inscriptions_admin
with (security_invoker = true) as
  select id, recu_le, prenom, nom, email, telephone, adresse, formation,
         discipline, mode_paiement, statut, user_id, traitee_le
  from public.inscriptions;

create or replace function public.enregistrer_inscription(p_cle text, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform private.verifier_cle(p_cle);
  insert into public.inscriptions (
    prenom, nom, email, telephone, adresse, formation, discipline, mode_paiement,
    cgv_acceptees, mineur, parent_nom, parent_telephone, parent_accord, ip)
  values (
    left(p->>'prenom', 100), left(p->>'nom', 100), lower(left(p->>'email', 200)),
    left(p->>'telephone', 30), left(p->>'adresse', 300), p->>'formation',
    nullif(p->>'discipline', ''), p->>'mode_paiement',
    coalesce((p->>'cgv_acceptees')::boolean, false),
    coalesce((p->>'mineur')::boolean, false),
    nullif(left(p->>'parent_nom', 100), ''), nullif(left(p->>'parent_telephone', 30), ''),
    coalesce((p->>'parent_accord')::boolean, false),
    left(p->>'ip', 64))
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------
-- 4) Acces par formule (reponse de Jerome du 23/09)
-- ------------------------------------------------------------
-- Les modules sont ranges en 3 blocs : pack_required demo = bloc 1,
-- resident = bloc 2, headliner = bloc 3. Voir un niveau ouvre ceux
-- d'en dessous (user_can_see_pack). Donc :
--   bloc 1 seul      -> 'demo'
--   blocs 1 a 3      -> 'headliner'
--   Pack 1 (Demo)    : bloc 1 de sa discipline
--   Pack 2 (Resident): blocs 1 a 3 de sa discipline
--   Pack 3 (Headliner): blocs 1 a 3 des deux disciplines
--   Annee DJ / MAO   : blocs 1 a 3 de sa discipline
--   Cours en ligne 119 EUR : blocs 1 a 3 de sa discipline
create or replace function public.acces_formule(p_formule text, p_discipline text,
  out mix_pack text, out mao_pack text, out discipline text)
language plpgsql immutable as $$
declare niveau text;
begin
  discipline := case
    when p_formule = 'pack3'  then 'les_deux'
    when p_formule = 'dj119'  then 'dj'
    when p_formule = 'mao119' then 'mao'
    else p_discipline end;
  if discipline not in ('dj','mao','les_deux') or discipline is null then
    raise exception 'discipline manquante pour la formule %', p_formule;
  end if;
  niveau := case when p_formule = 'pack1' then 'demo' else 'headliner' end;
  mix_pack := case when discipline in ('dj','les_deux')  then niveau end;
  mao_pack := case when discipline in ('mao','les_deux') then niveau end;
end $$;

-- ------------------------------------------------------------
-- 5) Generateur de comptes (brique 2)
-- ------------------------------------------------------------
-- Mot de passe facile a dicter sur WhatsApp : 3 syllabes, 4 chiffres.
create or replace function private.generer_mot_de_passe()
returns text language plpgsql volatile set search_path = '' as $$
declare
  consonnes text := 'bcdfgjklmnprstvz';
  voyelles  text := 'aeiou';
  r bytea := extensions.gen_random_bytes(10);
  mdp text := '';
  i int;
begin
  for i in 0..2 loop
    mdp := mdp || substr(consonnes, (get_byte(r, i*2) % 16) + 1, 1)
               || substr(voyelles,  (get_byte(r, i*2+1) % 5) + 1, 1);
  end loop;
  mdp := upper(left(mdp, 1)) || substr(mdp, 2) || '-';
  for i in 6..9 loop
    mdp := mdp || (get_byte(r, i) % 10)::text;
  end loop;
  return mdp;   -- ex. Kavomi-4821
end $$;

create or replace function public.admin_creer_eleve(
  p_prenom text, p_nom text, p_email text, p_formule text,
  p_discipline text default null, p_inscription_id uuid default null)
returns table (user_id uuid, identifiant text, mot_de_passe text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_mdp   text := private.generer_mot_de_passe();
  a       record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'reserve a l''admin' using errcode = '42501';
  end if;
  if coalesce(trim(p_prenom), '') = '' or coalesce(trim(p_nom), '') = '' then
    raise exception 'prenom et nom obligatoires';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'adresse email invalide';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'un compte existe deja avec cette adresse : %', v_email;
  end if;

  select * into a from public.acces_formule(p_formule, p_discipline);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(v_mdp, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('prenom', trim(p_prenom), 'nom', trim(p_nom)),
    now(), now(), '', '', '', '', '', '', '', '');

  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (v_id::text, v_id,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now());

  -- Le trigger on_auth_user_created a cree la ligne profiles.
  perform set_config('lp.systeme', '1', true);
  update public.profiles set
    prenom = trim(p_prenom),
    nom = trim(p_prenom) || ' ' || trim(p_nom),
    email = v_email,
    role = 'adherent',
    formule = p_formule,
    discipline = a.discipline,
    mix_pack = a.mix_pack,
    mao_pack = a.mao_pack,
    pack = coalesce(a.mix_pack, a.mao_pack),
    retention_videos = case when p_formule = 'annee' then 'rotation5' else 'historique' end,
    compte_genere_le = now(),
    inscription_id = p_inscription_id,
    telephone = (select i.telephone from public.inscriptions i where i.id = p_inscription_id)
  where id = v_id;

  if p_inscription_id is not null then
    update public.inscriptions
       set statut = 'compte_cree', user_id = v_id, traitee_le = now()
     where id = p_inscription_id;
  end if;

  return query select v_id, v_email, v_mdp;
end $$;

create or replace function public.admin_nouveau_mot_de_passe(p_user_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_mdp text := private.generer_mot_de_passe();
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'reserve a l''admin' using errcode = '42501';
  end if;
  if public.is_admin(p_user_id) then
    raise exception 'pas sur un compte admin';
  end if;
  update auth.users set encrypted_password = crypt(v_mdp, gen_salt('bf')), updated_at = now()
   where id = p_user_id;
  if not found then raise exception 'compte introuvable'; end if;
  return v_mdp;
end $$;

-- ------------------------------------------------------------
-- 6) Activation et mail de bienvenue
-- ------------------------------------------------------------
-- Appelee par l'app a chaque connexion. Premiere fois : le compte passe
-- "active" (visible par Jerome).
create or replace function public.signaler_connexion()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_premiere boolean;
begin
  if auth.uid() is null then return false; end if;
  perform set_config('lp.systeme', '1', true);
  update public.profiles set active_le = now()
   where id = auth.uid() and active_le is null;
  v_premiere := found;
  return v_premiere;
end $$;

-- Appelee par bienvenue.php avec le jeton de l'eleve. Reserve l'envoi de
-- facon atomique : deux onglets ouverts ne declenchent pas deux mails.
create or replace function public.reserver_mail_bienvenue()
returns table (email text, prenom text)
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('lp.systeme', '1', true);
  return query
    update public.profiles p set bienvenue_envoyee_le = now()
     where p.id = auth.uid()
       and p.active_le is not null
       and p.bienvenue_envoyee_le is null
       and p.role <> 'admin'
    returning p.email, p.prenom;
end $$;

create or replace function public.annuler_mail_bienvenue()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('lp.systeme', '1', true);
  update public.profiles set bienvenue_envoyee_le = null where id = auth.uid();
end $$;

-- ------------------------------------------------------------
-- 7) Discord (brique 3)
-- ------------------------------------------------------------
-- L'onglet Communaute demande un jeton a usage unique, le passe en
-- "state" a Discord ; le script PHP de retour s'en sert pour savoir
-- quel eleve vient de rejoindre, et nomme le membre sur le serveur.
create table if not exists private.discord_jetons (
  jeton      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expire_le  timestamptz not null default now() + interval '15 minutes'
);

create or replace function public.discord_jeton()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v text := encode(gen_random_bytes(18), 'hex');
begin
  if auth.uid() is null then raise exception 'non connecte' using errcode = '42501'; end if;
  delete from private.discord_jetons where expire_le < now();
  insert into private.discord_jetons (jeton, user_id) values (v, auth.uid());
  return v;
end $$;

create or replace function public.discord_lier(p_cle text, p_jeton text, p_discord_id text, p_pseudo text)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_nom text;
begin
  perform private.verifier_cle(p_cle);
  delete from private.discord_jetons
   where jeton = p_jeton and expire_le > now()
  returning user_id into v_user;
  if v_user is null then raise exception 'jeton expire ou inconnu'; end if;

  perform set_config('lp.systeme', '1', true);
  update public.profiles set discord_id = p_discord_id, discord_pseudo = p_pseudo,
         discord_lie_le = now()
   where id = v_user
  returning coalesce(nullif(pseudo_dj, ''), nom) into v_nom;
  return v_nom;
end $$;

-- ------------------------------------------------------------
-- 8) Droits d'execution
-- ------------------------------------------------------------
revoke all on function public.enregistrer_inscription(text, jsonb) from public;
revoke all on function public.admin_creer_eleve(text, text, text, text, text, uuid) from public;
revoke all on function public.admin_nouveau_mot_de_passe(uuid) from public;
revoke all on function public.signaler_connexion() from public;
revoke all on function public.reserver_mail_bienvenue() from public;
revoke all on function public.annuler_mail_bienvenue() from public;
revoke all on function public.discord_jeton() from public;
revoke all on function public.discord_lier(text, text, text, text) from public;
revoke all on function public.acces_formule(text, text) from public;

grant execute on function public.enregistrer_inscription(text, jsonb) to anon, authenticated;
grant execute on function public.discord_lier(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_creer_eleve(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_nouveau_mot_de_passe(uuid) to authenticated;
grant execute on function public.signaler_connexion() to authenticated;
grant execute on function public.reserver_mail_bienvenue() to authenticated;
grant execute on function public.annuler_mail_bienvenue() to authenticated;
grant execute on function public.discord_jeton() to authenticated;
grant select on public.inscriptions_admin to authenticated;

-- ============================================================
--  Verifications
-- ============================================================
-- select * from public.acces_formule('pack2','mao');   -> null, headliner, mao
-- select valeur from private.reglages where cle = 'cle_serveur';  -> a copier dans la config PHP
