-- ============================================================
--  Loops & Play, Migration 007 : cours MAO en visio (219 EUR)
--  Demande de Jerome dans son mail du 25/09/2026 : le cours visio
--  doit apparaitre dans la page d'inscription, avec son lien Stripe.
--  Ce que le cours ouvre dans le Backstage n'est pas tranche : par
--  defaut, discipline MAO sans bloc video. Jerome ajuste dans la fiche.
-- ============================================================

alter table public.inscriptions drop constraint if exists inscriptions_formation_check;
alter table public.inscriptions add constraint inscriptions_formation_check
  check (formation in ('pack1','pack2','pack3','annee','dj119','mao119','visio219'));

alter table public.profiles drop constraint if exists profiles_formule_check;
alter table public.profiles add constraint profiles_formule_check
  check (formule in ('pack1','pack2','pack3','annee','dj119','mao119','visio219'));

create or replace function public.acces_formule(p_formule text, p_discipline text,
  out mix_pack text, out mao_pack text, out discipline text)
language plpgsql immutable as $$
declare niveau text;
begin
  discipline := case
    when p_formule = 'pack3'    then 'les_deux'
    when p_formule = 'dj119'    then 'dj'
    when p_formule in ('mao119', 'visio219') then 'mao'
    else p_discipline end;
  if discipline not in ('dj','mao','les_deux') or discipline is null then
    raise exception 'discipline manquante pour la formule %', p_formule;
  end if;
  -- Cours visio : pas de bloc video par defaut (a confirmer par Jerome).
  if p_formule = 'visio219' then
    mix_pack := null;
    mao_pack := null;
    return;
  end if;
  niveau := case when p_formule = 'pack1' then 'demo' else 'headliner' end;
  mix_pack := case when discipline in ('dj','les_deux')  then niveau end;
  mao_pack := case when discipline in ('mao','les_deux') then niveau end;
end $$;

revoke all on function public.acces_formule(text, text) from public;
