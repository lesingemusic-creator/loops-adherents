-- ============================================================
--  010 : la formation en ligne devient un produit a part (01/10/2026)
--  Demande de Jerome (mail du 01/10 10h25) : « Plus aucun pack ne donne
--  acces a la formation en ligne. » Seuls les cours en ligne (dj119,
--  mao119) ouvrent les videos, en entier dans leur discipline. Packs,
--  formules a l'annee et visio : aucun acces video par defaut. Jerome peut
--  toujours ouvrir l'acces a la main depuis la fiche de l'eleve (Admin).
-- ============================================================

create or replace function public.acces_formule(p_formule text, p_discipline text,
  out mix_pack text, out mao_pack text, out discipline text)
language plpgsql immutable as $$
begin
  discipline := case
    when p_formule = 'pack3'    then 'les_deux'
    when p_formule = 'dj119'    then 'dj'
    when p_formule in ('mao119', 'visio219') then 'mao'
    else p_discipline end;
  if discipline not in ('dj','mao','les_deux') or discipline is null then
    raise exception 'discipline manquante pour la formule %', p_formule;
  end if;
  mix_pack := case when p_formule = 'dj119'  then 'headliner' end;
  mao_pack := case when p_formule = 'mao119' then 'headliner' end;
end $$;

revoke all on function public.acces_formule(text, text) from public;

-- Verifications
-- select * from public.acces_formule('pack2','mao');   -> null, null, mao
-- select * from public.acces_formule('dj119',null);    -> headliner, null, dj
-- select * from public.acces_formule('mao119',null);   -> null, headliner, mao
