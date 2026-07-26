-- Migração v12 — lembretes criados a partir do Jarbas
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null,
  data_hora timestamptz not null,
  cumprido boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists lembretes_user_id_idx on public.lembretes(user_id, data_hora);

alter table public.lembretes enable row level security;

drop policy if exists "lembretes_select_own" on public.lembretes;
create policy "lembretes_select_own" on public.lembretes
  for select using (auth.uid() = user_id);

drop policy if exists "lembretes_insert_own" on public.lembretes;
create policy "lembretes_insert_own" on public.lembretes
  for insert with check (auth.uid() = user_id);

drop policy if exists "lembretes_update_own" on public.lembretes;
create policy "lembretes_update_own" on public.lembretes
  for update using (auth.uid() = user_id);

drop policy if exists "lembretes_delete_own" on public.lembretes;
create policy "lembretes_delete_own" on public.lembretes
  for delete using (auth.uid() = user_id);
