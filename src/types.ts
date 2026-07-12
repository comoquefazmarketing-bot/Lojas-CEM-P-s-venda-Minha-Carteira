export type StatusKey = 'ATIVO' | 'ATRASADO' | 'QUITADO' | 'NEGOCIANDO';

export interface Cliente {
  id: string;
  user_id?: string;
  nome: string;
  telefone: string;
  produto: string | null;
  valor_total: number | null;
  valor_parcela: number | null;
  numero_parcelas: number | null;
  data_compra: string | null;
  dia_vencimento: number | null;
  status: StatusKey;
  observacoes: string | null;
  proximo_contato: string | null;
  data_nascimento: string | null;
  indicado_por: string | null;
  ultimo_contato: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Configuracoes {
  user_id: string;
  meta_mensal: number | null;
}

export const STATUS: Record<StatusKey, { label: string; color: string }> = {
  ATIVO: { label: 'Ativo', color: '#3F6B4A' },
  ATRASADO: { label: 'Atrasado', color: '#A63D2C' },
  QUITADO: { label: 'Quitado', color: '#3C5A73' },
  NEGOCIANDO: { label: 'Negociando', color: '#B8862B' },
};

export const STATUS_ORDER: StatusKey[] = ['ATIVO', 'ATRASADO', 'NEGOCIANDO', 'QUITADO'];
