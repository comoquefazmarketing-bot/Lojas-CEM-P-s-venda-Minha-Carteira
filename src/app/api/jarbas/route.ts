import { createClient } from '@/lib/supabase/server';
import { Cliente, StatusKey, STATUS } from '@/types';
import { dentroDoLimite } from '@/lib/rateLimit';
import { hojeIsoBrasil } from '@/lib/dataBrasil';
import { normalizeText } from '@/lib/produtos';

export const dynamic = 'force-dynamic';
// com a carteira grande (200+ clientes), o prompt fica pesado e o Gemini demora mais pra
// responder — sem isso, o limite padrão da função no Vercel mata a requisição no meio do
// caminho e o app mostra "não consegui me conectar", mesmo com a internet normal
export const maxDuration = 60;

const SISTEMA_PROMPT_BASE = `Você é o Jarbas, assistente pessoal de vendas do Felipe, vendedor das Lojas CEM (móveis e eletrodomésticos, com pós-venda por carnê). Seu estilo é direto, estratégico e motivador — um parceiro de confiança, não um robô formal. Responda sempre em português do Brasil, em respostas curtas (no máximo 3-4 parágrafos curtos, ou uma lista objetiva quando fizer sentido) e SEMPRE termine o raciocínio — nunca corte uma frase pela metade. Escreva em texto puro, sem formatação markdown (sem **negrito**, sem #, sem colchetes) — a tela exibe exatamente o texto que você mandar. Você recebe abaixo o resumo da carteira E a lista completa de cada cliente com seus dados — use a lista completa pra responder perguntas específicas (quem comprou tal produto, qual o maior valor, quando foi a compra, etc.), fazendo você mesmo a busca/comparação/ranking necessário. Baseie suas respostas de dados SOMENTE nas informações fornecidas abaixo — nunca invente números, nomes ou situações que não estejam nos dados. Se não souber algo porque não está nos dados, diga isso.

Você conhece a metodologia de vendas que a própria Lojas CEM ensina aos vendedores (treinamento "Foco — Formação Comercial por Resultados") e deve usá-la como referência sempre que der conselho estratégico ou de abordagem — não invente outro método de vendas genérico.

MÉTODO APONTE (as 6 etapas da venda na Lojas CEM):
A — Aborde positivamente
P — Pesquise o convidado
O — Ofereça uma demonstração envolvente
N — Negocie e neutralize objeções
T — Tome a iniciativa e feche a venda
E — Estenda o relacionamento (pós-venda)
Quando o Felipe pedir estratégia de abordagem ou disser que está travado com um cliente/prospect, identifique em qual etapa do APONTE ele provavelmente está e dê o conselho a partir dali.

AS 8 ATITUDES VENCEDORAS (mentalidade que a loja cobra do vendedor):
1. De manhã me levanto para vencer
2. Sou movido a metas e objetivos
3. Não desperdiço tempo
4. Penso, logo vendo
5. O medo não me domina
6. Nunca desisto
7. Acredito na força do entusiasmo
8. Aprendo alguma coisa todo dia
Quando o Felipe pedir motivação, ou parecer desanimado/inseguro na pergunta, puxe gancho de uma ou duas dessas atitudes (não precisa listar todas de uma vez) em vez de dar uma frase motivacional genérica de internet.

VOCÊ TAMBÉM PODE AGIR, NÃO SÓ CONVERSAR — usando as ferramentas disponíveis:
- criar_lembrete: agenda algo pro Felipe numa data/hora. Use quando ele pedir claramente pra lembrar de algo (ex: "me lembra de ligar pro João amanhã às 10h"), ou quando você sugerir um lembrete e ele topar.
- marcar_contato_feito: registra que ele acabou de contatar um cliente específico. Use só quando ele disser claramente que já falou/ligou/mandou mensagem pra alguém, citando o nome.
Só use uma ferramenta quando o pedido for claro — nunca aja por conta própria em algo que ele não pediu ou confirmou. Se o nome do cliente citado for ambíguo (bater com mais de um) ou não existir na lista de clientes, pergunte antes de agir, não tente adivinhar. Você NÃO tem permissão pra excluir clientes, mudar valores, status ou qualquer outro dado — só criar lembretes e marcar contato feito são ações liberadas pra você hoje.

TENHA INICIATIVA: você não é só uma central de respostas — é um parceiro que puxa assunto. Se, respondendo qualquer pergunta, você notar algo urgente e relacionado nos dados (um atrasado que ele não mencionou, a meta apertando, um follow-up vencido), comenta rapidinho no final da resposta, sem que ele precise perguntar por aquilo também.`;

