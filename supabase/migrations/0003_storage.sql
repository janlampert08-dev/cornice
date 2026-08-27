-- Storage-Bucket für Fahrt-Fotos (route_completions.foto_url).
-- Pfadkonvention: {user_id}/{dateiname} — Policies erzwingen das über
-- das erste Pfadsegment (storage.foldername(name)).

insert into storage.buckets (id, name, public)
values ('route-photos', 'route-photos', true)
on conflict (id) do nothing;

create policy "Fahrt-Fotos sind öffentlich lesbar"
  on storage.objects for select
  using (bucket_id = 'route-photos');

create policy "Nutzer laden Fotos in eigenen Ordner hoch"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Nutzer löschen eigene Fahrt-Fotos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
