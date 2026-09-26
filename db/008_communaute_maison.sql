-- ============================================================
--  Loops & Play, Migration 008 : la Communaute maison
--  Plan B de Freddy (26/09/2026) : remplacer Discord par une communaute
--  integree au Backstage, avec au minimum tout ce que fait le serveur
--  Discord de Jerome (brief du 18/09, section 3), plus : messages prives,
--  reponses en fil, reactions, mentions, fichiers, notifications.
--  Jerome choisit ensuite entre Discord et cette version (reglages_app).
-- ============================================================

-- ------------------------------------------------------------
-- 0) Reglages de l'app (mode de l'onglet Communaute)
-- ------------------------------------------------------------
create table if not exists public.reglages_app (
  cle        text primary key,
  valeur     text not null,
  modifie_le timestamptz default now()
);
insert into public.reglages_app (cle, valeur) values ('communaute_mode', 'discord')
  on conflict (cle) do nothing;

alter table public.reglages_app enable row level security;
drop policy if exists "reglages_app_lecture" on public.reglages_app;
drop policy if exists "reglages_app_admin" on public.reglages_app;
create policy "reglages_app_lecture" on public.reglages_app
  for select to authenticated using (true);
create policy "reglages_app_admin" on public.reglages_app
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 1) Profil : blocage communaute, preference mail
-- ------------------------------------------------------------
alter table public.profiles add column if not exists communaute_bloque boolean not null default false;
alter table public.profiles add column if not exists notif_mail boolean not null default true;

-- Le verrou de colonnes (migration 006) protege aussi le blocage.
create or replace function public.proteger_colonnes_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lp.systeme', true), '') = '1' then return new; end if;
  if auth.uid() is null then return new; end if;
  if public.is_admin(auth.uid()) then return new; end if;

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
  new.communaute_bloque    := old.communaute_bloque;
  new.created_at           := old.created_at;
  return new;
end $$;

-- Membre de la communaute : tout compte du Backstage non bloque.
-- (Sur Discord, @Actif etait donne a la main parce qu'on ne savait pas
-- qui se cachait derriere un compte Discord. Ici, chaque compte a ete
-- cree par Jerome apres paiement : l'adhesion est automatique.)
create or replace function public.comm_membre(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not communaute_bloque from public.profiles where id = uid), false);
$$;

-- ------------------------------------------------------------
-- 2) Salons, calques sur le serveur Discord de Jerome
-- ------------------------------------------------------------
create table if not exists public.comm_salons (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  nom         text not null,
  categorie   text not null check (categorie in ('info', 'communaute', 'bonus')),
  description text,
  ordre       int not null default 0,
  ecriture    text not null default 'tous' check (ecriture in ('tous', 'moderateurs')),
  created_at  timestamptz default now()
);

insert into public.comm_salons (slug, nom, categorie, description, ordre, ecriture) values
  ('annonces', 'annonces', 'info', 'Les annonces de l''école : rentrées, jalons de cohorte, nouveautés.', 1, 'moderateurs'),
  ('regles', 'règles', 'info', 'Les règles de la communauté.', 2, 'moderateurs'),
  ('general', 'général', 'communaute', 'Échange et entraide, DJ et MAO réunis.', 10, 'tous'),
  ('showcase', 'showcase', 'communaute', 'Tes mix et tes prods finis, à partager.', 11, 'tous'),
  ('feedback-mix', 'feedback-mix', 'communaute', 'Tes travaux en cours : demande des retours aux autres élèves.', 12, 'tous'),
  ('ressources', 'ressources', 'communaute', 'Liens VST, sample packs, banques partenaires, par Jérôme.', 13, 'moderateurs'),
  ('contenu-exclusif', 'contenu-exclusif', 'bonus', 'Les replays des Zoom collectifs et les tips bonus.', 20, 'moderateurs')
on conflict (slug) do nothing;

