-- ============================================================
--  011 : l'acces au Backstage se ferme un mois apres la fin de la formation
--  Regle de Jerome (WhatsApp du 10/11/2026) : « Apres la fin de leur
--  formation il continue a y avoir acces pendant 1 mois. »
--
--  Date de reference : profiles.fin_pack (« Fin de la formation » dans la
--  fiche eleve de l'Admin, deja utilisee pour le compte a rebours des cours
--  filmes). Dernier jour d'acces = fin_pack + 1 mois (heure de Paris).
--
--  Fermeture : auth.users.banned_until. ATTENTION, ce champ veut dire
--  « bloque JUSQU'A », il ne sait pas programmer un blocage futur. Donc :
--   - une tache pg_cron passe toutes les heures et bloque (jusqu'en 2999)
--     les comptes dont le dernier jour d'acces est passe ;
--   - un trigger recalcule tout de suite quand Jerome change la date :
--     date repoussee ou effacee = compte rouvert, date deja passee = ferme.
--  Supabase Auth refuse alors la connexion et le renouvellement de session.
--  Les admins ne sont jamais fermes.
--
--  Preuve et alerte (regle 8) : chaque passe s'ecrit dans
--  private.fin_acces_passes ; le keep-alive GitHub quotidien appelle
--  controle_fin_acces() et echoue (mail GitHub) si la derniere passe a plus
--  de 3 h ou si un compte expire est encore ouvert.
-- ============================================================

-- Faut-il fermer ce profil maintenant ?
create or replace function private.acces_expire(p_role text, p_fin_pack date)
returns boolean language sql stable as $$
  select p_role is distinct from 'admin'
     and p_fin_pack is not null
     and (p_fin_pack + interval '1 month')::date
         < (now() at time zone 'Europe/Paris')::date
$$;

-- 1) Trigger : recalcul immediat quand la date ou le role change
create or replace function public.appliquer_fin_acces()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  update auth.users
     set banned_until = case when private.acces_expire(new.role, new.fin_pack)
                             then timestamptz '2999-12-31 00:00+00' else null end
   where id = new.id;
  return new;
end $$;

revoke all on function public.appliquer_fin_acces() from public;

drop trigger if exists fin_acces_un_mois on public.profiles;
create trigger fin_acces_un_mois
  after insert or update of fin_pack, role on public.profiles
  for each row execute function public.appliquer_fin_acces();

-- 2) Passe horaire : ferme les comptes arrives au bout de leur mois
create table if not exists private.fin_acces_passes (
  passe_le  timestamptz primary key default now(),
  fermes    int not null
);

create or replace function public.fermer_acces_expires()
returns int
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare n int;
begin
  update auth.users u
     set banned_until = timestamptz '2999-12-31 00:00+00'
    from public.profiles p
   where p.id = u.id
     and private.acces_expire(p.role, p.fin_pack)
     and u.banned_until is null;
  get diagnostics n = row_count;
  insert into private.fin_acces_passes (fermes) values (n);
  delete from private.fin_acces_passes where passe_le < now() - interval '30 days';
  return n;
end $$;

revoke all on function public.fermer_acces_expires() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('fermer-acces-expires')
 where exists (select 1 from cron.job where jobname = 'fermer-acces-expires');
select cron.schedule('fermer-acces-expires', '5 * * * *', 'select public.fermer_acces_expires()');

-- 3) Controle pour le keep-alive (cle anon) : des chiffres, aucune donnee eleve
create or replace function public.controle_fin_acces()
returns json
language sql
security definer
set search_path = public, auth, private
as $$
  select json_build_object(
    'derniere_passe', (select max(passe_le) from private.fin_acces_passes),
    'expires_ouverts', (select count(*) from public.profiles p join auth.users u on u.id = p.id
                         where private.acces_expire(p.role, p.fin_pack) and u.banned_until is null),
    'fermes', (select count(*) from public.profiles p join auth.users u on u.id = p.id
                where u.banned_until > now() and p.role is distinct from 'admin'));
$$;

grant execute on function public.controle_fin_acces() to anon, authenticated;

-- Premiere passe tout de suite (preuve que la fonction marche)
select public.fermer_acces_expires();

-- Verification
-- select public.controle_fin_acces();
-- select * from cron.job where jobname = 'fermer-acces-expires';
