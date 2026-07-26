-- Migração v15 — banco de ofertas (ex: vídeos do Instagram) pra oferecer aos clientes
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

create table if not exists public.ofertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto text not null,
  link text not null,
  observacoes text,
  criado_em timestamptz not null default now()
);

create index if not exists ofertas_user_id_idx on public.ofertas(user_id, criado_em);

alter table public.ofertas enable row level security;

drop policy if exists "ofertas_select_own" on public.ofertas;
create policy "ofertas_select_own" on public.ofertas
  for select using (auth.uid() = user_id);

drop policy if exists "ofertas_insert_own" on public.ofertas;
create policy "ofertas_insert_own" on public.ofertas
  for insert with check (auth.uid() = user_id);

drop policy if exists "ofertas_delete_own" on public.ofertas;
create policy "ofertas_delete_own" on public.ofertas
  for delete using (auth.uid() = user_id);
