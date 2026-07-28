import { adminClient } from '@/lib/supabase/admin';

/** Limita quantas vezes uma "chave" (ex: "convite:1.2.3.4" ou "jarbas:<user_id>") pode
 * passar por aqui numa janela de tempo. Retorna true se ainda está dentro do limite
 * (e já registra essa tentativa); false se estourou — quem chamou deve recusar o pedido. */
export async function dentroDoLimite(chave: string, maxTentativas: number, janelaMinutos: number): Promise<boolean> {
  const admin = adminClient();
  const desde = new Date(Date.now() - janelaMinutos * 60 * 1000).toISOString();

  const { count } = await admin
    .from('rate_limit_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('chave', chave)
    .gte('criado_em', desde);

  if ((count ?? 0) >= maxTentativas) return false;

  await admin.from('rate_limit_tentativas').insert({ chave });

  // limpeza esporádica de tentativas antigas (~5% das chamadas) — funções serverless
  // podem cortar trabalho não aguardado assim que a resposta sai, por isso é awaited
  // aqui, só que não em toda chamada, pra não pesar a latência do caminho comum
  if (Math.random() < 0.05) {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from('rate_limit_tentativas').delete().lt('criado_em', umDiaAtras);
  }

  return true;
}

/** Pega o IP de quem fez a requisição, olhando os headers que a Vercel usa. */
export function ipDoRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'desconhecido';
}