alter table public.comm_salons enable row level security;
drop policy if exists "comm_salons_lecture" on public.comm_salons;
drop policy if exists "comm_salons_admin" on public.comm_salons;
create policy "comm_salons_lecture" on public.comm_salons
  for select to authenticated using (public.comm_membre(auth.uid()));
create policy "comm_salons_admin" on public.comm_salons
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3) Conversations privees
-- ------------------------------------------------------------
create table if not exists public.comm_conversations (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  dernier_message_le timestamptz default now()
);

create table if not exists public.comm_participants (
  conversation_id uuid not null references public.comm_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  lu_le           timestamptz default now(),
  primary key (conversation_id, user_id)
);
create index if not exists comm_participants_user_idx on public.comm_participants(user_id);

create or replace function public.comm_participe(conv uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comm_participants where conversation_id = conv and user_id = uid);
$$;

alter table public.comm_conversations enable row level security;
alter table public.comm_participants enable row level security;
drop policy if exists "comm_conv_lecture" on public.comm_conversations;
drop policy if exists "comm_part_lecture" on public.comm_participants;
create policy "comm_conv_lecture" on public.comm_conversations
  for select to authenticated using (public.comm_participe(id, auth.uid()));
create policy "comm_part_lecture" on public.comm_participants
  for select to authenticated using (public.comm_participe(conversation_id, auth.uid()));

-- ------------------------------------------------------------
-- 4) Messages (salons et conversations privees)
-- ------------------------------------------------------------
create table if not exists public.comm_messages (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid references public.comm_salons(id) on delete cascade,
  conversation_id uuid references public.comm_conversations(id) on delete cascade,
  parent_id       uuid references public.comm_messages(id) on delete cascade,
  auteur_id       uuid not null references auth.users(id) on delete cascade,
  contenu         text not null default '' check (char_length(contenu) <= 4000),
  mentions        uuid[] not null default '{}',
  fichier_chemin  text,
  fichier_type    text,
  fichier_nom     text,
  fichier_taille  int,
  epingle         boolean not null default false,
  nb_reponses     int not null default 0,
  dernier_reponse_le timestamptz,
  modifie_le      timestamptz,
  supprime_le     timestamptz,
  created_at      timestamptz not null default now(),
  check ((salon_id is null) <> (conversation_id is null))
);
create index if not exists comm_messages_salon_idx on public.comm_messages(salon_id, created_at desc) where parent_id is null;
create index if not exists comm_messages_conv_idx on public.comm_messages(conversation_id, created_at desc);
create index if not exists comm_messages_parent_idx on public.comm_messages(parent_id, created_at);

alter table public.comm_messages enable row level security;
drop policy if exists "comm_msg_lecture" on public.comm_messages;
drop policy if exists "comm_msg_ecriture" on public.comm_messages;

create policy "comm_msg_lecture" on public.comm_messages
  for select to authenticated using (
    public.comm_membre(auth.uid()) and (
      salon_id is not null
      or public.comm_participe(conversation_id, auth.uid())
    )
  );

-- Ecriture : son propre message, membre non bloque. Dans un salon en
-- lecture seule (annonces, regles, ressources, contenu-exclusif), seul
-- Jerome publie, mais tout le monde peut repondre en fil.
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
  );
-- Pas de policy update/delete : tout passe par les fonctions ci-dessous.

-- Compteur de reponses et fraicheur des conversations
create or replace function public.comm_apres_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null then
    update public.comm_messages
       set nb_reponses = nb_reponses + 1, dernier_reponse_le = new.created_at
     where id = new.parent_id;
  end if;
  if new.conversation_id is not null then
    update public.comm_conversations set dernier_message_le = new.created_at where id = new.conversation_id;
  end if;
  return new;
end $$;
drop trigger if exists comm_apres_message on public.comm_messages;
create trigger comm_apres_message after insert on public.comm_messages
  for each row execute function public.comm_apres_message();

