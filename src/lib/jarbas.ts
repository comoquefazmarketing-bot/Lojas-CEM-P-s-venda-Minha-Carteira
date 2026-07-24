// Base de conhecimento do Jarbas — funciona 100% local, sem API paga.
// Combina o método de vendas da Lojas CEM (treinamento Foco) com dados reais
// da carteira do vendedor pra dar respostas específicas, não genéricas.

export type JarbasContexto = {
  metaMensal: number | null;
  vendasMes: number;
  valorRestante: number | null;
  diasRestantes: number;
  atrasados: number;
  prospectsAbertos: number;
  convertidos: number;
  taxaConversao: number | null;
  cicloMedio: number | null;
  prioridadesHoje: { nome: string; motivo: string }[];
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const APONTE = [
  {
    letra: 'A', titulo: 'Aborde positivamente',
    dicas: [
      'Sorria e cumprimente antes de falar de produto — a primeira impressão define o resto da conversa.',
      'Evite "posso ajudar?" (o cérebro responde "não" no automático). Prefira um comentário sobre o que a pessoa está olhando.',
      'Chame pelo nome assim que souber — cria conexão na hora.',
    ],
  },
  {
    letra: 'P', titulo: 'Pesquise o convidado',
    dicas: [
      'Descubra pra quem é, onde vai usar, e o que não gosta no que tem hoje.',
      'Faça perguntas abertas ("me conta como é sua sala hoje") em vez de sim/não.',
      'Ouça mais do que fala nessa etapa — é aqui que você descobre o gatilho da venda.',
    ],
  },
  {
    letra: 'O', titulo: 'Ofereça uma demonstração envolvente',
    dicas: [
      'Deixe o cliente tocar, sentar, testar — venda de experiência fecha mais que venda de ficha técnica.',
      'Fale de benefício ("essa espuma não afunda com o tempo"), não só característica ("densidade D33").',
      'Conte um caso rápido de outro cliente satisfeito com o mesmo produto, se tiver um de cabeça.',
    ],
  },
  {
    letra: 'N', titulo: 'Negocie e neutralize objeções',
    dicas: [
      'Nunca discuta com a objeção — primeiro concorde com a preocupação, depois reapresente o valor.',
      'Use "sim, e além disso..." em vez de "mas" (o "mas" invalida o que a pessoa disse).',
      'Se travou numa objeção específica, pergunta pro Jarbas: "como lidar com objeção de preço" (ou a que for).',
    ],
  },
  {
    letra: 'T', titulo: 'Tome a iniciativa e feche a venda',
    dicas: [
      'Não espere o cliente pedir pra fechar — a maioria não pede, só decide "vou pensar" se ninguém tomar a frente.',
      'Use fechamento assumptivo: "vamos no carnê de 10x ou 12x?" em vez de "vai levar?".',
      'Peça a decisão logo depois que o cliente demonstrar sinal de interesse (pegou o produto, perguntou o preço duas vezes, etc.).',
    ],
  },
  {
    letra: 'E', titulo: 'Estenda o relacionamento',
    dicas: [
      'Registre aniversário e observações no cadastro — isso já é automático no app, só preencher.',
      'Peça indicação no fechamento, enquanto o cliente está satisfeito: "conhece alguém que também precisa?"',
      'Quando o carnê tiver terminando, já prepare a oferta de recompra — o app avisa isso sozinho na Ação do Dia.',
    ],
  },
] as const;

export const ATITUDES_VENCEDORAS = [
  'De manhã me levanto para vencer',
  'Sou movido a metas e objetivos',
  'Não desperdiço tempo',
  'Penso, logo vendo',
  'O medo não me domina',
  'Nunca desisto',
  'Acredito na força do entusiasmo',
  'Aprendo alguma coisa todo dia',
];

export const TECNICAS_FECHAMENTO = [
  { nome: 'Fechamento direto', como: 'Pergunta simples e direta: "posso fazer o pedido?". Funciona quando o cliente já deu vários sinais de compra.' },
  { nome: 'Fechamento alternativo', como: 'Oferece duas opções que já assumem a venda: "prefere a entrega terça ou quinta?", "leva na cor bege ou cinza?".' },
  { nome: 'Fechamento por resumo', como: 'Recapitula rapidinho os benefícios que o cliente já concordou antes de pedir a decisão final.' },
  { nome: 'Fechamento por urgência', como: 'Condição especial válida só até hoje, ou últimas unidades — sem forçar, só deixando claro o prazo real.' },
  { nome: 'Fechamento experimental', como: '"Se eu conseguir esse desconto/condição, fechamos agora?" — testa a real intenção antes de gastar munição.' },
  { nome: 'Fechamento pela parcela', como: 'Mostra quanto fica por mês (ou por dia) em vez do valor total — o carnê fica mais leve de decidir.' },
];

export const OBJECOES_COMUNS = [
  { objecao: 'Tá caro', resposta: 'Concorda que é um investimento, não desconta na lábia. Foca no parcelamento que cabe no bolso e na durabilidade do produto — o barato que não dura sai mais caro.' },
  { objecao: 'Vou pensar', resposta: 'Pergunta com gentileza o que especificamente ainda precisa pensar — quase sempre é uma objeção disfarçada (preço, aprovação de alguém, dúvida específica) que dá pra resolver na hora.' },
  { objecao: 'Preciso falar com esposa/marido', resposta: 'Oferece ligar juntos ali mesmo, ou reserva o produto/condição por algumas horas pra não perder a venda por falta de tempo.' },
  { objecao: 'Já tenho um', resposta: 'Pergunta como está o atual — abre a porta pra mostrar upgrade, troca, ou um segundo ambiente que ainda não tem.' },
  { objecao: 'Não tenho como pagar entrada', resposta: 'Apresenta opção sem entrada ou com entrada facilitada (o app já tem o campo de sinal pra registrar isso quando fechar).' },
];

function ultimaAtitudeAleatoria(): string {
  return ATITUDES_VENCEDORAS[Math.floor(Math.random() * ATITUDES_VENCEDORAS.length)];
}

function contemAlguma(texto: string, palavras: string[]): boolean {
  return palavras.some(p => texto.includes(p));
}

export function gerarRespostaJarbas(pergunta: string, ctx: JarbasContexto): string {
  const t = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  // motivação
  if (contemAlguma(t, ['motiv', 'desanim', 'cansa', 'desist', 'forca', 'animo', 'medo'])) {
    const atitude = ultimaAtitudeAleatoria();
    return `Bora, Felipe. Lembra de uma das 8 Atitudes Vencedoras: "${atitude}".\n\nDia ruim existe, mas não define o mês. Você já vendeu ${formatBRL(ctx.vendasMes)} até agora — é resultado de esforço real, não sorte. Escolhe um nome da sua lista de hoje e faz o primeiro contato agora, antes de pensar demais.`;
  }

  // prioridades / quem contatar hoje
  if (contemAlguma(t, ['priorid', 'quem eu ligo', 'quem contat', 'quem devo', 'hoje', 'quem priorizar'])) {
    if (ctx.prioridadesHoje.length === 0) {
      return 'Hoje não tem ninguém urgente pendente — aproveita pra trabalhar prospects e pedir indicação (etapa E do APONTE: estender o relacionamento).';
    }
    const lista = ctx.prioridadesHoje.slice(0, 5).map(p => `- ${p.nome}: ${p.motivo}`).join('\n');
    return `Pela sua carteira, essa é a ordem de prioridade de hoje:\n\n${lista}\n\nComeça pelo primeiro da lista.`;
  }

  // meta / vendas
  if (contemAlguma(t, ['meta', 'quanto falta', 'bater a meta', 'vendas do mes', 'como estao minhas vendas', 'como estou'])) {
    if (!ctx.metaMensal) {
      return `Você ainda não definiu uma meta do mês no app — sem meta, fica difícil medir progresso. Vendido até agora: ${formatBRL(ctx.vendasMes)}. Bora definir uma meta lá em cima, no card "Meta do mês"?`;
    }
    const restante = ctx.valorRestante ?? 0;
    if (restante <= 0) {
      return `🏆 Meta batida! Você já vendeu ${formatBRL(ctx.vendasMes)} de ${formatBRL(ctx.metaMensal)}. Agora é hora de esticar o resultado — quem na sua carteira tá "morno" e merece um follow-up extra esse mês?`;
    }
    return `Faltam ${formatBRL(restante)} pra bater a meta de ${formatBRL(ctx.metaMensal)}, com ${ctx.diasRestantes} dia${ctx.diasRestantes > 1 ? 's' : ''} restante${ctx.diasRestantes > 1 ? 's' : ''} no mês. Dá pra dividir isso em vendas por dia — foca em quem já demonstrou interesse antes de correr atrás de gente nova do zero.`;
  }

  // conversão / funil / prospects
  if (contemAlguma(t, ['convers', 'funil', 'taxa', 'ciclo'])) {
    const partes: string[] = [];
    partes.push(`Você tem ${ctx.prospectsAbertos} prospect${ctx.prospectsAbertos !== 1 ? 's' : ''} em aberto e já converteu ${ctx.convertidos}.`);
    if (ctx.taxaConversao !== null) partes.push(`Sua taxa histórica de conversão é ${ctx.taxaConversao}%.`);
    if (ctx.cicloMedio !== null) partes.push(`Em média, um prospect leva ${ctx.cicloMedio.toFixed(1)} dias até virar venda.`);
    partes.push('Se a taxa tá baixa, o gargalo costuma estar na etapa N do APONTE (negociar e neutralizar objeção) — pergunta "como lidar com objeção" que eu te ajudo.');
    return partes.join(' ');
  }

  // atrasados
  if (contemAlguma(t, ['atrasad', 'inadimpl', 'nao pagou'])) {
    if (ctx.atrasados === 0) return 'Nenhum cliente atrasado agora — carteira em dia. 👍';
    return `Você tem ${ctx.atrasados} cliente${ctx.atrasados > 1 ? 's' : ''} atrasado${ctx.atrasados > 1 ? 's' : ''}. Prioriza ligar hoje mesmo — quanto mais o atraso esfria, mais difícil fica reverter. Aborda com tom de parceria, não de cobrança ("percebi que ficou em aberto, aconteceu algo?"), não de acusação.`;
  }

  // fechamento
  if (contemAlguma(t, ['fech', 'fechar venda', 'como fecho', 'travei'])) {
    const lista = TECNICAS_FECHAMENTO.map(tec => `- **${tec.nome}**: ${tec.como}`).join('\n');
    return `Técnicas de fechamento (etapa T do APONTE — tome a iniciativa):\n\n${lista}\n\nEscolhe a que combina com o momento do cliente — não precisa usar todas.`;
  }

  // objeções
  if (contemAlguma(t, ['objec', 'caro', 'vou pensar', 'nao tenho dinheiro', 'recus', 'nao quer'])) {
    const achou = OBJECOES_COMUNS.find(o => t.includes('caro') && o.objecao === 'Tá caro')
      || OBJECOES_COMUNS.find(o => t.includes('pensar') && o.objecao === 'Vou pensar')
      || OBJECOES_COMUNS.find(o => (t.includes('esposa') || t.includes('marido') || t.includes('conversar')) && o.objecao.includes('esposa'))
      || OBJECOES_COMUNS.find(o => t.includes('ja tenho') && o.objecao === 'Já tenho um')
      || OBJECOES_COMUNS.find(o => t.includes('entrada') && o.objecao.includes('entrada'));
    if (achou) return `Objeção "${achou.objecao}": ${achou.resposta}`;
    const lista = OBJECOES_COMUNS.map(o => `- **${o.objecao}**: ${o.resposta}`).join('\n');
    return `As objeções mais comuns e como responder (etapa N do APONTE):\n\n${lista}`;
  }

  // abordagem / prospect / primeiro contato
  if (contemAlguma(t, ['abord', 'prospect', 'primeiro contato', 'puxar assunto', 'novo cliente'])) {
    const a = APONTE[0], p = APONTE[1];
    return `Abordagem (A) e pesquisa (P) do APONTE:\n\n**${a.titulo}**\n${a.dicas.map(d => `- ${d}`).join('\n')}\n\n**${p.titulo}**\n${p.dicas.map(d => `- ${d}`).join('\n')}`;
  }

  // método APONTE geral
  if (contemAlguma(t, ['aponte', 'metodo', 'processo de venda', 'etapa da venda'])) {
    const lista = APONTE.map(e => `**${e.letra} — ${e.titulo}**`).join('\n');
    return `O método APONTE da Lojas CEM tem 6 etapas:\n\n${lista}\n\nMe pergunta sobre qualquer uma delas (ex: "como negociar objeção") que eu detalho.`;
  }

  // atitudes vencedoras
  if (contemAlguma(t, ['atitude', 'vencedor'])) {
    const lista = ATITUDES_VENCEDORAS.map((a, i) => `${i + 1}. ${a}`).join('\n');
    return `As 8 Atitudes Vencedoras da Lojas CEM:\n\n${lista}`;
  }

  return 'Ainda não entendi essa — hoje eu ajudo com: motivação, prioridades de hoje, sua meta, taxa de conversão, clientes atrasados, técnicas de fechamento, objeções comuns, e o método APONTE. Tenta perguntar sobre um desses.';
}