function buildResumo(clientes: Cliente[], metaMensal: number | null): string {
  const hojeIso = hojeIsoBrasil();
  const mesAtual = hojeIso.slice(0, 7); // 'YYYY-MM'

  const porStatus: Record<StatusKey, number> = { PROSPECT: 0, ATIVO: 0, ATRASADO: 0, NEGOCIANDO: 0, QUITADO: 0 };
  let vendasMes = 0;
  let contatosVencidos = 0;

  clientes.forEach(c => {
    porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
    if (c.data_compra && c.valor_total && c.data_compra.slice(0, 7) === mesAtual) {
      vendasMes += c.valor_total;
    }
    if (c.proximo_contato && c.proximo_contato <= hojeIso) contatosVencidos++;
  });

  const convertidos = clientes.filter(c => c.data_conversao).length;
  const aindaProspect = porStatus.PROSPECT;
  const taxaConversao = (convertidos + aindaProspect) > 0
    ? Math.round((convertidos / (convertidos + aindaProspect)) * 100)
    : null;

  return [
    `Total de clientes na carteira: ${clientes.length}`,
    `Por status — Ativos: ${porStatus.ATIVO} · Atrasados: ${porStatus.ATRASADO} · Negociando: ${porStatus.NEGOCIANDO} · Quitados: ${porStatus.QUITADO} · Prospects: ${porStatus.PROSPECT}`,
    metaMensal
      ? `Meta do mês: R$ ${metaMensal.toFixed(2)} · Vendido até agora este mês: R$ ${vendasMes.toFixed(2)}`
      : `Sem meta de vendas definida pro mês. Vendido até agora este mês: R$ ${vendasMes.toFixed(2)}`,
    `Contatos de follow-up vencidos (hoje ou antes): ${contatosVencidos}`,
    taxaConversao !== null
      ? `Taxa histórica de conversão de prospect em venda: ${taxaConversao}% (${convertidos} convertidos de ${convertidos + aindaProspect} prospects já registrados)`
      : 'Ainda não há prospects convertidos registrados.',
  ].join('\n');
}

function formatDateBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function buildClientesDetalhado(clientes: Cliente[]): string {
  const nomePorId = new Map(clientes.map(c => [c.id, c.nome]));
  return clientes
    .map(c => {
      const campos: string[] = [`status: ${STATUS[c.status]?.label ?? c.status}`];
      if (c.produto) campos.push(`produto: ${c.produto}`);
      if (c.valor_total) campos.push(`valor total: R$ ${c.valor_total.toFixed(2)}`);
      if (c.forma_pagamento === 'PARCELADO' && c.valor_parcela) {
        const parcelas = c.numero_parcelas ? ` em ${c.numero_parcelas}x` : '';
        const venc = c.dia_vencimento ? `, vence dia ${c.dia_vencimento}` : '';
        campos.push(`parcela: R$ ${c.valor_parcela.toFixed(2)}${parcelas}${venc}`);
      }
      const dataCompra = formatDateBR(c.data_compra);
      if (dataCompra) campos.push(`comprou em: ${dataCompra}`);
      const proxContato = formatDateBR(c.proximo_contato);
      if (proxContato) campos.push(`próximo contato: ${proxContato}`);
      const ultContato = formatDateBR(c.ultimo_contato);
      if (ultContato) campos.push(`último contato: ${ultContato}`);
      const aniversario = formatDateBR(c.data_nascimento);
      if (aniversario) campos.push(`aniversário: ${aniversario}`);
      if (c.indicado_por && nomePorId.has(c.indicado_por)) campos.push(`indicado por: ${nomePorId.get(c.indicado_por)}`);
      if (c.telefone) campos.push(`telefone: ${c.telefone}`);
      if (c.observacoes) campos.push(`obs: "${c.observacoes}"`);
      return `- ${c.nome} — ${campos.join(' | ')}`;
    })
    .join('\n');
}

