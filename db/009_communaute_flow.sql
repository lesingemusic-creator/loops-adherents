-- ============================================================
--  Loops & Play, Migration 009 : Communaute « Le Flow »
--  DA choisie par Freddy le 26/09/2026 (maquette DA 1).
--  Ajoute les mecaniques qui font revenir : stories (annonces de
--  Jerome), serie de jours, ecoutes des extraits, « en rotation »,
--  defi de la semaine.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Ecoutes des extraits audio (une par eleve et par extrait)
-- ------------------------------------------------------------
alter table public.comm_messages add column if not exists nb_ecoutes int not null default 0;

create table if not exists public.comm_ecoutes (
  message_id uuid not null references public.comm_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (message_id, user_id)
);
alter table public.comm_ecoutes enable row level security;
-- Aucune policy : on passe par la fonction.

create or replace function public.comm_ecouter(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.comm_membre(auth.uid()) then return null; end if;
  insert into public.comm_ecoutes (message_id, user_id) values (p_id, auth.uid())
    on conflict do nothing;
  if found then
    update public.comm_messages set nb_ecoutes = nb_ecoutes + 1 where id = p_id returning nb_ecoutes into n;
  else
    select nb_ecoutes into n from public.comm_messages where id = p_id;
  end if;
  return n;
end $$;

-- Le verrou d'insertion des messages refuse deja nb_reponses <> 0 ;
-- meme regle pour nb_ecoutes (on ne se donne pas d'ecoutes a soi-meme).
drop policy if exists "comm_msg_ecriture" on public.comm_messages;
create policy "comm_msg_ecriture" on public.comm_messages
  for insert to authenticated with check (
    auteur_id = auth.uid()
    and public.comm_membre(auth.uid())
    and (
      (salon_id is not null and (
        public.is_admin(auth.uid())
        or parent_id is not null
        or (select ecriture from public.comm_salons s where s.id = salon_id) = 'tous'
      ))
      or (conversation_id is not null and public.comm_participe(conversation_id, auth.uid()))
    )
    and epingle = false
    and supprime_le is null
    and nb_reponses = 0
    and nb_ecoutes = 0
  );

-- ------------------------------------------------------------
-- 2) Serie de jours (« 4 jours d'affilee »)
-- ------------------------------------------------------------
create table if not exists public.comm_visites (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour    date not null,
  primary key (user_id, jour)
);
alter table public.comm_visites enable row level security;

-- Enregistre la visite du jour (heure de Paris) et rend la serie en cours.
create or replace function public.comm_serie()
returns int language plpgsql security definer set search_path = public as $$
declare
  aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  n int := 0;
  j date := aujourdhui;
begin
  if auth.uid() is null then return 0; end if;
  insert into public.comm_visites (user_id, jour) values (auth.uid(), aujourdhui) on conflict do nothing;
  while exists (select 1 from public.comm_visites where user_id = auth.uid() and jour = j) loop
    n := n + 1;
    j := j - 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 3) Stories : les annonces de Jerome des 14 derniers jours
-- ------------------------------------------------------------
-- « Vue » = la notification d'annonce de l'eleve est lue.
create or replace function public.comm_stories()
returns table (id uuid, contenu text, fichier_chemin text, fichier_type text, created_at timestamptz,
               salon text, auteur_id uuid, vue boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.contenu, m.fichier_chemin, m.fichier_type, m.created_at, s.slug, m.auteur_id,
         coalesce((select n.lu from public.comm_notifications n
                    where n.message_id = m.id and n.user_id = auth.uid()), true)
    from public.comm_messages m
    join public.comm_salons s on s.id = m.salon_id
   where public.comm_membre(auth.uid())
     and s.slug in ('annonces', 'contenu-exclusif', 'regles')
     and m.parent_id is null and m.supprime_le is null
     and public.is_admin(m.auteur_id)
     and m.created_at > now() - interval '14 days'
   order by m.created_at desc
   limit 12;
$$;

-- Marquer une story (ou tout message) comme vue
create or replace function public.comm_vu(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.comm_notifications set lu = true where message_id = p_id and user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 4) En rotation cette semaine
-- ------------------------------------------------------------
create or replace function public.comm_rotation()
returns table (id uuid, contenu text, fichier_nom text, auteur_id uuid, salon text, reactions int, ecoutes int, reponses int, score int)
language sql stable security definer set search_path = public as $$
  select m.id, m.contenu, m.fichier_nom, m.auteur_id, s.slug,
         (select count(*)::int from public.comm_reactions r where r.message_id = m.id),
         m.nb_ecoutes, m.nb_reponses,
         ((select count(*)::int from public.comm_reactions r where r.message_id = m.id) * 2
           + m.nb_ecoutes + m.nb_reponses * 3)
    from public.comm_messages m
    join public.comm_salons s on s.id = m.salon_id
   where public.comm_membre(auth.uid())
     and s.slug in ('showcase', 'feedback-mix')
     and m.parent_id is null and m.supprime_le is null
     and m.created_at > now() - interval '7 days'
   order by 9 desc, m.created_at desc
   limit 3;
$$;

-- ------------------------------------------------------------
-- 5) Defi de la semaine (ecrit par Jerome dans son admin)
-- ------------------------------------------------------------
-- reglages_app.defi = JSON { "titre", "texte", "salon" (slug), "debut", "fin" }
create or replace function public.comm_defi()
returns table (titre text, texte text, salon text, fin date, participants int, membres int, moi boolean)
language plpgsql stable security definer set search_path = public as $$
declare d jsonb; v_salon uuid;
begin
  if not public.comm_membre(auth.uid()) then return; end if;
  select valeur::jsonb into d from public.reglages_app where cle = 'defi';
  if d is null or coalesce(d->>'titre', '') = '' then return; end if;
  if (d->>'fin') is not null and (d->>'fin')::date < (now() at time zone 'Europe/Paris')::date then return; end if;
  select s.id into v_salon from public.comm_salons s where s.slug = coalesce(d->>'salon', 'showcase');
  return query
    select d->>'titre', d->>'texte', coalesce(d->>'salon', 'showcase'), (d->>'fin')::date,
      (select count(distinct m.auteur_id)::int from public.comm_messages m
        where m.salon_id = v_salon and m.parent_id is null and m.supprime_le is null
          and m.created_at >= coalesce((d->>'debut')::timestamptz, now() - interval '7 days')
          and not public.is_admin(m.auteur_id)),
      (select count(*)::int from public.profiles p where p.role <> 'admin' and not p.communaute_bloque),
      exists (select 1 from public.comm_messages m
        where m.salon_id = v_salon and m.parent_id is null and m.auteur_id = auth.uid() and m.supprime_le is null
          and m.created_at >= coalesce((d->>'debut')::timestamptz, now() - interval '7 days'));
end $$;

-- ------------------------------------------------------------
-- 6) Droits
-- ------------------------------------------------------------
revoke all on function public.comm_ecouter(uuid) from public;
revoke all on function public.comm_serie() from public;
revoke all on function public.comm_stories() from public;
revoke all on function public.comm_vu(uuid) from public;
revoke all on function public.comm_rotation() from public;
revoke all on function public.comm_defi() from public;
grant execute on function public.comm_ecouter(uuid) to authenticated;
grant execute on function public.comm_serie() to authenticated;
grant execute on function public.comm_stories() to authenticated;
grant execute on function public.comm_vu(uuid) to authenticated;
grant execute on function public.comm_rotation() to authenticated;
grant execute on function public.comm_defi() to authenticated;
