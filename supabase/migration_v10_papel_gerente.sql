-- Migração v10 — papel de gerente (visão consolidada de todos os vendedores)
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)

-- Tabela leve com o papel de cada usuário (vendedor por padrão) e um jeito de
-- mostrar o email de cada um sem precisar de acesso administrativo no front.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'vendedor' check (role in ('vendedor', 'gerente')),
  criado_em timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- função auxiliar: true se o usuário logado é gerente (security definer pra
-- poder ler a tabela profiles mesmo com RLS ligado, sem virar referência circular)
create or replace function public.is_gerente()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'gerente'
  );
$$;

-- cada um vê o próprio perfil; gerente vê o perfil de todo mundo (pra montar o ranking)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = user_id or public.is_gerente());

-- preenche profiles pra quem já tinha conta antes dessa migração (fica como vendedor)
insert into public.profiles (user_id, email, role)
select id, email, 'vendedor' from auth.users
on conflict (user_id) do nothing;

-- libera leitura (só leitura) pro gerente em clientes e configuracoes de todo mundo
-- inserir/editar/excluir continua restrito ao dono, como já era
drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes
  for select using (auth.uid() = user_id or public.is_gerente());

drop policy if exists "config_select_own" on public.configuracoes;
create policy "config_select_own" on public.configuracoes
  for select using (auth.uid() = user_id or public.is_gerente());

-- Pra promover alguém a gerente, depois que a pessoa já tiver criado a conta em
-- /cadastro, rode (trocando o email):
-- update public.profiles set role = 'gerente' where email = 'email-do-gerente@exemplo.com';
