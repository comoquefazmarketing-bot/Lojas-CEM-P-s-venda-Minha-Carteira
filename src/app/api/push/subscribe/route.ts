import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Não autorizado', { status: 401 });

  const sub = await request.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return new Response('Inscrição inválida', { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return new Response('Erro ao salvar inscrição', { status: 500 });
  return new Response('ok', { status: 200 });
}
