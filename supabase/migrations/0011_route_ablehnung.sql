-- Streckenvorschläge werden bei Ablehnung nicht mehr per DELETE entfernt,
-- sondern per weichem "abgelehnt"-Status markiert, damit der Ersteller den
-- Status seines Vorschlags (Ausstehend/Abgelehnt/Bewilligt) im eigenen
-- Profil nachvollziehen kann.

alter table public.routes
  add column abgelehnt_am timestamptz;

comment on column public.routes.abgelehnt_am is
  'Zeitpunkt der Ablehnung durch einen Moderator, sonst NULL (ausstehend oder bewilligt).';
