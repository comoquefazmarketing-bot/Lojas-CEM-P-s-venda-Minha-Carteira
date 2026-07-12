-- Migração v2 — inteligência de vendas e pós-venda
-- Rode isso no SQL Editor do Supabase (depois de já ter rodado o schema.sql original)

alter table public.clientes
  add column if not exists data_nascimento date,
  add column if not exists indicado_por uuid references public.clientes(id) on delete set null,
  add column if not exists ultimo_contato date;

create index if not exists clientes_indicado_por_idx on public.clientes(indicado_por);

-- Tabela de configuração pessoal (meta de vendas do mês)
create table if not exists public.configuracoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meta_mensal numeric,
  atualizado_em timestamptz not null default now()
);

alter table public.configuracoes enable row level security;

drop policy if exists "config_select_own" on public.configuracoes;
create policy "config_select_own" on public.configuracoes
  for select using (auth.uid() = user_id);

drop policy if exists "config_upsert_own" on public.configuracoes;
create policy "config_upsert_own" on public.configuracoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "config_update_own" on public.configuracoes;
create policy "config_update_own" on public.configuracoes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
