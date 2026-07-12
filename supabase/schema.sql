-- Carteira de Clientes CEM — schema
-- Rode isso no SQL Editor do Supabase (projeto novo)

create extension if not exists "pgcrypto";

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  produto text,
  valor_total numeric,
  valor_parcela numeric,
  numero_parcelas integer,
  data_compra date,
  dia_vencimento integer,
  status text not null default 'ATIVO' check (status in ('ATIVO','ATRASADO','QUITADO','NEGOCIANDO')),
  observacoes text,
  proximo_contato date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists clientes_user_id_idx on public.clientes(user_id);

-- Row Level Security: cada usuário só vê/edita os próprios clientes
alter table public.clientes enable row level security;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes
  for select using (auth.uid() = user_id);

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes
  for insert with check (auth.uid() = user_id);

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own" on public.clientes
  for delete using (auth.uid() = user_id);

-- Mantém atualizado_em sempre em dia
create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clientes_atualizado_em on public.clientes;
create trigger trg_clientes_atualizado_em
before update on public.clientes
for each row execute function public.set_atualizado_em();
