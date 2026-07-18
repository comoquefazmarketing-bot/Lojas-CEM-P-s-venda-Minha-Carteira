import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Cliente } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  webpush.setVapidDetails(
    'mailto:comoquefazmarketing@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: clientesData, error: clientesError } = await supabase
    .from('clientes')
    .select('*')
    .not('proximo_contato', 'is', null)
    .lte('proximo_contato', hoje);

  if (clientesError) return new Response('Erro ao buscar clientes', { status: 500 });

  const clientes = (clientesData ?? []) as Cliente[];
  if (clientes.length === 0) return new Response('Nenhum contato pendente hoje', { status: 200 });

  const porUsuario = new Map<string, Cliente[]>();
  clientes.forEach((c) => {
    if (!c.user_id) return;
    if (!porUsuario.has(c.user_id)) porUsuario.set(c.user_id, []);
    porUsuario.get(c.user_id)!.push(c);
  });

  let enviados = 0;
  for (const [userId, lista] of porUsuario) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    if (!subs || subs.length === 0) continue;

    const nomes = lista.slice(0, 3).map((c) => c.nome).join(', ');
    const resto = lista.length > 3 ? ` e mais ${lista.length - 3}` : '';
    const payload = JSON.stringify({
      title: `${lista.length} cliente${lista.length > 1 ? 's' : ''} pra ligar hoje`,
      body: `${nomes}${resto} — pós-venda pendente.`,
      url: '/carteira',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        enviados++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }

  return new Response(`Notificações enviadas: ${enviados}`, { status: 200 });
}
