-- Migração v19 — tabela de controle de tentativas, pra travar força bruta (código de
-- convite, chamadas de IA) sem depender de infraestrutura extra.
-- Rode isso no SQL Editor do Supabase

create table if not exists public.rate_limit_tentativas (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  criado_em timestamptz not null default now()
);

create index if not exists rate_limit_tentativas_chave_idx on public.rate_limit_tentativas(chave, criado_em);

alter table public.rate_limit_tentativas enable row level security;
-- de propósito, nenhuma policy criada aqui — só a service role (usada nas rotas de
-- servidor, que bypassa RLS) consegue ler/escrever essa tabela.

-- o bucket "ofertas" estava sem limite de tamanho nem tipo de arquivo definido (aceitava
-- qualquer coisa até 50MB) — restringe a imagens até 15MB
update storage.buckets
set file_size_limit = 15728640, -- 15MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'ofertas';