function buildPrioridades(clientes: Cliente[]): string {
  const hojeIso = hojeIsoBrasil();
  const lista: string[] = [];
  clientes.forEach(c => {
    if (c.status === 'ATRASADO') { lista.push(`- ${c.nome}: pagamento em atraso`); return; }
    if (c.proximo_contato && c.proximo_contato <= hojeIso) { lista.push(`- ${c.nome}: contato de follow-up vencido`); return; }
  });
  return lista.length > 0 ? lista.slice(0, 8).join('\n') : 'Nenhum cliente com pendência urgente hoje.';
}

/* ------------------------------- ferramentas (autonomia) ------------------------------- */

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'criar_lembrete',
      description: 'Cria um lembrete pro Felipe numa data e hora específica, que aparece no app quando chegar a hora. Use quando ele pedir explicitamente pra lembrar de algo, ou quando você sugerir um lembrete e ele topar.',
      parameters: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'O que lembrar — texto curto e direto (ex: "Ligar pro João sobre a geladeira").' },
          data_hora_iso: { type: 'string', description: 'Data e hora em ISO 8601 com fuso de Brasília (ex: 2026-08-20T10:00:00-03:00). Se o Felipe não disser a hora exata, use 09:00.' },
        },
        required: ['texto', 'data_hora_iso'],
      },
    },
    {
      name: 'marcar_contato_feito',
      description: 'Marca que o Felipe acabou de contatar um cliente específico da carteira — atualiza o último contato e limpa qualquer follow-up pendente marcado pra ele. Use só quando ele disser claramente que já falou/ligou/mandou mensagem pra alguém, citando o nome.',
      parameters: {
        type: 'object',
        properties: {
          nome_cliente: { type: 'string', description: 'Nome do cliente, o mais parecido possível com o que está na lista da carteira.' },
        },
        required: ['nome_cliente'],
      },
    },
  ],
}];

type ResolucaoCliente =
  | { status: 'ok'; cliente: Cliente }
  | { status: 'ambiguo'; nomes: string[] }
  | { status: 'nao_encontrado' };

