import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function exigirGerente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: new Response('Não autorizado', { status: 401 }) };

  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'gerente') return { erro: new Response('Só gerentes têm acesso a essa área', { status: 403 }) };

  return { user };
}

export function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
