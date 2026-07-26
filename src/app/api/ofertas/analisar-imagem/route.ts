import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROMPT = `Essa imagem é uma arte promocional de oferta da Lojas CEM (loja de móveis e eletrodomésticos). Esse tipo de arte quase sempre segue este padrão visual:

1. Um banner colorido no topo (tipo "SUPERMÊS DE ANIVERSÁRIO" ou parecido) com a logo da loja.
2. Logo abaixo do banner, em letras grandes e coloridas, o NOME DO PRODUTO — é sempre o texto mais chamativo depois do banner (ex: "GUARDA-ROUPAS PARANÁ", "PANELA DE PRESSÃO ELÉTRICA MIDEA PPG70S"). Esse nome pode ter marca de fabricante (Midea, Philco, Samsung, etc.) ou pode ser só o nome do modelo próprio da loja, sem marca nenhuma (ex: "Guarda-Roupas Paraná") — os dois casos são válidos, não exija marca de terceiro pra aceitar o nome.
3. Uma lista de características técnicas em bullets (ex: "6 PORTAS", "4 GAVETAS", "COM ESPELHO", "LARGURA: 2,62M").
4. Um balão ou destaque colorido com o preço à vista, o parcelamento (ex: "12X R$ 231,40") e o total.
5. Um texto bem miúdo no rodapé, na vertical ou lateral, com termos legais (juros, validade da promoção, etc.) — ignore esse texto miúdo, ele nunca é o nome do produto.

Sua tarefa: leia essa imagem com atenção e responda em JSON com dois campos:

- produto: o nome do produto exatamente como está escrito na imagem (item 2 acima), incluindo marca se aparecer. NUNCA deixe esse campo vazio se houver qualquer texto de nome de produto legível na imagem — mesmo sem marca de fabricante, use o nome como está escrito.
- observacoes: um resumo curto (1 a 3 frases, pronto pra mandar num WhatsApp) juntando o preço à vista, o parcelamento e as principais características técnicas da lista de bullets.

Só deixe os dois campos como string vazia se a imagem realmente não for uma arte de oferta de produto (por exemplo, se for uma foto qualquer sem nenhum texto promocional).`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Não autorizado', { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'IA não configurada' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null);
  const imagemBase64 = body?.imagemBase64;
  const mimeType = body?.mimeType;
  if (!imagemBase64 || !mimeType) return new Response('Imagem ausente', { status: 400 });

  try {
    const model = 'gemini-flash-latest';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType, data: imagemBase64 } },
            ],
          }],
          generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { produto: { type: 'string' }, observacoes: { type: 'string' } },
              required: ['produto', 'observacoes'],
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const corpoErro = await res.text().catch(() => '');
      console.error('Análise de oferta: erro da API do Gemini', res.status, corpoErro);
      return new Response(
        JSON.stringify({
          error: 'Não consegui analisar a imagem agora.',
          debug: { geminiStatus: res.status, geminiBody: corpoErro.slice(0, 800) },
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const data = await res.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const finishReason = data?.candidates?.[0]?.finishReason ?? null;
    const blockReason = data?.promptFeedback?.blockReason ?? null;
    let produto = '';
    let observacoes = '';
    let parseFalhou = false;
    try {
      const parsed = JSON.parse(texto || '{}');
      produto = (parsed?.produto ?? '').trim();
      observacoes = (parsed?.observacoes ?? '').trim();
    } catch {
      parseFalhou = true;
    }
    if (!produto && !observacoes) {
      console.error('Análise de oferta: veio vazio', { finishReason, blockReason, parseFalhou, texto: texto.slice(0, 500) });
    }
    return new Response(
      JSON.stringify({
        produto,
        observacoes,
        ...((!produto && !observacoes) ? { debug: { finishReason, blockReason, parseFalhou, textoBruto: texto.slice(0, 500) } } : {}),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui analisar a imagem agora.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
