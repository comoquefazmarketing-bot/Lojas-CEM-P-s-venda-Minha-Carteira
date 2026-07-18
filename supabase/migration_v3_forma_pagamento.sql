-- Migração v3 — forma de pagamento (parcelado / à vista)
-- Rode isso no SQL Editor do Supabase (depois de já ter rodado schema.sql e migration_v2)

alter table public.clientes
  add column if not exists forma_pagamento text not null default 'PARCELADO'
    check (forma_pagamento in ('PARCELADO', 'A_VISTA'));
