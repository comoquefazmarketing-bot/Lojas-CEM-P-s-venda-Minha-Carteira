-- Migração v18 — meta da loja (visível a todos, editável só pelo gerente) e libera o
-- gerente ler interações/histórico de meta de todo mundo, pra montar os indicadores
-- por vendedor no painel gerencial.
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

create table if not exists public.meta_loja (
  id uuid primary key default gen_random_uuid(),
  valor numeric not null,
  atualizado_em timestamptz not null default now()
);

alter table public.meta_loja enable row level security;

drop policy if exists "meta_loja_select_all" on public.meta_loja;
create policy "meta_loja_select_all" on public.meta_loja
  for select using (auth.role() = 'authenticated');

-- escrita feita só pela rota /api/gerente/meta-loja (service role, checa papel de gerente
-- no código) — sem policy de insert/update aqui de propósito.

-- libera leitura (só leitura) pro gerente também em interações e histórico de meta de
-- todo mundo, do mesmo jeito que já foi feito pra clientes/configuracoes na migração v10
drop policy if exists "interacoes_select_own" on public.interacoes;
create policy "interacoes_select_own" on public.interacoes
  for select using (auth.uid() = user_id or public.is_gerente());

drop policy if exists "metas_historico_select_own" on public.metas_historico;
create policy "metas_historico_select_own" on public.metas_historico
  for select using (auth.uid() = user_id or public.is_gerente());
