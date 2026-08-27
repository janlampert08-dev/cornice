-- Erlaubt Nutzern, ihre eigenen abgelehnten Streckenvorschläge endgültig zu
-- löschen (z.B. um die Liste im Profil aufzuräumen). Bewilligte oder noch
-- ausstehende eigene Strecken bleiben davon unberührt.
create policy "Nutzer können eigene abgelehnte Vorschläge löschen"
  on public.routes for delete
  using (erstellt_von = auth.uid() and abgelehnt_am is not null);
