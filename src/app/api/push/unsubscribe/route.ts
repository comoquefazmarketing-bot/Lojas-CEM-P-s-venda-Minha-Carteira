import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Não autorizado', { status: 401 });

  const { endpoint } = await request.json();
  if (!endpoint) return new Response('Endpoint ausente', { status: 400 });

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return new Response('Erro ao remover inscrição', { status: 500 });
  return new Response('ok', { status: 200 });
}
