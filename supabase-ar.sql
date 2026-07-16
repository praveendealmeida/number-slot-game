-- ─── Plan My Wardrobe — AR storage (run once in Supabase SQL Editor) ───
-- Public bucket to host exported GLB/USDZ models for "View in My Room" AR.
insert into storage.buckets (id, name, public)
values ('ar-models','ar-models', true)
on conflict (id) do update set public = true;

-- Authenticated companies can upload their own AR models
drop policy if exists "ar upload" on storage.objects;
create policy "ar upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ar-models');

-- Anyone can read (so the phone's AR viewer can fetch the model)
drop policy if exists "ar public read" on storage.objects;
create policy "ar public read" on storage.objects for select to public
  using (bucket_id = 'ar-models');
