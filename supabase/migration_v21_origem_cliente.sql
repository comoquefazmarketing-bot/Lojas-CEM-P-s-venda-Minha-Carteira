-- Migração v21 — origem do cliente (ex: "Indicado pela loja"), pra filtrar/etiquetar
-- Rode isso no SQL Editor do Supabase

alter table public.clientes add column if not exists origem text;
