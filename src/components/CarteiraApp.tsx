'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Phone, MessageCircle, X, Pencil, Trash2,
  Clock, Users, AlertTriangle, Download, LogOut, Flame,
  Snowflake, Star, Target, Check, Gift, Repeat, Handshake,
  ChevronDown, Zap, CalendarDays, Wallet, Trophy, TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Cliente, StatusKey, STATUS, STATUS_ORDER } from '@/types';

/* ---------------------------------- utils ---------------------------------- */

function formatBRL(v: number | null | undefined) {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDateBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1 + Number(months), d);
}
function daysBetween(a: Date, b: Date) {
  const x = new Date(a); x.setHours(0, 0, 0, 0);
  const y = new Date(b); y.setHours(0, 0, 0, 0);
  return Math.round((y.getTime() - x.getTime()) / 86400000);
}
function daysUntil(date: Date) { return daysBetween(new Date(), date); }
function daysSince(iso: string) { return daysBetween(new Date(iso), new Date()); }
function monthsElapsed(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
}
function onlyDigits(s: string | null | undefined) { return (s || '').replace(/\D/g, ''); }
function firstName(nome: string) { return (nome || '').trim().split(' ')[0] || ''; }
function todayIso() { return new Date().toISOString().slice(0, 10); }

/** dias até o próximo aniversário (0 = hoje), null se sem data */
function daysUntilBirthday(iso: string | null): number | null {
  if (!iso) return null;
  const [, m, d] = iso.split('-').map(Number);
  const now = new Date();
  let next = new Date(now.getFullYear(), m - 1, d);
  if (daysBetween(now, next) < 0) next = new Date(now.getFullYear() + 1, m - 1, d);
  return daysUntil(next);
}

/* ------------------------------- WhatsApp scripts ------------------------------- */

type ScriptKey = 'posvenda' | 'carne' | 'reativacao' | 'aniversario' | 'indicacao';

const SCRIPTS: Record<ScriptKey, { label: string; icon: typeof MessageCircle; build: (nome: string, produto: string | null) => string }> = {
  posvenda: {
    label: 'Pós-venda (satisfação)',
    icon: MessageCircle,
    build: (nome, produto) => `Oi ${firstName(nome)}! Aqui é da Lojas CEM. Passando pra saber se está tudo certo com ${produto || 'sua compra'} — qualquer coisa, pode me chamar! 😊`,
  },
  carne: {
    label: 'Carnê acabando (recompra)',
    icon: Repeat,
    build: (nome) => `Oi ${firstName(nome)}! Vi aqui que seu carnê tá quase no fim 🎉 Isso significa que seu crédito na loja já libera de novo. Quer que eu separe umas novidades pra você dar uma olhada?`,
  },
  reativacao: {
    label: 'Reativação (sumiu)',
    icon: Zap,
    build: (nome) => `Oi ${firstName(nome)}, tudo bem? Faz um tempo que a gente não troca uma ideia! Tô com umas condições boas na loja essa semana, passa aqui ou me chama que te conto 😉`,
  },
  aniversario: {
    label: 'Aniversário',
    icon: Gift,
    build: (nome) => `Parabéns, ${firstName(nome)}! 🎉🎂 Toda a equipe das Lojas CEM te deseja um ano incrível. E já separei uma condição especial de aniversário pra você, se quiser dar uma olhada!`,
  },
  indicacao: {
    label: 'Pedido de indicação',
    icon: Handshake,
    build: (nome) => `Oi ${firstName(nome)}! Fico muito feliz que você é cliente da gente 🙏 Se você conhecer alguém que tá precisando de algo pra casa, me indica? Cuido super bem de quem você mandar!`,
  },
};

