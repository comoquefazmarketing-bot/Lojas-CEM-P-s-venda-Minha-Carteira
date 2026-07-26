-- Migração v16 — permite anexar uma imagem (arte) na oferta, além do link do Instagram
-- Rode isso no SQL Editor do Supabase (depois da migration_v15_ofertas.sql)

alter table public.ofertas add column if not exists imagem_url text;
alter table public.ofertas alter column link drop not null;

insert into storage.buckets (id, name, public)
values ('ofertas', 'ofertas', true)
on conflict (id) do nothing;

drop policy if exists "ofertas_imagens_select" on storage.objects;
create policy "ofertas_imagens_select" on storage.objects
  for select using (bucket_id = 'ofertas');

drop policy if exists "ofertas_imagens_insert" on storage.objects;
create policy "ofertas_imagens_insert" on storage.objects
  for insert with check (bucket_id = 'ofertas' and auth.uid() is not null);

drop policy if exists "ofertas_imagens_delete" on storage.objects;
create policy "ofertas_imagens_delete" on storage.objects
  for delete using (bucket_id = 'ofertas' and auth.uid() is not null);
