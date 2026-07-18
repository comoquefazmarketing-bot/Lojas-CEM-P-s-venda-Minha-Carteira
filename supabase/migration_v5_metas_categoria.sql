-- Migração v5 — metas de vendas por categoria de produto (móveis / TV / outros)
-- Rode isso no SQL Editor do Supabase (depois de já ter rodado as migrations anteriores)

alter table public.configuracoes
  add column if not exists meta_moveis numeric,
  add column if not exists meta_tv numeric,
  add column if not exists meta_outros numeric;
