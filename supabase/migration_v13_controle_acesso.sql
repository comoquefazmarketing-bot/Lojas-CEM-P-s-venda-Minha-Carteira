-- Migração v13 — controle de acesso (ativar/desativar vendedor)
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

alter table public.profiles add column if not exists ativo boolean not null default true;
