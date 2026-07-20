-- Migração v7 — status "Prospect" (só demonstrou interesse, ainda vai comprar)
-- e valor de sinal (entrada dada por alguns clientes na compra)
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

alter table public.clientes
  drop constraint if exists clientes_status_check;

alter table public.clientes
  add constraint clientes_status_check
    check (status in ('ATIVO', 'ATRASADO', 'QUITADO', 'NEGOCIANDO', 'PROSPECT'));

alter table public.clientes
  add column if not exists valor_sinal numeric;