-- ------------------------------------------------------------
-- 5) Reactions
-- ------------------------------------------------------------
create table if not exists public.comm_reactions (
  message_id uuid not null references public.comm_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);
alter table public.comm_reactions enable row level security;
drop policy if exists "comm_react_lecture" on public.comm_reactions;
drop policy if exists "comm_react_ajout" on public.comm_reactions;
drop policy if exists "comm_react_retrait" on public.comm_reactions;
create policy "comm_react_lecture" on public.comm_reactions
  for select to authenticated using (
    exists (select 1 from public.comm_messages m where m.id = message_id)
  );
create policy "comm_react_ajout" on public.comm_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and public.comm_membre(auth.uid())
    and exists (select 1 from public.comm_messages m where m.id = message_id and m.supprime_le is null)
  );
create policy "comm_react_retrait" on public.comm_reactions
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 6) Lectures (pastilles de non-lus) et notifications
-- ------------------------------------------------------------
create table if not exists public.comm_lectures (
  user_id  uuid not null references auth.users(id) on delete cascade,
  salon_id uuid not null references public.comm_salons(id) on delete cascade,
  lu_le    timestamptz not null default now(),
  primary key (user_id, salon_id)
);
alter table public.comm_lectures enable row level security;
drop policy if exists "comm_lectures_siennes" on public.comm_lectures;
create policy "comm_lectures_siennes" on public.comm_lectures
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.comm_notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  message_id     uuid not null references public.comm_messages(id) on delete cascade,
  type           text not null check (type in ('mention', 'prive', 'reponse', 'annonce')),
  lu             boolean not null default false,
  mail_envoye_le timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists comm_notifs_user_idx on public.comm_notifications(user_id, lu, created_at desc);
alter table public.comm_notifications enable row level security;
drop policy if exists "comm_notifs_siennes" on public.comm_notifications;
drop policy if exists "comm_notifs_lu" on public.comm_notifications;
create policy "comm_notifs_siennes" on public.comm_notifications
  for select to authenticated using (user_id = auth.uid());
create policy "comm_notifs_lu" on public.comm_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Qui est prevenu d'un nouveau message :
--   message prive       -> l'autre participant
--   reponse en fil      -> l'auteur du message d'origine
--   @mention            -> la personne mentionnee
--   annonce / contenu   -> tous les membres (publication de Jerome, hors fil)
create or replace function public.comm_notifier()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if new.conversation_id is not null then
    insert into public.comm_notifications (user_id, message_id, type)
      select p.user_id, new.id, 'prive' from public.comm_participants p
       where p.conversation_id = new.conversation_id and p.user_id <> new.auteur_id
      on conflict do nothing;
    return new;
  end if;

  if cardinality(new.mentions) > 0 then
    insert into public.comm_notifications (user_id, message_id, type)
      select pr.id, new.id, 'mention' from public.profiles pr
       where pr.id = any(new.mentions) and pr.id <> new.auteur_id
      on conflict do nothing;
  end if;

  if new.parent_id is not null then
    insert into public.comm_notifications (user_id, message_id, type)
      select m.auteur_id, new.id, 'reponse' from public.comm_messages m
       where m.id = new.parent_id and m.auteur_id <> new.auteur_id
      on conflict do nothing;
  else
    select slug into v_slug from public.comm_salons where id = new.salon_id;
    if v_slug in ('annonces', 'contenu-exclusif') and public.is_admin(new.auteur_id) then
      insert into public.comm_notifications (user_id, message_id, type)
        select pr.id, new.id, 'annonce' from public.profiles pr
         where pr.id <> new.auteur_id and not pr.communaute_bloque
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comm_notifier on public.comm_messages;
create trigger comm_notifier after insert on public.comm_messages
  for each row execute function public.comm_notifier();

