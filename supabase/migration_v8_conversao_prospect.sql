-- Migração v9 — rastreio automático de conversão de prospect em venda
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

alter table public.clientes
  add column if not exists data_conversao date;
