-- Migração v17 — adiciona nome ao perfil (pra aparecer em vez do email na visão do gerente)
-- Rode isso no SQL Editor do Supabase

alter table public.profiles add column if not exists nome text;
