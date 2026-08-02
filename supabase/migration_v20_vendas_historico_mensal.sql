-- Migração v20 — histórico mensal de vendas, com possibilidade de sobrescrever um mês
-- manualmente (ex: mês em que nem toda venda foi lançada individualmente no app)
-- Rode isso no SQL Editor do Supabase

create table if not exists public.vendas_historico_mensal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes text not null,
  valor_total numeric not null,
  observacoes text,
  criado_em timestamptz not null default now(),
  unique (user_id, mes)
);

create index if not exists vendas_historico_mensal_user_id_idx on public.vendas_historico_mensal(user_id, mes);

alter table public.vendas_historico_mensal enable row level security;

drop policy if exists "vendas_historico_mensal_select_own" on public.vendas_historico_mensal;
create policy "vendas_historico_mensal_select_own" on public.vendas_historico_mensal
  for select using (auth.uid() = user_id);

drop policy if exists "vendas_historico_mensal_insert_own" on public.vendas_historico_mensal;
create policy "vendas_historico_mensal_insert_own" on public.vendas_historico_mensal
  for insert with check (auth.uid() = user_id);

drop policy if exists "vendas_historico_mensal_update_own" on public.vendas_historico_mensal;
create policy "vendas_historico_mensal_update_own" on public.vendas_historico_mensal
  for update using (auth.uid() = user_id);

drop policy if exists "vendas_historico_mensal_delete_own" on public.vendas_historico_mensal;
create policy "vendas_historico_mensal_delete_own" on public.vendas_historico_mensal
  for delete using (auth.uid() = user_id);
