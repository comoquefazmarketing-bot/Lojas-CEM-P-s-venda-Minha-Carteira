import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function exigirGerente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: new Response('Não autorizado', { status: 401 }) };

  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'gerente') return { erro: new Response('Só gerentes têm acesso a essa área', { status: 403 }) };

  return { user };
}

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const { erro } = await exigirGerente();
  if (erro) return erro;

  const supabaseAdmin = adminClient();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, email, role, ativo, criado_em')
    .order('criado_em', { ascending: true });
  if (error) return new Response('Erro ao buscar usuários', { status: 500 });

  return new Response(JSON.stringify({ usuarios: data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function PATCH(request: Request) {
  const { erro, user } = await exigirGerente();
  if (erro) return erro;

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.user_id === 'string' ? body.user_id : null;
  if (!targetUserId) return new Response('user_id é obrigatório', { status: 400 });

  if (targetUserId === user!.id) {
    return new Response(JSON.stringify({ error: 'Você não pode alterar sua própria conta por aqui.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  const update: { ativo?: boolean; role?: string } = {};
  if (typeof body?.ativo === 'boolean') update.ativo = body.ativo;
  if (body?.role === 'vendedor' || body?.role === 'gerente') update.role = body.role;
  if (Object.keys(update).length === 0) return new Response('Nada pra atualizar', { status: 400 });

  const supabaseAdmin = adminClient();
  const { error } = await supabaseAdmin.from('profiles').update(update).eq('user_id', targetUserId);
  if (error) return new Response('Erro ao atualizar usuário', { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
