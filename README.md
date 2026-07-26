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

## Novidades — Memória do Jarbas

Rode **`supabase/migration_v11_jarbas_memoria.sql`** no SQL Editor do Supabase (cria a tabela
`jarbas_mensagens`, com RLS igual às outras — cada um só vê a própria conversa).

- O Jarbas agora lembra das conversas de um dia pro outro, em vez de esquecer tudo ao fechar o chat.
- Todo dia, o cron de notificações (`api/cron/notificacoes-diarias`) grava um "Bom dia" no histórico
  do Jarbas com as prioridades do dia — na próxima vez que você abrir o chat, ele já aparece lá.
- Sem essa migração o app continua funcionando normalmente, só que sem memória (cada conversa
  recomeça do zero).

## Novidades — Lembretes a partir do Jarbas

Rode **`supabase/migration_v12_lembretes.sql`** no SQL Editor do Supabase (cria a tabela
`lembretes`, com RLS igual às outras).

- Qualquer resposta do Jarbas ganha um botão "Salvar como lembrete" — escolhe data/hora e pronto.
- Um painel "Lembretes" aparece no topo do dashboard assim que a data/hora chega (não precisa de
  push nem do app aberto no horário exato — ele aparece na próxima vez que você abrir o app).
- Clica em "Concluído" pra tirar da lista depois de resolver.

## Novidades — Controle de acesso (gerente)

Rode **`supabase/migration_v13_controle_acesso.sql`** no SQL Editor do Supabase (adiciona a
coluna `ativo` na tabela `profiles`).

- Quem tem o papel `gerente` agora vê uma seção "Usuários com acesso" no painel gerencial, com
  todo mundo que já criou conta — dá pra **promover/rebaixar** (vendedor ↔ gerente) e
  **ativar/desativar** o acesso de qualquer um, direto pela tela (sem precisar mexer no Supabase).
- Vendedor desativado é deslogado automaticamente e não consegue mais entrar (aparece um aviso na
  tela de login) — útil quando alguém sai da empresa.
- **Transparência de dados**: o Jarbas agora avisa, embaixo da caixa de mensagem, que as perguntas
  e os dados de clientes usados nas respostas são enviados pra API do Google Gemini.

## Novidades — LGPD, modo offline e transferência de carteira

Sem migração nova pra essa leva.

- **Exportar dados (LGPD)**: no cadastro/edição de um cliente já existente, o botão "Exportar
  dados" baixa um `.json` com tudo que o app guarda sobre aquela pessoa (cadastro + histórico de
  anotações) — pra atender pedido de acesso/portabilidade de dados.
- **Aviso de offline**: uma faixa vermelha aparece no topo quando o celular/PC perde conexão,
  avisando que as informações na tela podem estar desatualizadas.
- **Transferir carteira**: na seção "Usuários com acesso" (papel gerente), dá pra escolher um
  vendedor de destino e transferir todos os clientes (e o histórico de anotações junto) de um
  vendedor pro outro — útil quando alguém troca de loja ou sai da empresa.

## Novidades — Histórico de "dias até bater a meta"

Rode **`supabase/migration_v14_metas_historico.sql`** no SQL Editor do Supabase (cria a tabela
`metas_historico`, com RLS igual às outras).

- Toda vez que a meta do mês é batida, o app grava sozinho (no momento exato, sem precisar anotar
  na mão) em qual dia do mês isso aconteceu.
- O card da meta mostra "Bateu em X dias esse mês" e um histórico dos últimos meses — útil pra
  provar evolução de performance ao longo do tempo.
- Sem essa migração o app funciona normal, só sem esse histórico (a meta batida e o confete
  continuam funcionando do mesmo jeito).

## Novidades — Ofertas (Instagram) cruzadas com interesse dos clientes

Rode **`supabase/migration_v15_ofertas.sql`** no SQL Editor do Supabase (cria a tabela `ofertas`,
com RLS igual às outras).

- Painel novo "Ofertas" no dashboard: cola o link de um post/vídeo do Instagram (baixado do jeito
  que já faz hoje) junto com o nome do produto, e o app guarda isso na sua base de ofertas.
- Pra cada oferta, o app mostra automaticamente quais clientes/prospects têm esse produto como
  interesse — com um botão de WhatsApp pronto, mensagem já preenchida com o link.
- Não trava só nos "compatíveis": também dá pra escolher qualquer outro cliente da carteira e
  mandar a mesma oferta pra ele.
- Sem essa migração o app funciona normal, só sem esse painel.

## Novidades — Anexar arte (imagem) na oferta

Rode **`supabase/migration_v16_ofertas_imagem.sql`** no SQL Editor do Supabase (depois da v15 —
adiciona a coluna `imagem_url`, torna `link` opcional e cria o bucket público `ofertas` no
Storage).

- Ao cadastrar (ou editar) uma oferta, dá pra anexar uma imagem (a arte da promoção) em vez do —
  ou além do — link do Instagram. Pelo menos um dos dois precisa existir.
- A imagem aparece em miniatura no card da oferta; clicar nela abre em tamanho real numa aba nova.
- O botão de WhatsApp usa o link do Instagram se tiver, senão usa o link da própria imagem — o
  cliente sempre recebe algo clicável pra ver a oferta.
- Sem essa migração o resto do painel de Ofertas continua funcionando normal, só sem o anexo de
  imagem.

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
