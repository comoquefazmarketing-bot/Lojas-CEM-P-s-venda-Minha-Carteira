-- Migração v4 — histórico de interações por cliente
-- Rode isso no SQL Editor do Supabase (depois de já ter rodado as migrations anteriores)

create table if not exists public.interacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null default current_date,
  nota text not null,
  criado_em timestamptz not null default now()
);

create index if not exists interacoes_cliente_id_idx on public.interacoes(cliente_id);

alter table public.interacoes enable row level security;

drop policy if exists "interacoes_select_own" on public.interacoes;
create policy "interacoes_select_own" on public.interacoes
  for select using (auth.uid() = user_id);

drop policy if exists "interacoes_insert_own" on public.interacoes;
create policy "interacoes_insert_own" on public.interacoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "interacoes_delete_own" on public.interacoes;
create policy "interacoes_delete_own" on public.interacoes
  for delete using (auth.uid() = user_id);
