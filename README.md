# Carteira de Clientes — CEM

App pessoal de pós-venda: cadastro de clientes, controle de carnê (parcelas, término previsto),
status (Ativo / Atrasado / Quitado / Negociando) e lembretes de contato pós-venda.

Stack: Next.js + Supabase (Auth + Postgres com RLS) + Vercel.

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com e crie um **projeto novo** (separado do Portal).
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria a tabela `clientes` já com Row Level Security (cada usuário só vê os próprios dados).
3. Vá em **Authentication → Providers** e confira que **Email** está habilitado.
4. Vá em **Authentication → Settings** e **desative "Allow new users to sign up"**
   (assim só você consegue logar, ninguém cria conta sozinho pelo app).
5. Vá em **Authentication → Users → Add user** e crie seu próprio usuário
   (seu email + uma senha). Marque a opção de já confirmar o email automaticamente, se aparecer.
6. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**

## 2. Rodar localmente (opcional, pra testar antes de subir)

```bash
npm install
cp .env.local.example .env.local
# cole a Project URL e a anon key no .env.local
npm run dev
```

Abra http://localhost:3000 e entre com o email/senha que você criou no passo 1.5.

## 3. Subir pro GitHub

Cria um repositório novo (ex: `carteira-cem`) e sobe todos esses arquivos e pastas
(inclusive as pastas `src/` e `supabase/` — mantendo a estrutura).

## 4. Deploy na Vercel

1. Importa o repositório na Vercel.
2. Em **Environment Variables**, adiciona:
   - `NEXT_PUBLIC_SUPABASE_URL` → a Project URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → a anon key do Supabase
3. Deploy.

Pronto — acessa a URL da Vercel, faz login com seu email/senha, e a carteira já
fica salva no Supabase (dá pra acessar do celular, do PC, de onde for).

## Novidades — Inteligência de Vendas

Depois de rodar o `schema.sql` inicial, rode também **`supabase/migration_v2_inteligencia_vendas.sql`**
no SQL Editor do Supabase (adiciona os campos novos e a tabela de meta mensal).

O que foi adicionado e por quê:

- **Ação do Dia**: painel no topo que já te diz quem contatar hoje e o motivo (atraso, carnê
  acabando em breve, aniversário, esfriando, 1 ano de compra). Prioriza automaticamente.
- **Termômetro de relacionamento** (🔥 Quente / 🙂 Morno / ❄️ Frio): baseado em quantos dias faz
  desde o último contato registrado com o cliente.
- **"Marcar contato feito"**: um clique registra que você falou com o cliente hoje, atualiza o
  termômetro e limpa o lembrete pendente.
- **Indicação (referral)**: campo "Indicado por" no cadastro. O card mostra quem indicou e quantas
  indicações aquele cliente já gerou — ajuda a identificar seus melhores promotores.
- **Selo VIP** ⭐: os 20% clientes com maior valor total gasto ganham destaque visual (Pareto).
- **Scripts de WhatsApp prontos**: pós-venda, recompra (fim de carnê), reativação, aniversário e
  pedido de indicação — clica no ícone do WhatsApp no card e escolhe o script certo pra situação.
- **Meta do mês**: define uma meta de vendas e acompanha o progresso (soma do valor total das
  compras registradas no mês atual) com barra visual.
- **Data de nascimento**: campo opcional que alimenta o alerta de aniversário na Ação do Dia e o
  script de parabéns.

## Estrutura

```
src/
  app/
    layout.tsx          shell + fontes/estilos globais
    globals.css          design system (papel/ledger, carimbos de status)
    page.tsx             redireciona pra /login ou /carteira
    login/page.tsx        tela de login
    carteira/page.tsx      protegida — renderiza o app principal
  components/
    CarteiraApp.tsx        toda a lógica: lista, filtros, formulário, CSV
  lib/supabase/
    client.ts             cliente Supabase pro navegador
    server.ts              cliente Supabase pra Server Components
    middleware.ts           renova sessão e protege /carteira
  middleware.ts
supabase/
  schema.sql               tabela `clientes` + políticas de RLS
```

## Se quiser mexer depois

- **Novo campo no cadastro**: adiciona a coluna na tabela `clientes` (SQL) e o campo
  correspondente em `src/types.ts` + no formulário dentro de `CarteiraApp.tsx`.
- **Convidar outra pessoa pra usar** (ex: outro vendedor): cria outro usuário em
  Authentication → Users. A RLS já garante que cada um só vê os próprios clientes.
- **Exportar dados**: botão "CSV" no topo do app já baixa a carteira inteira em uma planilha.
