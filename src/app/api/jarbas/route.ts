import { createClient } from '@/lib/supabase/server';
import { Cliente, StatusKey, STATUS } from '@/types';
import { dentroDoLimite } from '@/lib/rateLimit';
import { hojeIsoBrasil } from '@/lib/dataBrasil';

export const dynamic = 'force-dynamic';

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
Quando o Felipe pedir motivação, ou parecer desanimado/inseguro na pergunta, puxe gancho de uma ou duas dessas atitudes (não precisa listar todas de uma vez) em vez de dar uma frase motivacional genérica de internet.`;

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
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) return new Response('Mensagem vazia', { status: 400 });

  const [{ data: clientesData }, { data: configData }] = await Promise.all([
    supabase.from('clientes').select('*'),
    supabase.from('configuracoes').select('meta_mensal').maybeSingle(),
  ]);
  const clientes = (clientesData ?? []) as Cliente[];
  const resumo = buildResumo(clientes, configData?.meta_mensal ?? null);
  const prioridades = buildPrioridades(clientes);
  const clientesDetalhado = buildClientesDetalhado(clientes);

  const systemPrompt = `${SISTEMA_PROMPT_BASE}\n\nRESUMO DA CARTEIRA HOJE:\n${resumo}\n\nQUEM PRECISA DE ATENÇÃO HOJE:\n${prioridades}\n\nLISTA COMPLETA DE CLIENTES:\n${clientesDetalhado}`;

  try {
    const model = 'gemini-flash-latest';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    if (!res.ok) {
      const corpoErro = await res.text().catch(() => '');
      console.error('Jarbas: erro da API do Gemini', res.status, corpoErro);
      return new Response(
        JSON.stringify({
          error: 'Não consegui falar com o Jarbas agora. Tenta de novo em instantes.',
          debug: { geminiStatus: res.status, geminiBody: corpoErro.slice(0, 500) },
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não consegui pensar em uma resposta agora.';
    return new Response(JSON.stringify({ reply }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui me conectar com o Jarbas.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
