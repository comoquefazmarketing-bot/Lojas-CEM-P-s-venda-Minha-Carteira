/** "Hoje" no fuso do Brasil (America/Sao_Paulo), no formato YYYY-MM-DD.
 *
 * Rotas de servidor rodam na infraestrutura da Vercel, que por padrão usa UTC como fuso
 * do processo — `new Date().getDate()` ali reflete o dia em UTC, não o dia no Brasil.
 * Isso importa porque em UTC já é "amanhã" boa parte da noite no horário de Brasília
 * (fuso -3): usar UTC direto faria comparações de "vencido hoje" ou "meta batida hoje"
 * baterem um dia adiantado à noite. `Intl.DateTimeFormat` com timeZone explícito resolve
 * isso sem depender do fuso do processo. */
export function hojeIsoBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
