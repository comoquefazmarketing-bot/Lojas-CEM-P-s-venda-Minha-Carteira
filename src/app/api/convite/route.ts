import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { dentroDoLimite, ipDoRequest } from '@/lib/rateLimit';
import { validarSenha } from '@/lib/senha';

export const dynamic = 'force-dynamic';

function codigoConfere(digitado: string, real: string): boolean {
  const a = Buffer.from(digitado);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const ip = ipDoRequest(request);
  // no máximo 8 tentativas a cada 15 minutos por IP — trava tentativa de força bruta
  // no código de convite sem precisar de infraestrutura extra
  const podeTentar = await dentroDoLimite(`convite:${ip}`, 8, 15);
  if (!podeTentar) {
    return new Response(JSON.stringify({ error: 'Muitas tentativas. Espera um pouco antes de tentar de novo.' }), {
      status: 429, headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null);
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';
  const codigo = typeof body?.codigo === 'string' ? body.codigo : '';

  if (!nome || !email || !senha || !codigo) {
    return new Response(JSON.stringify({ error: 'Preenche todos os campos.' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  const erroSenha = validarSenha(senha);
  if (erroSenha) {
    return new Response(JSON.stringify({ error: erroSenha }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  if (!process.env.SIGNUP_INVITE_CODE || !codigoConfere(codigo, process.env.SIGNUP_INVITE_CODE)) {
    return new Response(JSON.stringify({ error: 'Código de convite inválido.' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
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

  if (created.user) {
    // não bloqueia o cadastro se isso falhar — só faz a pessoa ficar sem entrada
    // em profiles, o que a trata como vendedor comum (comportamento seguro por padrão)
    await supabaseAdmin.from('profiles').insert({ user_id: created.user.id, email, nome, role: 'vendedor' });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
