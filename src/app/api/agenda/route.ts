import { createClient } from '@supabase/supabase-js';
import { STATUS, type Cliente } from '@/types';

export const dynamic = 'force-dynamic';

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDateForIcs(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function buildDescription(cliente: Cliente): string {
  const parts: string[] = [];
  parts.push(`Motivo: pós-venda / follow-up (status: ${STATUS[cliente.status]?.label ?? cliente.status})`);
  if (cliente.produto) parts.push(`Produto: ${cliente.produto}`);
  if (cliente.telefone) parts.push(`Telefone: ${cliente.telefone}`);
  if (cliente.observacoes) parts.push(`Obs: ${cliente.observacoes}`);
  return parts.join('\n');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!process.env.CALENDAR_FEED_TOKEN || token !== process.env.CALENDAR_FEED_TOKEN) {
    return new Response('Não autorizado', { status: 401 });
  }

  // Enquanto o app for de usuário único, o feed só pode expor a carteira do dono
  // (sem isso, este endpoint com service_role vazaria clientes de qualquer usuário
  // futuro para quem tiver o token). Trocar por um token por usuário quando virar multiusuário.
  if (!process.env.AGENDA_USER_ID) {
    return new Response('Agenda não configurada', { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', process.env.AGENDA_USER_ID)
    .not('proximo_contato', 'is', null);

  if (error) {
    return new Response('Erro ao buscar clientes', { status: 500 });
  }

  const clientes = (data ?? []) as Cliente[];

  const events = clientes
    .filter((c) => !!c.proximo_contato)
    .map((c) => {
      const dateStamp = formatDateForIcs(c.proximo_contato as string);
      return [
        'BEGIN:VEVENT',
        `UID:posvenda-${c.id}@carteira-cem`,
        `DTSTAMP:${dateStamp}T080000Z`,
        `DTSTART;TZID=America/Sao_Paulo:${dateStamp}T080000`,
        `DTEND;TZID=America/Sao_Paulo:${dateStamp}T083000`,
        `SUMMARY:${escapeIcsText(`Ligar: ${c.nome}`)}`,
        `DESCRIPTION:${escapeIcsText(buildDescription(c))}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Lembrete de pós-venda',
        'TRIGGER:-PT0M',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carteira CEM//Pos-venda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Pós-venda CEM',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="posvenda-cem.ics"',
      'Cache-Control': 'no-cache',
    },
  });
}
