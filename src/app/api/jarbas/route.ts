import { createClient } from '@/lib/supabase/server';
import { Cliente, StatusKey } from '@/types';

export const dynamic = 'force-dynamic';

const SISTEMA_PROMPT_BASE = `Você é o Jarbas, assistente pessoal de vendas do Felipe, vendedor das Lojas CEM (móveis e eletrodomésticos, com pós-venda por carnê). Seu estilo é direto, estratégico e motivador — um parceiro de confiança, não um robô formal. Responda sempre em português do Brasil, em respostas curtas (no máximo 3-4 parágrafos curtos, ou uma lista objetiva quando fizer sentido). Baseie suas respostas de dados SOMENTE nos números fornecidos abaixo — nunca invente números, nomes ou situações que não estejam nos dados. Se não souber algo porque não está nos dados, diga isso.

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
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const hojeIso = hoje.toISOString().slice(0, 10);

  const porStatus: Record<StatusKey, number> = { PROSPECT: 0, ATIVO: 0, ATRASADO: 0, NEGOCIANDO: 0, QUITADO: 0 };
  let vendasMes = 0;
  let contatosVencidos = 0;

  clientes.forEach(c => {
    porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
    if (c.data_compra && c.valor_total) {
      const d = new Date(c.data_compra);
      if (d.getFullYear() === anoAtual && d.getMonth() === mesAtual) vendasMes += c.valor_total;
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

function buildPrioridades(clientes: Cliente[]): string {
  const hojeIso = new Date().toISOString().slice(0, 10);
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'O Jarbas ainda não foi configurado — falta adicionar a chave da API da Anthropic.' }),
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

  const systemPrompt = `${SISTEMA_PROMPT_BASE}\n\nRESUMO DA CARTEIRA HOJE:\n${resumo}\n\nQUEM PRECISA DE ATENÇÃO HOJE:\n${prioridades}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Não consegui falar com o Jarbas agora. Tenta de novo em instantes.' }), {
        status: 502, headers: { 'content-type': 'application/json' },
      });
    }

    const data = await res.json();
    const reply = data?.content?.[0]?.text ?? 'Não consegui pensar em uma resposta agora.';
    return new Response(JSON.stringify({ reply }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui me conectar com o Jarbas.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
