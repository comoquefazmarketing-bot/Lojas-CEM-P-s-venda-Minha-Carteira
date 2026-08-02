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
- Ao escolher a imagem (no cadastro de uma oferta nova), o app manda pra mesma IA do Jarbas
  (Gemini) ler a arte e sugerir o nome do produto automaticamente — só preenche se o campo
  "Produto" ainda estiver vazio, então nunca sobrescreve o que você já digitou. Usa a mesma chave
  `GEMINI_API_KEY` já configurada pro Jarbas.

## Novidades — Nome no perfil (em vez de só o email)

Rode **`supabase/migration_v17_profiles_nome.sql`** no SQL Editor do Supabase (adiciona a coluna
`nome` em `profiles`).

- O cadastro (`/cadastro`) agora pede o nome da pessoa, além de email/senha/código.
- Na visão do gerente (ranking de vendedores, lista "Usuários com acesso", dropdown de
  transferência de carteira) e no topo da própria Carteira, mostra o nome em vez do email.
- **Contas criadas antes dessa migração não têm nome salvo** — pra corrigir uma conta existente,
  roda no SQL Editor (troca o email pelo da pessoa):
  ```sql
  update public.profiles set nome = 'Nome da Pessoa' where email = 'email@exemplo.com';
  ```
- Sem essa migração, tudo continua funcionando normal, só mostrando o email como já era antes.

## Novidades — Meta da loja e indicadores completos por vendedor

Rode **`supabase/migration_v18_meta_loja_indicadores.sql`** no SQL Editor do Supabase (cria a
tabela `meta_loja` e libera o gerente ler interações/histórico de meta de todo mundo).

- O painel do gerente agora tem uma **meta da loja** (ex: R$ 1.800.000/mês), editável clicando em
  "Definir meta"/"Editar" — igual ao card de meta do vendedor.
- Cada vendedor no ranking mostra quanto **% da meta da loja** ele está contribuindo, além da
  própria meta individual.
- Expandindo um vendedor, aparecem os indicadores: prospects ativos, conversões no mês (+ taxa de
  conversão histórica), interações de pós-venda registradas no mês, follow-ups vencidos, e em
  quantos dias bateu a meta esse mês (quando aplicável).
- Sem essa migração, o painel do gerente continua funcionando normal, só sem a meta da loja e sem
  os indicadores de interação/histórico de meta (ficam sempre zerados).
- Também: ao expandir um vendedor, mostra o **ritmo esperado pelo tempo** (proporcional aos dias
  já passados do mês, comparado com o % da meta batido), os **produtos mais vendidos** por ele
  (extraídos das vendas registradas), e a quantidade de **clientes por status** (Prospect, Ativo,
  Atrasado, Negociando, Quitado). Sem migração nenhuma pra essa parte — usa dados que já existiam.

## Novidades — Importar Listagem Loja (na Carteira do vendedor)

Sem migração nova — usa a mesma tabela `clientes` já existente (os leads viram prospects comuns,
já aparecem na lista/kanban normal).

- Nova seção "Listagem Loja" na Carteira (junto com Ofertas, Lembretes, etc.): cola uma lista de
  leads — um por linha, no formato `nome;telefone;observação opcional` — e importa tudo de uma vez
  como prospect. Útil pra importar relatórios de indicação/agradecimento do sistema da loja.

## Novidades — Camadas de segurança contra força bruta e abuso

Rode **`supabase/migration_v19_rate_limit.sql`** no SQL Editor do Supabase (cria a tabela
`rate_limit_tentativas` e restringe o bucket `ofertas` a imagens até 15MB).

Levantamento feito nas rotas da API (`src/app/api/**/route.ts`):

- **Login (senha)**: passa direto pela API do Supabase Auth (`signInWithPassword`), que já tem
  limite de tentativas por padrão na própria infraestrutura deles — não precisa de código extra
  aqui.
- **`/api/convite` (código de convite)** — esse era o ponto real de risco: não tinha nenhum limite
  de tentativas, dava pra tentar milhares de códigos por script até acertar. Agora:
  - Máximo de 8 tentativas a cada 15 minutos por IP (tabela `rate_limit_tentativas`, sem precisar
    de Redis ou infraestrutura extra).
  - Comparação do código em tempo constante (`timingSafeEqual`), pra não vazar informação por
    quanto tempo a resposta demora (timing attack).
- **`/api/jarbas` e `/api/ofertas/analisar-imagem`** (chamam a API do Gemini, que tem custo): já
  exigiam login; agora também têm limite por pessoa (30 mensagens/10min no Jarbas, 20
  imagens/10min na análise de oferta) — protege contra custo alto mesmo com uma conta já
  autenticada comprometida ou usada de forma abusiva.
- **Bucket `ofertas` no Storage**: estava sem limite de tamanho nem tipo de arquivo definido
  (aceitava qualquer coisa até 50MB). Agora só aceita imagens (jpeg/png/webp/gif) até 15MB.
- **Rotas `/api/gerente/*`**: já exigiam checar o papel de gerente no banco a cada chamada (não só
  confiar no que a tela mostra) — confirmado, sem mudança necessária.
- Sem essa migração, essas rotas continuam funcionando normal (o helper de rate limit falha
  "aberto" de propósito — um problema na tabela de controle não pode derrubar login/cadastro) só
  que sem limite nenhum de tentativas até a migração rodar.

