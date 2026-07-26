import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROMPT = 'Essa imagem é uma arte promocional de uma loja de móveis e eletrodomésticos (Lojas CEM). Responda APENAS com o nome do produto principal anunciado, de forma curta (ex: "Geladeira Brastemp 400L", "Ar-condicionado Philco 12000 BTU", "Sofá 3 lugares"). Se não conseguir identificar um produto, responda exatamente "Produto não identificado". Não escreva mais nada além do nome do produto.';

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
          generationConfig: { maxOutputTokens: 64 },
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
    const produto = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    return new Response(JSON.stringify({ produto }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Não consegui analisar a imagem agora.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
