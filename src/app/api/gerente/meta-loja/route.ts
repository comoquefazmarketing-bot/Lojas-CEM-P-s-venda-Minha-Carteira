import { exigirGerente, adminClient } from '@/lib/gerente';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Não autorizado', { status: 401 });

  const { data } = await supabase
    .from('meta_loja')
    .select('valor')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(JSON.stringify({ valor: data?.valor ?? null }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}

export async function PATCH(request: Request) {
  const { erro } = await exigirGerente();
  if (erro) return erro;

  const body = await request.json().catch(() => null);
  const valor = typeof body?.valor === 'number' ? body.valor : null;
  if (valor === null || valor <= 0) {
    return new Response(JSON.stringify({ error: 'Valor inválido' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseAdmin = adminClient();
  const { error } = await supabaseAdmin.from('meta_loja').insert({ valor });
  if (error) {
    return new Response(JSON.stringify({ error: 'Erro ao salvar a meta da loja' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
