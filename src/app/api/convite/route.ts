import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';
  const codigo = typeof body?.codigo === 'string' ? body.codigo : '';

  if (!email || !senha || !codigo) {
    return new Response(JSON.stringify({ error: 'Preenche todos os campos.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  if (senha.length < 6) {
    return new Response(JSON.stringify({ error: 'A senha precisa ter pelo menos 6 caracteres.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  if (!process.env.SIGNUP_INVITE_CODE || codigo !== process.env.SIGNUP_INVITE_CODE) {
    return new Response(JSON.stringify({ error: 'Código de convite inválido.' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message.toLowerCase().includes('already')
      ? 'Esse email já tem uma conta — tenta entrar direto pelo login.'
      : 'Não consegui criar a conta agora. Tenta de novo.';
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
