import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROMPT = `Essa imagem é uma arte promocional de oferta de uma loja de móveis e eletrodomésticos (Lojas CEM). Leia com atenção todo o texto visível na imagem e extraia:

- produto: o nome completo do produto, incluindo tipo, marca e modelo, exatamente como aparece na imagem (ex: "Panela de Pressão Elétrica Midea PPG70S", "Ar-Condicionado Philco PAC12 Inverter Frio 220V"). Nunca responda só com uma palavra genérica isolada (nunca só "Panela" ou só "TV") — sempre inclua marca e modelo se estiverem visíveis na imagem.
- observacoes: um resumo curto (1 a 3 frases, pronto pra mandar num WhatsApp) com o preço à vista, o parcelamento (valor e quantidade de parcelas) se aparecerem na imagem, e as principais características técnicas listadas.

Se não conseguir identificar nada de útil, responda com os dois campos como string vazia.`;

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
            maxOutputTokens: 400,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { produto: { type: 'STRING' }, observacoes: { type: 'STRING' } },
              required: ['produto', 'observacoes'],
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const corpoErro = await res.text().catch(() => '');
      console.error('Análise de oferta: erro da API do Gemini', res.status, corpoErro);
      return new Response(JSON.stringify({ error: 'Não consegui analisar a imagem agora.' }), {
        status: 502, headers: { 'content-type': 'application/json' },
      });
    }

    const data = await res.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let produto = '';
    let observacoes = '';
    try {
      const parsed = JSON.parse(texto);
      produto = (parsed?.produto ?? '').trim();
      observacoes = (parsed?.observacoes ?? '').trim();
    } catch {
      // resposta fora do formato esperado — segue com campos vazios, sem quebrar o cadastro
    }
    return new Response(JSON.stringify({ produto, observacoes }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui analisar a imagem agora.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