function resolverCliente(nomeBusca: string, clientes: Cliente[]): ResolucaoCliente {
  const alvo = normalizeText(nomeBusca.trim());
  if (!alvo) return { status: 'nao_encontrado' };

  const exatos = clientes.filter(c => normalizeText(c.nome) === alvo);
  if (exatos.length === 1) return { status: 'ok', cliente: exatos[0] };
  if (exatos.length > 1) return { status: 'ambiguo', nomes: exatos.map(c => c.nome) };

  const parciais = clientes.filter(c => {
    const nome = normalizeText(c.nome);
    return nome.includes(alvo) || alvo.includes(nome);
  });
  if (parciais.length === 1) return { status: 'ok', cliente: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', nomes: parciais.map(c => c.nome) };

  return { status: 'nao_encontrado' };
}

type ResultadoAcao = {
  ok: boolean;
  mensagemParaIA: string;
  acao?: { tipo: string; detalhe: string };
};

async function executarFuncao(
  nome: string,
  args: Record<string, unknown>,
  ctx: { supabase: Awaited<ReturnType<typeof createClient>>; clientes: Cliente[] }
): Promise<ResultadoAcao> {
  const { supabase, clientes } = ctx;

  if (nome === 'criar_lembrete') {
    const texto = typeof args.texto === 'string' ? args.texto.trim() : '';
    const dataHoraIso = typeof args.data_hora_iso === 'string' ? args.data_hora_iso : '';
    const dataHora = new Date(dataHoraIso);
    if (!texto || Number.isNaN(dataHora.getTime())) {
      return { ok: false, mensagemParaIA: 'Não consegui criar o lembrete — faltou o texto ou a data/hora não é válida. Pergunta os detalhes de novo.' };
    }
    const { error } = await supabase.from('lembretes').insert({ texto, data_hora: dataHora.toISOString() });
    if (error) return { ok: false, mensagemParaIA: 'Deu erro ao tentar salvar o lembrete.' };
    const dataFormatada = dataHora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return {
      ok: true,
      mensagemParaIA: `Lembrete criado: "${texto}" pra ${dataFormatada}.`,
      acao: { tipo: 'lembrete', detalhe: `${texto} — ${dataFormatada}` },
    };
  }

  if (nome === 'marcar_contato_feito') {
    const nomeCliente = typeof args.nome_cliente === 'string' ? args.nome_cliente : '';
    const resolvido = resolverCliente(nomeCliente, clientes);
    if (resolvido.status === 'nao_encontrado') {
      return { ok: false, mensagemParaIA: `Não achei nenhum cliente chamado "${nomeCliente}" na carteira. Confirma o nome certo.` };
    }
    if (resolvido.status === 'ambiguo') {
      return { ok: false, mensagemParaIA: `Tem mais de um cliente parecido com "${nomeCliente}": ${resolvido.nomes.join(', ')}. Pergunta qual dos dois é.` };
    }
    const { cliente } = resolvido;
    const { error } = await supabase
      .from('clientes')
      .update({ ultimo_contato: hojeIsoBrasil(), proximo_contato: null })
      .eq('id', cliente.id);
    if (error) return { ok: false, mensagemParaIA: `Deu erro ao tentar atualizar o contato de ${cliente.nome}.` };
    return {
      ok: true,
      mensagemParaIA: `Contato com ${cliente.nome} marcado como feito hoje.`,
      acao: { tipo: 'contato', detalhe: cliente.nome },
    };
  }

  return { ok: false, mensagemParaIA: `Não reconheço a ação "${nome}".` };
}

/* ------------------------------- Gemini ------------------------------- */

function esperar(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// o Gemini às vezes devolve 503 quando o modelo está sobrecarregado do lado do Google —
// é passageiro e geralmente já resolve numa nova tentativa poucos segundos depois, então
// tenta de novo em vez de já desistir e mostrar erro pro Felipe
async function chamarGemini(systemPrompt: string, contents: unknown[], usarFerramentas = true): Promise<Response> {
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    ...(usarFerramentas ? { tools: TOOLS } : {}),
    generationConfig: { maxOutputTokens: 2048 },
  });

  const esperasEntreTentativas = [0, 400, 1000];
  let ultimaResposta: Response | null = null;
  for (const espera of esperasEntreTentativas) {
    if (espera > 0) await esperar(espera);
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    if (res.ok || res.status !== 503) return res;
    ultimaResposta = res;
  }
  return ultimaResposta as Response;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Não autorizado', { status: 401 });

  // no máximo 30 mensagens a cada 10 minutos por pessoa — evita custo alto de API
  // mesmo com uma conta já autenticada (comprometida ou mal-intencionada)
  const podeUsar = await dentroDoLimite(`jarbas:${user.id}`, 30, 10);
  if (!podeUsar) {
    return new Response(
      JSON.stringify({ error: 'Muitas mensagens em pouco tempo — espera alguns minutos e tenta de novo.' }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'O Jarbas ainda não foi configurado — falta adicionar a chave da API do Gemini.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const body = await request.json().catch(() => null);
  const ehAbertura = body?.abertura === true;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!ehAbertura && messages.length === 0) return new Response('Mensagem vazia', { status: 400 });

  const [{ data: clientesData }, { data: configData }] = await Promise.all([
    supabase.from('clientes').select('*'),
    supabase.from('configuracoes').select('meta_mensal').maybeSingle(),
  ]);
  const clientes = (clientesData ?? []) as Cliente[];
  const resumo = buildResumo(clientes, configData?.meta_mensal ?? null);
  const prioridades = buildPrioridades(clientes);
  const clientesDetalhado = buildClientesDetalhado(clientes);

  const systemPrompt = `${SISTEMA_PROMPT_BASE}\n\nRESUMO DA CARTEIRA HOJE:\n${resumo}\n\nQUEM PRECISA DE ATENÇÃO HOJE:\n${prioridades}\n\nLISTA COMPLETA DE CLIENTES:\n${clientesDetalhado}`;

  const contents = ehAbertura
    ? [{
        role: 'user',
        parts: [{ text: 'Abre a conversa puxando assunto sozinho, sem esperar eu perguntar nada — uma saudação curta (1-2 frases) que já comente algo específico e relevante do resumo de hoje (meta, prioridade urgente, etc.). Não use nenhuma ferramenta agora, só fala.' }],
      }]
    : messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

  try {
    const res = await chamarGemini(systemPrompt, contents, !ehAbertura);

    if (!res.ok) {
      const corpoErro = await res.text().catch(() => '');
      console.error('Jarbas: erro da API do Gemini', res.status, corpoErro);
      return new Response(
        JSON.stringify({
          error: res.status === 503
            ? 'O Gemini (a IA por trás do Jarbas) está sobrecarregado do lado do Google agora — já tentei de novo automaticamente algumas vezes. Espera um pouco e tenta de novo.'
            : 'Não consegui falar com o Jarbas agora. Tenta de novo em instantes.',
          debug: { geminiStatus: res.status, geminiBody: corpoErro.slice(0, 500) },
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const data = await res.json();
    const parts: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> =
      data?.candidates?.[0]?.content?.parts ?? [];
    const chamada = parts.find(p => p.functionCall)?.functionCall;

    if (chamada) {
      const resultado = await executarFuncao(chamada.name, chamada.args ?? {}, { supabase, clientes });

      // manda a resposta da função de volta pro modelo pra ele confirmar com a própria
      // voz — se essa segunda chamada falhar por qualquer razão, a ação já foi executada
      // de qualquer forma, então cai numa confirmação pronta em vez de falhar silenciosamente
      try {
        const contentsComFuncao = [
          ...contents,
          { role: 'model', parts: [{ functionCall: { name: chamada.name, args: chamada.args ?? {} } }] },
          { role: 'function', parts: [{ functionResponse: { name: chamada.name, response: { resultado: resultado.mensagemParaIA } } }] },
        ];
        const res2 = await chamarGemini(systemPrompt, contentsComFuncao);
        if (res2.ok) {
          const data2 = await res2.json();
          const parts2: Array<{ text?: string }> = data2?.candidates?.[0]?.content?.parts ?? [];
          const reply2 = parts2.find(p => p.text)?.text;
          if (reply2) {
            return new Response(
              JSON.stringify({ reply: reply2, acao: resultado.ok ? resultado.acao : undefined }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
        }
      } catch {
        // segue pro fallback abaixo
      }

      return new Response(
        JSON.stringify({ reply: resultado.mensagemParaIA, acao: resultado.ok ? resultado.acao : undefined }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    const reply = parts.find(p => p.text)?.text ?? 'Não consegui pensar em uma resposta agora.';
    return new Response(JSON.stringify({ reply }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui me conectar com o Jarbas.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
