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

  const { data: contatosData, error: contatosError } = await supabase
    .from('clientes')
    .select('*')
    .not('proximo_contato', 'is', null)
    .lte('proximo_contato', hoje);
  if (contatosError) return new Response('Erro ao buscar clientes', { status: 500 });

  const { data: incompletosData, error: incompletosError } = await supabase
    .from('clientes')
    .select('*')
    .is('telefone', null);
  if (incompletosError) return new Response('Erro ao buscar clientes', { status: 500 });

  const contatos = (contatosData ?? []) as Cliente[];
  const incompletos = (incompletosData ?? []) as Cliente[];
  if (contatos.length === 0 && incompletos.length === 0) {
    return new Response('Nada pendente hoje', { status: 200 });
  }

  function agruparPorUsuario(lista: Cliente[]) {
    const mapa = new Map<string, Cliente[]>();
    lista.forEach((c) => {
      if (!c.user_id) return;
      if (!mapa.has(c.user_id)) mapa.set(c.user_id, []);
      mapa.get(c.user_id)!.push(c);
    });
    return mapa;
  }

  const contatosPorUsuario = agruparPorUsuario(contatos);
  const incompletosPorUsuario = agruparPorUsuario(incompletos);
  const usuarios = new Set([...contatosPorUsuario.keys(), ...incompletosPorUsuario.keys()]);

  let enviados = 0;
  for (const userId of usuarios) {
    const listaContatos = contatosPorUsuario.get(userId) ?? [];
    const listaIncompletos = incompletosPorUsuario.get(userId) ?? [];
    if (listaContatos.length === 0 && listaIncompletos.length === 0) continue;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    if (!subs || subs.length === 0) continue;

    const partes: string[] = [];
    if (listaContatos.length > 0) {
      const nomes = listaContatos.slice(0, 3).map((c) => c.nome).join(', ');
      const resto = listaContatos.length > 3 ? ` e mais ${listaContatos.length - 3}` : '';
      partes.push(`${listaContatos.length} pra ligar hoje: ${nomes}${resto}`);
    }
    if (listaIncompletos.length > 0) {
      partes.push(`${listaIncompletos.length} cadastro${listaIncompletos.length > 1 ? 's' : ''} sem telefone`);
    }

    const title = listaContatos.length > 0
      ? `${listaContatos.length} cliente${listaContatos.length > 1 ? 's' : ''} pra ligar hoje`
      : `${listaIncompletos.length} cadastro${listaIncompletos.length > 1 ? 's' : ''} incompleto${listaIncompletos.length > 1 ? 's' : ''}`;

    const payload = JSON.stringify({ title, body: partes.join(' · '), url: '/carteira' });

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
