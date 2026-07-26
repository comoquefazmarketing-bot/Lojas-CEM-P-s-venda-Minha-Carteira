-- Migração v11 — memória do Jarbas (histórico persistente de conversas)
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

create table if not exists public.jarbas_mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  criado_em timestamptz not null default now()
);

create index if not exists jarbas_mensagens_user_id_idx on public.jarbas_mensagens(user_id, criado_em);

alter table public.jarbas_mensagens enable row level security;

drop policy if exists "jarbas_mensagens_select_own" on public.jarbas_mensagens;
create policy "jarbas_mensagens_select_own" on public.jarbas_mensagens
  for select using (auth.uid() = user_id);

drop policy if exists "jarbas_mensagens_insert_own" on public.jarbas_mensagens;
create policy "jarbas_mensagens_insert_own" on public.jarbas_mensagens
  for insert with check (auth.uid() = user_id);

drop policy if exists "jarbas_mensagens_delete_own" on public.jarbas_mensagens;
create policy "jarbas_mensagens_delete_own" on public.jarbas_mensagens
  for delete using (auth.uid() = user_id);