-- ------------------------------------------------------------
-- 7) Signalements
-- ------------------------------------------------------------
create table if not exists public.comm_signalements (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.comm_messages(id) on delete set null,
  auteur_id   uuid references auth.users(id) on delete set null,
  signale_par uuid references auth.users(id) on delete set null,
  raison      text,
  extrait     text,
  traite      boolean not null default false,
  created_at  timestamptz default now()
);
alter table public.comm_signalements enable row level security;
drop policy if exists "comm_signal_admin" on public.comm_signalements;
create policy "comm_signal_admin" on public.comm_signalements
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 8) Fonctions appelees par l'app
-- ------------------------------------------------------------

-- Annuaire des membres : ce que les autres voient de toi (le profil
-- complet reste prive, RLS de profiles).
create or replace function public.comm_membres()
returns table (id uuid, nom text, pseudo_dj text, photo_url text, moderateur boolean)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.prenom, ''), split_part(p.nom, ' ', 1), 'Membre'),
         p.pseudo_dj, p.photo_url, p.role = 'admin'
    from public.profiles p
   where public.comm_membre(auth.uid())
     and not p.communaute_bloque
   order by p.role = 'admin' desc, coalesce(p.pseudo_dj, p.prenom, p.nom);
$$;

-- Ouvrir (ou retrouver) une conversation privee a deux
create or replace function public.comm_ouvrir_prive(p_autre uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.comm_membre(auth.uid()) or not public.comm_membre(p_autre) or p_autre = auth.uid() then
    raise exception 'conversation impossible' using errcode = '42501';
  end if;
  select a.conversation_id into v
    from public.comm_participants a
    join public.comm_participants b on b.conversation_id = a.conversation_id and b.user_id = p_autre
   where a.user_id = auth.uid()
     and (select count(*) from public.comm_participants c where c.conversation_id = a.conversation_id) = 2
   limit 1;
  if v is null then
    insert into public.comm_conversations default values returning id into v;
    insert into public.comm_participants (conversation_id, user_id) values (v, auth.uid()), (v, p_autre);
  end if;
  return v;
end $$;

-- Mes conversations privees, avec l'autre participant et les non-lus
create or replace function public.comm_mes_prives()
returns table (conversation_id uuid, autre_id uuid, dernier_message_le timestamptz, non_lus int)
language sql stable security definer set search_path = public as $$
  select c.id, o.user_id, c.dernier_message_le,
         (select count(*)::int from public.comm_messages m
           where m.conversation_id = c.id and m.auteur_id <> auth.uid()
             and m.created_at > me.lu_le and m.supprime_le is null)
    from public.comm_participants me
    join public.comm_conversations c on c.id = me.conversation_id
    join public.comm_participants o on o.conversation_id = c.id and o.user_id <> me.user_id
   where me.user_id = auth.uid()
     and exists (select 1 from public.comm_messages m where m.conversation_id = c.id)
   order by c.dernier_message_le desc;
$$;

-- Non-lus par salon (messages de premier niveau, hors les miens)
create or replace function public.comm_non_lus_salons()
returns table (salon_id uuid, non_lus int)
language sql stable security definer set search_path = public as $$
  select s.id,
         (select count(*)::int from public.comm_messages m
           where m.salon_id = s.id and m.parent_id is null and m.auteur_id <> auth.uid()
             and m.supprime_le is null
             and m.created_at > coalesce(
               (select l.lu_le from public.comm_lectures l where l.user_id = auth.uid() and l.salon_id = s.id),
               (select coalesce(p.active_le, p.created_at) from public.profiles p where p.id = auth.uid())))
    from public.comm_salons s
   where public.comm_membre(auth.uid());
$$;

-- Marquer lu (salon ou conversation) et les notifications qui vont avec
create or replace function public.comm_marquer_lu(p_salon uuid default null, p_conversation uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_salon is not null then
    insert into public.comm_lectures (user_id, salon_id, lu_le) values (auth.uid(), p_salon, now())
      on conflict (user_id, salon_id) do update set lu_le = now();
    update public.comm_notifications n set lu = true
      from public.comm_messages m
     where n.message_id = m.id and n.user_id = auth.uid() and not n.lu
       and (m.salon_id = p_salon);
  end if;
  if p_conversation is not null then
    update public.comm_participants set lu_le = now()
     where conversation_id = p_conversation and user_id = auth.uid();
    update public.comm_notifications n set lu = true
      from public.comm_messages m
     where n.message_id = m.id and n.user_id = auth.uid() and not n.lu
       and m.conversation_id = p_conversation;
  end if;
end $$;

-- Modifier son message
create or replace function public.comm_modifier(p_id uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_contenu, '')) > 4000 then raise exception 'message trop long'; end if;
  update public.comm_messages set contenu = p_contenu, modifie_le = now()
   where id = p_id and auteur_id = auth.uid() and supprime_le is null;
  if not found then raise exception 'modification impossible' using errcode = '42501'; end if;
end $$;

-- Supprimer : l'auteur, ou Jerome. Le contenu est efface, la place reste
-- (les reponses en fil gardent leur contexte).
create or replace function public.comm_supprimer(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_chemin text;
begin
  select fichier_chemin into v_chemin from public.comm_messages
   where id = p_id and supprime_le is null
     and (auteur_id = auth.uid() or public.is_admin(auth.uid()));
  if not found then raise exception 'suppression impossible' using errcode = '42501'; end if;
  update public.comm_messages
     set contenu = '', fichier_chemin = null, fichier_type = null, fichier_nom = null,
         fichier_taille = null, epingle = false, supprime_le = now()
   where id = p_id;
  return v_chemin;   -- l'app efface le fichier du stockage avec ce chemin
end $$;

-- Epingler : Jerome seulement
create or replace function public.comm_epingler(p_id uuid, p_epingle boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'reserve a l''admin' using errcode = '42501'; end if;
  update public.comm_messages set epingle = p_epingle where id = p_id and salon_id is not null;
end $$;

-- Signaler un message a Jerome
create or replace function public.comm_signaler(p_id uuid, p_raison text)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.comm_messages where id = p_id;
  if m.id is null or not public.comm_membre(auth.uid()) then raise exception 'signalement impossible'; end if;
  if m.conversation_id is not null and not public.comm_participe(m.conversation_id, auth.uid()) then
    raise exception 'signalement impossible';
  end if;
  insert into public.comm_signalements (message_id, auteur_id, signale_par, raison, extrait)
    values (p_id, m.auteur_id, auth.uid(), left(p_raison, 500), left(m.contenu, 500));
end $$;

-- Bloquer / debloquer un membre : Jerome seulement
create or replace function public.comm_bloquer(p_user uuid, p_bloque boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) or public.is_admin(p_user) then
    raise exception 'blocage impossible' using errcode = '42501';
  end if;
  perform set_config('lp.systeme', '1', true);
  update public.profiles set communaute_bloque = p_bloque where id = p_user;
end $$;

-- Mails recapitulatifs : appele par le script serveur (cle serveur).
-- Rend, par personne, les notifications non lues de plus de 10 minutes
-- pas encore envoyees, et les marque envoyees.
create or replace function public.comm_notifs_a_envoyer(p_cle text)
returns table (user_id uuid, email text, prenom text, nb int, details jsonb)
language plpgsql security definer set search_path = public as $$
begin
  perform private.verifier_cle(p_cle);
  -- Tant que les eleves voient Discord, la Communaute maison n'est qu'un
  -- apercu admin : aucun mail ne part.
  if coalesce((select valeur from public.reglages_app where cle = 'communaute_mode'), 'discord') <> 'maison' then
    return;
  end if;
  return query
  with a_envoyer as (
    select n.id, n.user_id, n.type, n.created_at, m.contenu, m.salon_id, m.conversation_id,
           coalesce(nullif(pa.pseudo_dj, ''), nullif(pa.prenom, ''), split_part(pa.nom, ' ', 1)) as de,
           s.nom as salon
      from public.comm_notifications n
      join public.comm_messages m on m.id = n.message_id
      join public.profiles pr on pr.id = n.user_id
      left join public.profiles pa on pa.id = m.auteur_id
      left join public.comm_salons s on s.id = m.salon_id
     where not n.lu and n.mail_envoye_le is null
       and n.created_at < now() - interval '10 minutes'
       and n.created_at > now() - interval '3 days'
       and pr.notif_mail and not pr.communaute_bloque and pr.email is not null
       and m.supprime_le is null
  ), marques as (
    update public.comm_notifications n set mail_envoye_le = now()
      from a_envoyer a where n.id = a.id
    returning n.id
  )
  select a.user_id, pr.email, pr.prenom, count(*)::int,
         jsonb_agg(jsonb_build_object('type', a.type, 'de', a.de, 'salon', a.salon,
                   'extrait', left(a.contenu, 160)) order by a.created_at)
    from a_envoyer a join public.profiles pr on pr.id = a.user_id
   where exists (select 1 from marques)
   group by a.user_id, pr.email, pr.prenom;
end $$;

-- ------------------------------------------------------------
-- 9) Fichiers (audio, images, PDF), bucket prive
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communaute', 'communaute', false, 26214400,
        array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/aac','audio/mp4','audio/x-m4a','audio/ogg','audio/flac','audio/x-flac',
              'image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comm_fichiers_lecture" on storage.objects;
drop policy if exists "comm_fichiers_depot" on storage.objects;
drop policy if exists "comm_fichiers_retrait" on storage.objects;
create policy "comm_fichiers_lecture" on storage.objects
  for select to authenticated using (bucket_id = 'communaute' and public.comm_membre(auth.uid()));
create policy "comm_fichiers_depot" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'communaute' and public.comm_membre(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "comm_fichiers_retrait" on storage.objects
  for delete to authenticated using (
    bucket_id = 'communaute'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- ------------------------------------------------------------
-- 10) Temps reel
-- ------------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.comm_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comm_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comm_notifications; exception when duplicate_object then null; end;
end $$;
alter table public.comm_reactions replica identity full;

-- ------------------------------------------------------------
-- 11) Droits d'execution
-- ------------------------------------------------------------
revoke all on function public.comm_membres() from public;
revoke all on function public.comm_ouvrir_prive(uuid) from public;
revoke all on function public.comm_mes_prives() from public;
revoke all on function public.comm_non_lus_salons() from public;
revoke all on function public.comm_marquer_lu(uuid, uuid) from public;
revoke all on function public.comm_modifier(uuid, text) from public;
revoke all on function public.comm_supprimer(uuid) from public;
revoke all on function public.comm_epingler(uuid, boolean) from public;
revoke all on function public.comm_signaler(uuid, text) from public;
revoke all on function public.comm_bloquer(uuid, boolean) from public;
revoke all on function public.comm_notifs_a_envoyer(text) from public;

grant execute on function public.comm_membres() to authenticated;
grant execute on function public.comm_ouvrir_prive(uuid) to authenticated;
grant execute on function public.comm_mes_prives() to authenticated;
grant execute on function public.comm_non_lus_salons() to authenticated;
grant execute on function public.comm_marquer_lu(uuid, uuid) to authenticated;
grant execute on function public.comm_modifier(uuid, text) to authenticated;
grant execute on function public.comm_supprimer(uuid) to authenticated;
grant execute on function public.comm_epingler(uuid, boolean) to authenticated;
grant execute on function public.comm_signaler(uuid, text) to authenticated;
grant execute on function public.comm_bloquer(uuid, boolean) to authenticated;
grant execute on function public.comm_notifs_a_envoyer(text) to anon, authenticated;