function waLinkWithText(telefone: string, text: string) {
  const digits = onlyDigits(telefone);
  const phone = digits.length > 0 && digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/* ------------------------------- tipos derivados ------------------------------- */

type EnrichedCliente = Cliente & {
  terminoDate: Date | null;
  diasParaTermino: number | null;
  diasParaAniversario: number | null;
  diasDesdeContato: number | null;
  temperatura: 'quente' | 'morno' | 'frio';
  isVip: boolean;
  indicacoesFeitas: number;
};

type AcaoDoDia = {
  cliente: EnrichedCliente;
  motivo: string;
  icon: typeof AlertTriangle;
  cor: string;
  prioridade: number;
};

const emptyForm: Cliente = {
  id: '', nome: '', telefone: '', produto: '',
  valor_total: null, valor_parcela: null, numero_parcelas: null,
  data_compra: new Date().toISOString().slice(0, 10),
  dia_vencimento: null, status: 'ATIVO', observacoes: '', proximo_contato: null,
  data_nascimento: null, indicado_por: null, ultimo_contato: null,
};

/* ---------------------------------- UI bits ---------------------------------- */

function StampBadge({ statusKey }: { statusKey: StatusKey }) {
  const s = STATUS[statusKey] || STATUS.ATIVO;
  return <div className="stamp" style={{ color: s.color, borderColor: s.color }}>{s.label}</div>;
}

function Termometro({ t }: { t: 'quente' | 'morno' | 'frio' }) {
  if (t === 'quente') return <span className="termo termo-quente" title="Contato recente"><Flame size={12} /> Quente</span>;
  if (t === 'morno') return <span className="termo termo-morno" title="Sem contato há um tempo">🙂 Morno</span>;
  return <span className="termo termo-frio" title="Esfriando — reative o contato"><Snowflake size={12} /> Frio</span>;
}

function WaMenu({ c, onClose }: { c: Cliente; onClose: () => void }) {
  return (
    <div className="wa-menu" onClick={(e) => e.stopPropagation()}>
      <div className="wa-menu-title">Escolha o script</div>
      {(Object.keys(SCRIPTS) as ScriptKey[]).map((key) => {
        const s = SCRIPTS[key];
        const Icon = s.icon;
        return (
          <a
            key={key}
            className="wa-menu-item"
            href={waLinkWithText(c.telefone, s.build(c.nome, c.produto))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            <Icon size={14} /> {s.label}
          </a>
        );
      })}
    </div>
  );
}

function ClienteCard({
  c, onEdit, onDelete, onMarcarContato, indicadorNome,
}: {
  c: EnrichedCliente;
  onEdit: (c: Cliente) => void;
  onDelete: (id: string) => void;
  onMarcarContato: (id: string) => void;
  indicadorNome: string | null;
}) {
  const s = STATUS[c.status] || STATUS.ATIVO;
  const hasTermino = !!(c.data_compra && c.numero_parcelas);
  const parcelasEstimadas = hasTermino
    ? Math.min(Number(c.numero_parcelas), monthsElapsed(c.data_compra as string) + 1)
    : null;
  const progresso = hasTermino ? Math.min(100, Math.round(((parcelasEstimadas as number) / Number(c.numero_parcelas)) * 100)) : 0;
  const terminandoEmBreve = c.status !== 'QUITADO' && c.diasParaTermino !== null && c.diasParaTermino <= 30;
  const contatoPendente = c.proximo_contato ? daysUntil(new Date(c.proximo_contato)) <= 0 : false;
  const [waOpen, setWaOpen] = useState(false);

  return (
    <div className="card" style={{ borderLeftColor: s.color }}>
      <div className="card-top">
        <div>
          <div className="card-nome">
            {c.nome}
            {c.isVip && <Star size={13} className="vip-star" fill="#B8862B" />}
          </div>
          <div className="card-produto">{c.produto || 'Produto não informado'}</div>
          <div className="card-meta-row">
            <Termometro t={c.temperatura} />
            {indicadorNome && <span className="ref-tag">indicado por {indicadorNome}</span>}
            {c.indicacoesFeitas > 0 && <span className="ref-tag ref-tag-gold"><Handshake size={11} /> {c.indicacoesFeitas} indicação{c.indicacoesFeitas > 1 ? 'ões' : ''}</span>}
          </div>
        </div>
        <StampBadge statusKey={c.status} />
      </div>

      <div className="card-grid">
        <div className="card-field">
          <span className="mono-label">Parcela</span>
          <span className="mono-val">{formatBRL(c.valor_parcela)}{c.numero_parcelas ? ` · ${c.numero_parcelas}x` : ''}</span>
        </div>
        <div className="card-field">
          <span className="mono-label">Compra</span>
          <span className="mono-val">{formatDateBR(c.data_compra)}</span>
        </div>
        <div className="card-field">
          <span className="mono-label">Término previsto</span>
          <span className="mono-val" style={terminandoEmBreve ? { color: '#B8862B', fontWeight: 700 } : {}}>
            {hasTermino && c.terminoDate ? c.terminoDate.toLocaleDateString('pt-BR') : '—'}
            {terminandoEmBreve && c.diasParaTermino !== null ? (c.diasParaTermino >= 0 ? ` · ${c.diasParaTermino}d` : ' · vencido') : ''}
          </span>
        </div>
        <div className="card-field">
          <span className="mono-label">Total</span>
          <span className="mono-val">{formatBRL(c.valor_total)}</span>
        </div>
      </div>

      {hasTermino && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progresso}%`, background: s.color }} />
          <span className="progress-label">~{parcelasEstimadas}/{c.numero_parcelas} parcelas (estimado)</span>
        </div>
      )}

      {contatoPendente && (
        <div className="alert-row">
          <div className="alert-pill"><Clock size={13} strokeWidth={2.5} /> Contato de pós-venda pendente</div>
          <button className="mini-btn" onClick={() => onMarcarContato(c.id)}><Check size={12} /> Marcar feito</button>
        </div>
      )}

      {c.observacoes && <div className="card-obs">&quot;{c.observacoes}&quot;</div>}

      <div className="card-actions">
        <a className="icon-btn" href={`tel:${onlyDigits(c.telefone)}`} title="Ligar"><Phone size={16} /></a>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn wa" title="WhatsApp" onClick={() => setWaOpen(o => !o)}><MessageCircle size={16} /></button>
          {waOpen && <WaMenu c={c} onClose={() => setWaOpen(false)} />}
        </div>
        <span className="tel-display">{c.telefone || 'sem telefone'}</span>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => onEdit(c)} title="Editar"><Pencil size={16} /></button>
        <button className="icon-btn danger" onClick={() => onDelete(c.id)} title="Excluir"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

/* ---------------------------------- App ---------------------------------- */

export default function CarteiraApp({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'TODOS'>('TODOS');
  const [sortBy, setSortBy] = useState<'termino' | 'nome' | 'recente'>('termino');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Cliente>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [metaMensal, setMetaMensal] = useState<number | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [acaoDoDiaOpen, setAcaoDoDiaOpen] = useState(true);
  const [oportunidadesExcluidas, setOportunidadesExcluidas] = useState<Set<string>>(new Set());

  const loadClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').order('criado_em', { ascending: false });
    if (error) setErrorMsg('Não consegui carregar sua carteira. Recarrega a página.');
    else setClients(data as Cliente[]);
    setLoading(false);
  }, [supabase]);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('meta_mensal').maybeSingle();
    if (data) setMetaMensal(data.meta_mensal);
  }, [supabase]);

  useEffect(() => { loadClients(); loadConfig(); }, [loadClients, loadConfig]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  function openAdd() { setForm({ ...emptyForm, id: '' }); setFormOpen(true); }
  function openEdit(c: Cliente) { setForm(c); setFormOpen(true); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) { showToast('Preenche pelo menos nome e telefone'); return; }
    const num = (v: unknown) => (v === null || v === undefined || v === '') ? null : Number(v);
    const payload = {
      nome: form.nome,
      telefone: form.telefone,
      produto: form.produto || null,
      valor_total: num(form.valor_total),
      valor_parcela: num(form.valor_parcela),
      numero_parcelas: num(form.numero_parcelas),
      data_compra: form.data_compra || null,
      dia_vencimento: num(form.dia_vencimento),
      status: form.status,
      observacoes: form.observacoes || null,
      proximo_contato: form.proximo_contato || null,
      data_nascimento: form.data_nascimento || null,
      indicado_por: form.indicado_por || null,
    };

    if (form.id) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', form.id);
      if (error) { showToast('Erro ao salvar. Tenta de novo.'); return; }
      showToast('Cliente atualizado');
    } else {
      const { error } = await supabase.from('clientes').insert({ ...payload, ultimo_contato: todayIso() });
      if (error) { showToast('Erro ao salvar. Tenta de novo.'); return; }
      showToast('Cliente adicionado à carteira');
    }
    setFormOpen(false);
    loadClients();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    setConfirmDelete(null);
    if (error) { showToast('Erro ao excluir'); return; }
    showToast('Cliente removido');
    loadClients();
  }

  async function handleMarcarContato(id: string) {
    const { error } = await supabase.from('clientes').update({ ultimo_contato: todayIso(), proximo_contato: null }).eq('id', id);
    if (error) { showToast('Erro ao atualizar'); return; }
    showToast('Contato registrado 👍');
    loadClients();
  }

  async function handleSaveMeta() {
    const val = parseFloat(metaInput.replace(',', '.'));
    if (isNaN(val)) { setEditingMeta(false); return; }
    setMetaMensal(val);
    setEditingMeta(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Não consegui salvar a meta'); return; }
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ user_id: user.id, meta_mensal: val }, { onConflict: 'user_id' });
    if (error) showToast('Não consegui salvar a meta');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function exportCsv() {
    const headers = ['Nome','Telefone','Produto','Valor Total','Valor Parcela','Numero Parcelas','Data Compra','Termino Previsto','Status','Proximo Contato','Ultimo Contato','Observacoes'];
    const rows = enriched.map(c => [
      c.nome, c.telefone, c.produto || '', c.valor_total ?? '', c.valor_parcela ?? '', c.numero_parcelas ?? '',
      formatDateBR(c.data_compra), c.terminoDate ? c.terminoDate.toLocaleDateString('pt-BR') : '',
      STATUS[c.status]?.label || c.status, formatDateBR(c.proximo_contato), formatDateBR(c.ultimo_contato),
      (c.observacoes || '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `carteira-clientes-${todayIso()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const enriched: EnrichedCliente[] = useMemo(() => {
    const valores = clients.map(c => c.valor_total).filter((v): v is number => typeof v === 'number' && v > 0).sort((a, b) => b - a);
    const vipThreshold = valores.length >= 5 ? valores[Math.max(0, Math.floor(valores.length * 0.2) - 1)] : Infinity;

    return clients.map(c => {
      let terminoDate: Date | null = null, diasParaTermino: number | null = null;
      if (c.data_compra && c.numero_parcelas) {
        terminoDate = addMonths(c.data_compra, c.numero_parcelas);
        diasParaTermino = daysUntil(terminoDate);
      }
      const diasParaAniversario = daysUntilBirthday(c.data_nascimento);
      const baseContato = c.ultimo_contato || c.data_compra || c.criado_em?.slice(0, 10) || null;
      const diasDesdeContato = baseContato ? daysSince(baseContato) : null;
      let temperatura: 'quente' | 'morno' | 'frio' = 'morno';
      if (diasDesdeContato !== null) {
        if (diasDesdeContato <= 15) temperatura = 'quente';
        else if (diasDesdeContato <= 45) temperatura = 'morno';
        else temperatura = 'frio';
      }
      const isVip = typeof c.valor_total === 'number' && c.valor_total >= vipThreshold && valores.length >= 5;
      const indicacoesFeitas = clients.filter(o => o.indicado_por === c.id).length;
      return { ...c, terminoDate, diasParaTermino, diasParaAniversario, diasDesdeContato, temperatura, isVip, indicacoesFeitas };
    });
  }, [clients]);

  const clienteById = useMemo(() => {
    const map = new Map<string, EnrichedCliente>();
    enriched.forEach(c => map.set(c.id, c));
    return map;
  }, [enriched]);

  const acaoDoDia: AcaoDoDia[] = useMemo(() => {
    const list: AcaoDoDia[] = [];
    enriched.forEach(c => {
      const candidatos: AcaoDoDia[] = [];
      if (c.status === 'ATRASADO') {
        candidatos.push({ cliente: c, motivo: 'Em atraso — ligar hoje', icon: AlertTriangle, cor: 'var(--rust)', prioridade: 100 });
      }
      if (c.proximo_contato && daysUntil(new Date(c.proximo_contato)) <= 0) {
        candidatos.push({ cliente: c, motivo: 'Contato de pós-venda vencido', icon: Clock, cor: 'var(--slate)', prioridade: 90 });
      }
      if (c.status !== 'QUITADO' && c.diasParaTermino !== null && c.diasParaTermino <= 15) {
        candidatos.push({ cliente: c, motivo: `Carnê termina em ${c.diasParaTermino}d — oferecer recompra`, icon: Repeat, cor: 'var(--gold)', prioridade: 85 });
      } else if (c.status !== 'QUITADO' && c.diasParaTermino !== null && c.diasParaTermino <= 30) {
        candidatos.push({ cliente: c, motivo: `Carnê termina em ${c.diasParaTermino}d — preparar oferta`, icon: Repeat, cor: 'var(--gold)', prioridade: 70 });
      }
      if (c.diasParaAniversario !== null && c.diasParaAniversario <= 3) {
        candidatos.push({ cliente: c, motivo: c.diasParaAniversario === 0 ? 'Aniversário é hoje!' : `Aniversário em ${c.diasParaAniversario}d`, icon: Gift, cor: 'var(--green)', prioridade: 65 });
      }
      if (c.data_compra) {
        const dias = daysSince(c.data_compra);
        if (dias >= 350 && dias <= 380) {
          candidatos.push({ cliente: c, motivo: '1 ano de compra — hora do upgrade', icon: Star, cor: 'var(--gold)', prioridade: 60 });
        }
      }
      if (c.temperatura === 'frio' && c.status === 'ATIVO') {
        candidatos.push({ cliente: c, motivo: `Esfriando — sem contato há ${c.diasDesdeContato}d`, icon: Snowflake, cor: 'var(--slate)', prioridade: 50 });
      }
      if (candidatos.length) {
        candidatos.sort((a, b) => b.prioridade - a.prioridade);
        list.push(candidatos[0]);
      }
    });
    return list.sort((a, b) => b.prioridade - a.prioridade);
  }, [enriched]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const atrasados = enriched.filter(c => c.status === 'ATRASADO').length;
    const vips = enriched.filter(c => c.isVip).length;
    return { total, atrasados, vips, acaoHoje: acaoDoDia.length };
  }, [enriched, acaoDoDia]);

  const vendasMes = useMemo(() => {
    const now = new Date();
    return enriched.reduce((sum, c) => {
      if (!c.data_compra || !c.valor_total) return sum;
      const d = new Date(c.data_compra);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return sum + c.valor_total;
      return sum;
    }, 0);
  }, [enriched]);

  const metaCalc = useMemo(() => {
    const now = new Date();
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const diasRestantes = Math.max(1, diasNoMes - now.getDate() + 1);
    const valorRestante = metaMensal ? Math.max(0, metaMensal - vendasMes) : null;
    const metaDiaria = valorRestante !== null ? valorRestante / diasRestantes : null;
    const pct = metaMensal && metaMensal > 0 ? Math.min(100, (vendasMes / metaMensal) * 100) : 0;
    return { diasRestantes, valorRestante, metaDiaria, pct };
  }, [metaMensal, vendasMes]);

  const avgTicket = useMemo(() => {
    const valores = clients.map(c => c.valor_total).filter((v): v is number => typeof v === 'number' && v > 0);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }, [clients]);

  const oportunidadesMeta = useMemo(() => {
    type Oportunidade = { cliente: EnrichedCliente; motivo: string; urgencia: number };
    const list: Oportunidade[] = [];
    enriched.forEach(c => {
      if (c.status !== 'QUITADO' && c.diasParaTermino !== null && c.diasParaTermino <= 45) {
        list.push({ cliente: c, motivo: `Carnê libera crédito em ${Math.max(c.diasParaTermino, 0)}d`, urgencia: 100 - c.diasParaTermino });
        return;
      }
      if (c.data_compra) {
        const dias = daysSince(c.data_compra);
        if (dias >= 330 && dias <= 400) {
          list.push({ cliente: c, motivo: 'Aniversário de compra — hora do upgrade', urgencia: 60 });
          return;
        }
      }
      if (c.temperatura === 'quente' && c.isVip) {
        list.push({ cliente: c, motivo: 'Cliente VIP aquecido — bom momento pra oferecer', urgencia: 40 });
      }
    });
    return list.sort((a, b) => b.urgencia - a.urgencia).slice(0, 8);
  }, [enriched]);

  const somaOportunidades = useMemo(() => {
    if (!avgTicket) return 0;
    return oportunidadesMeta.reduce((sum, o) => oportunidadesExcluidas.has(o.cliente.id) ? sum : sum + avgTicket, 0);
  }, [oportunidadesMeta, oportunidadesExcluidas, avgTicket]);

  function toggleOportunidade(id: string) {
    setOportunidadesExcluidas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    let list = enriched;
    if (statusFilter !== 'TODOS') list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.produto || '').toLowerCase().includes(q) ||
        (onlyDigits(q).length > 0 && onlyDigits(c.telefone).includes(onlyDigits(q)))
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'termino') {
        if (a.diasParaTermino === null) return 1;
        if (b.diasParaTermino === null) return -1;
        return a.diasParaTermino - b.diasParaTermino;
      }
      if (sortBy === 'nome') return a.nome.localeCompare(b.nome);
      if (sortBy === 'recente') return new Date(b.data_compra || 0).getTime() - new Date(a.data_compra || 0).getTime();
      return 0;
    });
  }, [enriched, statusFilter, search, sortBy]);

  function field<K extends keyof Cliente>(name: K) {
    return {
      value: (form[name] ?? '') as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [name]: e.target.value }),
    };
  }

  const previewTermino = form.data_compra && form.numero_parcelas
    ? addMonths(form.data_compra, Number(form.numero_parcelas)).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="carteira-app">
      {loading ? (
        <div className="loading-msg">carregando carteira...</div>
      ) : (
        <>
          <div className="top-header">
            <div>
              <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="header-logo" />
              <div className="eyebrow">Lojas CEM · Pós-venda</div>
              <h1 className="title">Minha Carteira</h1>
              <div className="subtitle">{userEmail} · {stats.total} cliente{stats.total !== 1 ? 's' : ''}</div>
            </div>
            <div className="header-actions">
              <button className="backup-btn" onClick={exportCsv}><Download size={13} /> CSV</button>
              <button className="logout-btn" onClick={handleLogout}><LogOut size={13} /> Sair</button>
            </div>
          </div>

          {errorMsg && <div className="error-banner">{errorMsg}</div>}

          <div className={`meta-hero ${metaCalc.pct >= 100 ? 'meta-hero-done' : ''}`}>
            <div className="meta-hero-top">
              <div className="meta-label"><Target size={15} /> Meta do mês</div>
              {editingMeta ? (
                <input
                  autoFocus
                  className="meta-input"
                  value={metaInput}
                  onChange={e => setMetaInput(e.target.value)}
                  onBlur={handleSaveMeta}
                  onKeyDown={e => e.key === 'Enter' && handleSaveMeta()}
                  placeholder="0,00"
                />
              ) : (
                <button className="meta-set-btn" onClick={() => { setMetaInput(String(metaMensal ?? '')); setEditingMeta(true); }}>
                  {metaMensal ? 'Editar' : 'Definir meta'}
                </button>
              )}
            </div>

            {metaMensal ? (
              <>
                <div className="meta-pct-big mono">
                  {metaCalc.pct >= 100 ? '🏆 Meta batida!' : `${metaCalc.pct.toFixed(0)}%`}
                </div>
                <div className="meta-track-big">
                  <div className="meta-fill-big" style={{ width: `${metaCalc.pct}%` }} />
                  <div className="meta-tick" style={{ left: '25%' }} />
                  <div className="meta-tick" style={{ left: '50%' }} />
                  <div className="meta-tick" style={{ left: '75%' }} />
                  <Trophy size={16} className="meta-trophy" />
                </div>
                <div className="meta-numbers mono">{formatBRL(vendasMes)} de {formatBRL(metaMensal)}</div>

                <div className="meta-mini-stats">
                  <div className="meta-mini">
                    <CalendarDays size={14} />
                    <div><div className="meta-mini-num mono">{metaCalc.diasRestantes}</div><div className="meta-mini-label">dias restantes</div></div>
                  </div>
                  <div className="meta-mini">
                    <Wallet size={14} />
                    <div><div className="meta-mini-num mono">{formatBRL(metaCalc.valorRestante)}</div><div className="meta-mini-label">falta pra meta</div></div>
                  </div>
                  <div className="meta-mini">
                    <TrendingUp size={14} />
                    <div><div className="meta-mini-num mono">{metaCalc.valorRestante === 0 ? 'R$ 0' : formatBRL(metaCalc.metaDiaria)}</div><div className="meta-mini-label">vender por dia</div></div>
                  </div>
                </div>

                {oportunidadesMeta.length > 0 && metaCalc.pct < 100 && (
                  <div className="oportunidades-box">
                    <div className="oportunidades-title">
                      Quem pode ajudar a bater a meta {avgTicket && <span className="oportunidades-soma">— selecionados: {formatBRL(somaOportunidades)}</span>}
                    </div>
                    <div className="oportunidades-list">
                      {oportunidadesMeta.map(o => {
                        const excluido = oportunidadesExcluidas.has(o.cliente.id);
                        return (
                          <button
                            key={o.cliente.id}
                            className={`oportunidade-item ${excluido ? 'excluido' : ''}`}
                            onClick={() => toggleOportunidade(o.cliente.id)}
                          >
                            <span className="oportunidade-check">{excluido ? '' : <Check size={12} />}</span>
                            <span className="oportunidade-nome">{o.cliente.nome}</span>
                            <span className="oportunidade-motivo">{o.motivo}</span>
                            {avgTicket && <span className="oportunidade-valor mono">~{formatBRL(avgTicket)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="meta-empty-msg">Define uma meta de vendas do mês pra acompanhar seu progresso aqui.</p>
            )}
          </div>

          <div className="stats-row">
            <div className="stat-card"><div className="stat-num mono">{stats.total}</div><div className="stat-label"><Users size={12} /> Total</div></div>
            <div className="stat-card warn"><div className="stat-num mono">{stats.acaoHoje}</div><div className="stat-label"><Zap size={12} /> Ação hoje</div></div>
            <div className="stat-card danger"><div className="stat-num mono">{stats.atrasados}</div><div className="stat-label"><AlertTriangle size={12} /> Atrasados</div></div>
            <div className="stat-card gold"><div className="stat-num mono">{stats.vips}</div><div className="stat-label"><Star size={12} /> VIPs</div></div>
          </div>

          {acaoDoDia.length > 0 && (
            <div className="acao-dia-section">
              <button className="acao-dia-header" onClick={() => setAcaoDoDiaOpen(o => !o)}>
                <span><Zap size={15} color="var(--gold)" /> Ação do Dia — {acaoDoDia.length} cliente{acaoDoDia.length > 1 ? 's' : ''} precisam de você</span>
                <ChevronDown size={16} style={{ transform: acaoDoDiaOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {acaoDoDiaOpen && (
                <div className="acao-dia-list">
                  {acaoDoDia.map(({ cliente, motivo, icon: Icon, cor }) => (
                    <div key={cliente.id} className="acao-dia-item">
                      <Icon size={15} color={cor} />
                      <div className="acao-dia-texto">
                        <strong>{cliente.nome}</strong> — {motivo}
                      </div>
                      <a className="mini-btn wa-mini" href={waLinkWithText(cliente.telefone, SCRIPTS.posvenda.build(cliente.nome, cliente.produto))} target="_blank" rel="noopener noreferrer">
                        <MessageCircle size={12} /> Chamar
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="toolbar">
            <div className="search-box">
              <Search size={15} color="var(--ink-soft)" />
              <input placeholder="Buscar por nome, telefone ou produto" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
              <option value="termino">Carnê terminando</option>
              <option value="recente">Compra mais recente</option>
              <option value="nome">Nome (A-Z)</option>
            </select>
          </div>

          <div className="chip-row">
            <button className={`chip ${statusFilter === 'TODOS' ? 'active' : ''}`} onClick={() => setStatusFilter('TODOS')}>Todos</button>
            {STATUS_ORDER.map(k => (
              <button key={k} className={`chip ${statusFilter === k ? 'active' : ''}`} onClick={() => setStatusFilter(k)}>{STATUS[k].label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>{clients.length === 0 ? 'Sua carteira está vazia' : 'Nada por aqui'}</h3>
              <p>{clients.length === 0 ? 'Comece cadastrando o primeiro cliente que você atendeu.' : 'Tenta ajustar a busca ou o filtro.'}</p>
            </div>
          ) : (
            <div className="list">
              {filtered.map(c => (
                <ClienteCard
                  key={c.id}
                  c={c}
                  onEdit={openEdit}
                  onDelete={(id) => setConfirmDelete(id)}
                  onMarcarContato={handleMarcarContato}
                  indicadorNome={c.indicado_por ? (clienteById.get(c.indicado_por)?.nome ?? null) : null}
                />
              ))}
            </div>
          )}

          <button className="fab" onClick={openAdd}><Plus size={18} /> Novo cliente</button>

          {formOpen && (
            <div className="modal-overlay" onClick={() => setFormOpen(false)}>
              <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleSave}>
                <div className="modal-header">
                  <span className="modal-title">{form.id ? 'Editar cliente' : 'Novo cliente'}</span>
                  <button type="button" className="close-btn" onClick={() => setFormOpen(false)}><X size={20} /></button>
                </div>
                <div className="form-grid">
                  <div className="form-field full">
                    <label>Nome *</label>
                    <input {...field('nome')} placeholder="Nome do cliente" required />
                  </div>
                  <div className="form-field">
                    <label>Telefone / WhatsApp *</label>
                    <input {...field('telefone')} placeholder="(17) 99999-9999" required />
                  </div>
                  <div className="form-field">
                    <label>Produto</label>
                    <input {...field('produto')} placeholder="Painel TV, sofá, geladeira..." />
                  </div>
                  <div className="form-field">
                    <label>Valor total</label>
                    <input {...field('valor_total')} type="number" step="0.01" placeholder="0,00" />
                  </div>
                  <div className="form-field">
                    <label>Valor da parcela</label>
                    <input {...field('valor_parcela')} type="number" step="0.01" placeholder="0,00" />
                  </div>
                  <div className="form-field">
                    <label>Número de parcelas</label>
                    <input {...field('numero_parcelas')} type="number" min="1" placeholder="12" />
                  </div>
                  <div className="form-field">
                    <label>Dia de vencimento</label>
                    <input {...field('dia_vencimento')} type="number" min="1" max="31" placeholder="10" />
                  </div>
                  <div className="form-field">
                    <label>Data da compra</label>
                    <input {...field('data_compra')} type="date" />
                  </div>
                  <div className="form-field">
                    <label>Data de nascimento</label>
                    <input {...field('data_nascimento')} type="date" />
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select {...field('status')}>
                      {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Indicado por</label>
                    <select {...field('indicado_por')}>
                      <option value="">Ninguém / veio sozinho</option>
                      {clients.filter(o => o.id !== form.id).map(o => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </select>
                  </div>
                  {previewTermino && (
                    <div className="termino-preview">Término previsto do carnê: {previewTermino}</div>
                  )}
                  <div className="form-field">
                    <label>Próximo contato (opcional)</label>
                    <input {...field('proximo_contato')} type="date" />
                  </div>
                  <div className="form-field full">
                    <label>Observações</label>
                    <textarea {...field('observacoes')} placeholder="Preferências, combinados, detalhes da negociação..." />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn primary">Salvar</button>
                </div>
              </form>
            </div>
          )}

          {confirmDelete && (
            <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
              <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                <div className="modal-title" style={{ marginBottom: 10 }}>Excluir cliente?</div>
                <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Essa ação não pode ser desfeita.</p>
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                  <button className="btn danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
                </div>
              </div>
            </div>
          )}

          {toast && <div className="toast">{toast}</div>}
        </>
      )}
    </div>
  );
}