## Novidades — Senha forte e cabeçalhos de segurança HTTP

Sem migração nova.

- **Senha mínima mais forte**: de 6 pra 8 caracteres, exigindo pelo menos uma letra e um número
  (checado tanto na tela de cadastro quanto na API, que é a validação que realmente vale).
- **Cabeçalhos de segurança HTTP** em todas as respostas (`next.config.mjs`):
  - `Content-Security-Policy`: só permite carregar script/imagem/fonte/conexão do próprio site,
    das fontes do Google e do próprio projeto Supabase — bloqueia injeção de script de origem
    externa (XSS) e impede o site de ser carregado dentro de um `<iframe>` de outro site
    (clickjacking).
  - `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff`.
  - `Strict-Transport-Security` (força HTTPS) e `Referrer-Policy`.
  - `Permissions-Policy` bloqueando câmera/microfone/geolocalização, que o app não usa.

## Correção — bug de fuso horário fazendo vendas "sumirem" do mês

Sem migração nova.

Relatado: vendas do mês não estavam computando. Causa raiz: datas como `"2026-08-01"` (sem
horário) viram meia-noite UTC quando passadas direto pro construtor `new Date(...)` — convertido
pro horário de Brasília (fuso -3), isso "escorrega" pro dia/mês anterior. E o inverso também
acontecia: `toISOString()` (usado pra descobrir "qual é hoje") converte PRA UTC antes de formatar,
então depois das ~21h no horário do Brasil, o app já achava que era o dia seguinte.

Isso afetava, todo santo dia à noite (não só na virada do mês):
- Vendas do mês, comissão do mês, vendas por categoria e ritmo diário (`CarteiraApp`).
- Gráfico de "últimos 14 dias" (podia atribuir a venda ao dia errado).
- Contatos de follow-up vencidos, tanto na tela quanto no resumo que o Jarbas usa.
- A notificação diária por push (rodava com a data errada quando calculada perto da virada).

Corrigido criando dois jeitos seguros de lidar com data:
- No navegador (`localIso`/`parseDataLocal`, em `CarteiraApp.tsx`/`GerenteApp.tsx`): usa os
  componentes de ano/mês/dia locais em vez de `toISOString()`/`new Date(iso)` direto.
- No servidor (`hojeIsoBrasil`, em `src/lib/dataBrasil.ts`): funções de API rodam na
  infraestrutura da Vercel, que usa UTC como fuso do processo por padrão — mesmo pegando
  "hora local" ali, não seria a hora do Brasil. Usa `Intl.DateTimeFormat` com fuso
  `America/Sao_Paulo` explícito, testado e confirmado batendo certo perto da virada do dia.

## Novidades — Histórico Mensal (com ajuste manual pra meses incompletos)

Rode **`supabase/migration_v20_vendas_historico_mensal.sql`** no SQL Editor do Supabase (cria a
tabela `vendas_historico_mensal`).

- Novo painel "Histórico Mensal" na Carteira: mostra os últimos 6 meses de vendas.
- Por padrão, cada mês soma automaticamente os clientes cadastrados com `data_compra` naquele mês
  (igual já era feito só pro mês atual).
- Se um mês não teve toda venda lançada individualmente no app (ex: perdeu o ritmo de cadastro
  num mês corrido), dá pra **ajustar manualmente** o total daquele mês — sem precisar criar
  cliente fictício nenhum. O ajuste fica marcado como "ajustado manualmente" na lista, pra não se
  confundir com o valor calculado de verdade.
- Sem essa migração, o painel mostra só o total calculado automático (sem opção de ajustar).

## Correção — "dias restantes"/"vender por dia" agora considera dias úteis

Sem migração nova.

Pedido real: "dias restantes" e "vender por dia" contavam todo dia corrido do mês, inclusive
domingo — mas o vendedor não trabalha aos domingos (trabalha de segunda a sábado). Isso inflava
artificialmente a meta diária necessária.

Agora `diasRestantes` conta só dias úteis (segunda a sábado) de hoje até o fim do mês — o rótulo
na tela também muda pra "dias úteis restantes" pra deixar claro. Testado isoladamente comparando
contagem de dias corridos vs dias úteis num mês real.

## Novidades — Categoria "Indicados pela loja"

Rode **`supabase/migration_v21_origem_cliente.sql`** no SQL Editor do Supabase (adiciona a
coluna `origem` em `clientes`).

- Pedido real: categorizar clientes que vieram de relatórios de indicação da própria loja
  (geralmente gente que acabou de quitar o carnê em outra compra).
- Toda importação pelo painel **Listagem Loja** já marca automaticamente o lead como "Indicado
  pela loja" — sem precisar fazer nada extra.
- Novo chip de filtro **"Indicados pela loja"** na lista de clientes, pra separar esse grupo e
  chamar no WhatsApp especificamente.
- A etiqueta aparece direto no card do cliente (junto com "indicado por", quando tiver).
- Também dá pra marcar manualmente qualquer cliente com uma origem (campo "Origem" no
  cadastro/edição) — não fica restrito só à importação em massa.
- Sem essa migração, os campos de origem/filtro não têm efeito (o app funciona normal fora isso).

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
