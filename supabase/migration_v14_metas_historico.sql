-- Migração v14 — histórico de "em quantos dias bati a meta" mês a mês
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

create table if not exists public.metas_historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes text not null,
  meta_mensal numeric not null,
  dia_meta_batida int not null,
  data_meta_batida date not null,
  criado_em timestamptz not null default now(),
  unique (user_id, mes)
);

create index if not exists metas_historico_user_id_idx on public.metas_historico(user_id, mes);

alter table public.metas_historico enable row level security;

drop policy if exists "metas_historico_select_own" on public.metas_historico;
create policy "metas_historico_select_own" on public.metas_historico
  for select using (auth.uid() = user_id);

drop policy if exists "metas_historico_insert_own" on public.metas_historico;
create policy "metas_historico_insert_own" on public.metas_historico
  for insert with check (auth.uid() = user_id);

drop policy if exists "metas_historico_update_own" on public.metas_historico;
create policy "metas_historico_update_own" on public.metas_historico
  for update using (auth.uid() = user_id);
