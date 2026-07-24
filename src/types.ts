export type StatusKey = 'ATIVO' | 'ATRASADO' | 'QUITADO' | 'NEGOCIANDO' | 'PROSPECT';
export type FormaPagamento = 'PARCELADO' | 'A_VISTA';

export interface Cliente {
  id: string;
  user_id?: string;
  nome: string;
  telefone: string;
  produto: string | null;
  forma_pagamento: FormaPagamento;
  valor_total: number | null;
  valor_sinal: number | null;
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
  data_conversao: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Configuracoes {
  user_id: string;
  meta_mensal: number | null;
  meta_moveis: number | null;
  meta_tv: number | null;
  meta_outros: number | null;
}

export interface Interacao {
  id: string;
  cliente_id: string;
  user_id?: string;
  data: string;
  nota: string;
  criado_em?: string;
}

export const STATUS: Record<StatusKey, { label: string; color: string }> = {
  PROSPECT: { label: 'Prospect', color: '#3C5A73' },
  ATIVO: { label: 'Ativo', color: '#3F6B4A' },
  ATRASADO: { label: 'Atrasado', color: '#C23B1E' },
  QUITADO: { label: 'Quitado', color: '#0F3D8C' },
  NEGOCIANDO: { label: 'Negociando', color: '#F2600C' },
};

export const STATUS_ORDER: StatusKey[] = ['PROSPECT', 'ATIVO', 'ATRASADO', 'NEGOCIANDO', 'QUITADO'];

export const FORMA_PAGAMENTO: Record<FormaPagamento, { label: string }> = {
  PARCELADO: { label: 'Parcelado' },
  A_VISTA: { label: 'À vista' },
};
