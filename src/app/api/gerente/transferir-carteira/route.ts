import { exigirGerente, adminClient } from '@/lib/gerente';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { erro } = await exigirGerente();
  if (erro) return erro;

  const body = await request.json().catch(() => null);
  const deUserId = typeof body?.de_user_id === 'string' ? body.de_user_id : null;
  const paraUserId = typeof body?.para_user_id === 'string' ? body.para_user_id : null;
  if (!deUserId || !paraUserId) {
    return new Response(JSON.stringify({ error: 'Escolhe o vendedor de origem e o de destino.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  if (deUserId === paraUserId) {
    return new Response(JSON.stringify({ error: 'Escolhe um vendedor de destino diferente do de origem.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseAdmin = adminClient();

  const { data: clientesDoVendedor, error: erroSelect } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .eq('user_id', deUserId);
  if (erroSelect) {
    return new Response(JSON.stringify({ error: 'Erro ao buscar a carteira de origem.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
  const clienteIds = (clientesDoVendedor ?? []).map(c => c.id);

  const { error, count } = await supabaseAdmin
    .from('clientes')
    .update({ user_id: paraUserId }, { count: 'exact' })
    .eq('user_id', deUserId);
  if (error) {
    return new Response(JSON.stringify({ error: 'Erro ao transferir a carteira.' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }

  // sem isso, o histórico de anotações continua marcado como do vendedor antigo e some
  // pro vendedor novo (RLS de interacoes é por dono da anotação, não pelo cliente)
  if (clienteIds.length > 0) {
    await supabaseAdmin.from('interacoes').update({ user_id: paraUserId }).in('cliente_id', clienteIds);
  }

  return new Response(JSON.stringify({ ok: true, transferidos: count ?? 0 }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}
