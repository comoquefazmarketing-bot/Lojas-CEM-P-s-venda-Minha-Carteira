'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Phone, MessageCircle, X, Pencil, Trash2,
  Clock, Users, AlertTriangle, Download, LogOut, Flame,
  Snowflake, Star, Target, Check, Gift, Repeat, Handshake,
  ChevronDown, Zap, CalendarDays, Wallet, Trophy, TrendingUp, Coins, ClipboardList, Bell, Rocket,
  ListChecks, Activity, BarChart3, PhoneOff, MapPin, BadgePercent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Cliente, StatusKey, STATUS, STATUS_ORDER, FORMA_PAGAMENTO, Interacao } from '@/types';

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
const WEEKDAY_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function weekdayAbbrev(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAY_ABBR[new Date(y, m - 1, d).getDay()];
}
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
function monthKey(iso: string) { return iso.slice(0, 7); }
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
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

type ScriptDef = { label: string; icon: typeof MessageCircle; build: (nome: string, produto: string | null) => string };

type ScriptKey = 'posvenda' | 'carne' | 'reativacao' | 'aniversario' | 'indicacao';

const SCRIPTS: Record<ScriptKey, ScriptDef> = {
  posvenda: {
    label: 'Pós-venda (satisfação)',
    icon: MessageCircle,
    build: (nome, produto) => `Oi ${firstName(nome)}! Aqui é o Felipe, das Lojas CEM. Passando pra saber se está tudo certo com ${produto || 'sua compra'} — qualquer coisa, pode me chamar! 😊`,
  },
  carne: {
    label: 'Carnê acabando (recompra)',
    icon: Repeat,
    build: (nome) => `Oi ${firstName(nome)}! Aqui é o Felipe, das Lojas CEM. Vi aqui que seu carnê tá quase no fim 🎉 Isso significa que seu crédito na loja já libera de novo. Quer que eu separe umas novidades pra você dar uma olhada?`,
  },
  reativacao: {
    label: 'Reativação (sumiu)',
    icon: Zap,
    build: (nome) => `Oi ${firstName(nome)}, tudo bem? Aqui é o Felipe, das Lojas CEM. Faz um tempo que a gente não troca uma ideia! Tô com umas condições boas na loja essa semana, passa aqui ou me chama que te conto 😉`,
  },
  aniversario: {
    label: 'Aniversário',
    icon: Gift,
    build: (nome) => `Parabéns, ${firstName(nome)}! 🎉🎂 Aqui é o Felipe, das Lojas CEM, e toda a equipe te deseja um ano incrível. E já separei uma condição especial de aniversário pra você, se quiser dar uma olhada!`,
  },
  indicacao: {
    label: 'Pedido de indicação',
    icon: Handshake,
    build: (nome) => `Oi ${firstName(nome)}! Aqui é o Felipe, das Lojas CEM. Fico muito feliz que você é cliente da gente 🙏 Se você conhecer alguém que tá precisando de algo pra casa, me indica? Cuido super bem de quem você mandar!`,
  },
};

// prospect ainda não comprou — scripts focados em trazer pra loja e fechar negócio,
// não em pós-venda (que pressupõe uma compra já feita)
type ProspectScriptKey = 'abordagem' | 'reforco' | 'condicao' | 'convite' | 'urgencia';

const PROSPECT_SCRIPTS: Record<ProspectScriptKey, ScriptDef> = {
  abordagem: {
    label: 'Primeiro contato',
    icon: Handshake,
    build: (nome, produto) => `Oi ${firstName(nome)}! Aqui é o Felipe, das Lojas CEM 😊 Vi que você se interessou ${produto ? `pelo(a) ${produto}` : 'por um dos nossos produtos'} — separei umas opções bem legais e condições que cabem no seu bolso. Posso te mandar os detalhes agora?`,
  },
  reforco: {
    label: 'Reforçar interesse',
    icon: MessageCircle,
    build: (nome, produto) => `Oi ${firstName(nome)}, tudo bem? Aqui é o Felipe, das Lojas CEM. Passando pra saber se você ainda está de olho ${produto ? `no(a) ${produto}` : 'naquele produto'} 🙂 Separei uma condição bem em conta — quer que eu te conte os detalhes?`,
  },
  condicao: {
    label: 'Condição especial pra fechar',
    icon: BadgePercent,
    build: (nome, produto) => `${firstName(nome)}, boa notícia! Consegui liberar uma condição especial ${produto ? `pro(a) ${produto}` : 'pra você'} — entrada facilitada e parcelas que cabem certinho no seu bolso. Vale só até essa semana, bora fechar? 🔥`,
  },
  convite: {
    label: 'Convite pra loja',
    icon: MapPin,
    build: (nome, produto) => `Oi ${firstName(nome)}! Que tal passar aqui na loja essa semana? Assim você vê ${produto ? `o(a) ${produto}` : 'os produtos'} de pertinho, sente a qualidade, e eu já te ajudo com a melhor condição de pagamento na hora. Qual dia fica melhor pra você?`,
  },
  urgencia: {
    label: 'Últimas unidades',
    icon: Flame,
    build: (nome, produto) => `${firstName(nome)}, corre que separei ${produto ? `um(a) ${produto}` : 'uma unidade'} com a condição que combinamos, mas o estoque tá acabando! Posso guardar pra você até amanhã?`,
  },
};

function waLinkWithText(telefone: string, text: string) {
  const digits = onlyDigits(telefone);
  const phone = digits.length > 0 && digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/* ------------------------------- comissão & categorias (estimativa) ------------------------------- */
// Taxas informadas: móveis 2,5% e TV 0,5%. Pra produtos que não se encaixam em nenhuma das
// duas categorias, usamos uma taxa intermediária aproximada (média das duas) só pra dar uma
// perspectiva — não é o valor oficial.
// Uma venda pode ter vários produtos (campo Produto aceita múltiplos itens); como só existe um
// valor_total por venda, dividimos ele igualmente entre os itens e aplicamos a taxa de cada
// categoria separadamente — assim uma venda "Sofá + Smart TV" não cai inteira em Móveis.
export type CategoriaProduto = 'MOVEIS' | 'TV' | 'OUTROS';

const CATEGORIA_LABELS: Record<CategoriaProduto, string> = { MOVEIS: 'Móveis', TV: 'TV', OUTROS: 'Outros produtos' };
const CATEGORIA_TAXA: Record<CategoriaProduto, number> = { MOVEIS: 0.025, TV: 0.005, OUTROS: 0.015 };
const CATEGORIA_ORDEM: CategoriaProduto[] = ['MOVEIS', 'TV', 'OUTROS'];
const CATEGORIA_PALAVRAS: { categoria: CategoriaProduto; palavras: string[] }[] = [
  { categoria: 'MOVEIS', palavras: ['sofa', 'cama', 'colchao', 'guarda-roupa', 'guarda roupa', 'guardaroupa', 'estante', 'mesa', 'cadeira', 'rack', 'armario', 'painel', 'poltrona', 'comoda', 'escrivaninha', 'roupeiro'] },
  { categoria: 'TV', palavras: ['tv', 'televisao', 'smart tv'] },
];
const SALARIO_MINIMO_GARANTIDO = 2500;

const PRODUTOS_SUGERIDOS = [
  'Sofá', 'Cama', 'Colchão', 'Guarda-roupa', 'Estante', 'Mesa', 'Cadeira', 'Rack',
  'Armário', 'Painel para TV', 'Poltrona', 'Cômoda', 'Escrivaninha',
  'Smart TV', 'TV',
  'Geladeira', 'Fogão', 'Máquina de lavar', 'Micro-ondas', 'Freezer', 'Ar-condicionado',
];

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function splitProdutos(produto: string | null): string[] {
  return (produto || '').split(',').map(s => s.trim()).filter(Boolean);
}

function categoriaProduto(produto: string | null): CategoriaProduto {
  if (!produto) return 'OUTROS';
  const texto = normalizeText(produto);
  for (const grupo of CATEGORIA_PALAVRAS) {
    if (grupo.palavras.some(p => texto.includes(normalizeText(p)))) return grupo.categoria;
  }
  return 'OUTROS';
}

/** Divide o valor total da venda entre os produtos cadastrados e agrupa por categoria. */
function valorPorCategoria(produto: string | null, valorTotal: number | null): Record<CategoriaProduto, number> {
  const totais: Record<CategoriaProduto, number> = { MOVEIS: 0, TV: 0, OUTROS: 0 };
  if (!valorTotal) return totais;
  const itens = splitProdutos(produto);
  if (itens.length === 0) { totais.OUTROS = valorTotal; return totais; }
  const valorPorItem = valorTotal / itens.length;
  itens.forEach(item => { totais[categoriaProduto(item)] += valorPorItem; });
  return totais;
}

function comissaoVenda(produto: string | null, valorTotal: number | null): number {
  const porCategoria = valorPorCategoria(produto, valorTotal);
  return CATEGORIA_ORDEM.reduce((sum, cat) => sum + porCategoria[cat] * CATEGORIA_TAXA[cat], 0);
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
  id: '', nome: '', telefone: '', produto: '', forma_pagamento: 'PARCELADO',
  valor_total: null, valor_sinal: null, valor_parcela: null, numero_parcelas: null,
  data_compra: new Date().toISOString().slice(0, 10),
  dia_vencimento: null, status: 'ATIVO', observacoes: '', proximo_contato: null,
  data_nascimento: null, indicado_por: null, ultimo_contato: null,
};

/* ---------------------------------- motion helpers ---------------------------------- */

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function ripple(e: React.MouseEvent<HTMLElement>) {
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const span = document.createElement('span');
  span.className = 'ripple-effect';
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.style.left = `${e.clientX - rect.left - size / 2}px`;
  span.style.top = `${e.clientY - rect.top - size / 2}px`;
  target.appendChild(span);
  setTimeout(() => span.remove(), 650);
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.4 + Math.random() * 1.4,
    color: ['#F2600C', '#FFC93C', '#0F3D8C', '#3F6B4A', '#FFB238'][i % 5],
    width: 6 + Math.random() * 5,
  })), []);
  return (
    <div className="confetti-overlay" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.width * 1.7,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

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

function WaMenu({ c, onClose, anchorRect }: { c: Cliente; onClose: () => void; anchorRect: DOMRect }) {
  useEffect(() => {
    function onDocClick() { onClose(); }
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onClose, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchorRect.bottom + 6, window.innerHeight - 220),
    left: Math.min(anchorRect.left, window.innerWidth - 236),
  };

  const isProspect = c.status === 'PROSPECT';
  const scripts: ScriptDef[] = isProspect ? Object.values(PROSPECT_SCRIPTS) : Object.values(SCRIPTS);

  return createPortal(
    <div className="wa-menu" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="wa-menu-title">{isProspect ? 'Trazer pra loja' : 'Escolha o script'}</div>
      {scripts.map((s) => {
        const Icon = s.icon;
        return (
          <a
            key={s.label}
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
    </div>,
    document.body
  );
}

function formatCompactBRL(v: number) {
  if (v <= 0) return '';
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}mil`;
  return String(Math.round(v));
}

function TendenciaChart({ data }: { data: { iso: string; valor: number }[] }) {
  const trackHeight = 96;
  const max = Math.max(1, ...data.map(d => d.valor));
  const maiorValor = Math.max(0, ...data.map(d => d.valor));
  const melhorIdx = maiorValor > 0 ? data.findIndex(d => d.valor === maiorValor) : -1;
  const hojeIdx = data.length - 1;

  return (
    <div className="tendencia-chart-wrap">
      <div className="tendencia-bars" style={{ height: trackHeight }}>
        {data.map((d, i) => {
          const barH = d.valor > 0 ? Math.max(4, Math.round((d.valor / max) * trackHeight)) : 2;
          const isPeak = i === melhorIdx;
          return (
            <div key={d.iso} className={`tendencia-bar-col ${isPeak ? 'peak' : ''}`}>
              <span className="tendencia-bar-valor">{formatCompactBRL(d.valor)}</span>
              <div
                className={`tendencia-bar ${isPeak ? 'peak' : ''} ${i === hojeIdx ? 'hoje' : ''} ${d.valor === 0 ? 'vazio' : ''}`}
                style={{ height: barH }}
              />
            </div>
          );
        })}
      </div>
      <div className="tendencia-eixo">
        {data.map((d, i) => (
          <div key={d.iso} className={`tendencia-eixo-item ${i === melhorIdx ? 'melhor' : ''}`}>
            <span className="tendencia-eixo-dia">{d.iso.slice(8, 10)}</span>
            <span className="tendencia-eixo-sem">{weekdayAbbrev(d.iso)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClienteCard({
  c, onEdit, onDelete, onMarcarContato, indicadorNome, selectionMode, selected, onToggleSelect,
}: {
  c: EnrichedCliente;
  onEdit: (c: Cliente) => void;
  onDelete: (id: string) => void;
  onMarcarContato: (id: string) => void;
  indicadorNome: string | null;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const s = STATUS[c.status] || STATUS.ATIVO;
  const isProspect = c.status === 'PROSPECT';
  const hasTermino = !!(c.data_compra && c.numero_parcelas);
  const parcelasEstimadas = hasTermino
    ? Math.min(Number(c.numero_parcelas), monthsElapsed(c.data_compra as string) + 1)
    : null;
  const progresso = hasTermino ? Math.min(100, Math.round(((parcelasEstimadas as number) / Number(c.numero_parcelas)) * 100)) : 0;
  const terminandoEmBreve = c.status !== 'QUITADO' && c.diasParaTermino !== null && c.diasParaTermino <= 30;
  const contatoPendente = c.proximo_contato ? daysUntil(new Date(c.proximo_contato)) <= 0 : false;
  const [waOpen, setWaOpen] = useState(false);
  const waBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`card ${selectionMode ? 'card-selectable' : ''} ${selected ? 'card-selected' : ''}`}
      style={{ borderLeftColor: s.color }}
      onClick={selectionMode ? () => onToggleSelect(c.id) : undefined}
    >
      <div className="card-top">
        <div className="card-top-left">
          {selectionMode && (
            <input
              type="checkbox"
              className="card-checkbox"
              checked={selected}
              onChange={() => onToggleSelect(c.id)}
              onClick={e => e.stopPropagation()}
            />
          )}
          <div>
            <div className="card-nome">
              {c.nome}
              {c.isVip && <Star size={13} className="vip-star" fill="#B8862B" />}
            </div>
            <div className="card-produto">{c.produto || (isProspect ? 'Interesse ainda não especificado' : 'Produto não informado')}</div>
            <div className="card-meta-row">
              <Termometro t={c.temperatura} />
              {indicadorNome && <span className="ref-tag">indicado por {indicadorNome}</span>}
              {c.indicacoesFeitas > 0 && <span className="ref-tag ref-tag-gold"><Handshake size={11} /> {c.indicacoesFeitas} indicação{c.indicacoesFeitas > 1 ? 'ões' : ''}</span>}
            </div>
          </div>
        </div>
        <StampBadge statusKey={c.status} />
      </div>

      <div className="card-grid">
        {!isProspect && (
          <>
            <div className="card-field">
              <span className="mono-label">{c.forma_pagamento === 'A_VISTA' ? 'Pagamento' : 'Parcela'}</span>
              <span className="mono-val">
                {c.forma_pagamento === 'A_VISTA'
                  ? 'À vista'
                  : `${formatBRL(c.valor_parcela)}${c.numero_parcelas ? ` · ${c.numero_parcelas}x` : ''}`}
              </span>
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
            {!!c.valor_sinal && (
              <div className="card-field">
                <span className="mono-label">Sinal</span>
                <span className="mono-val">{formatBRL(c.valor_sinal)}</span>
              </div>
            )}
          </>
        )}
        {c.proximo_contato && (
          <div className="card-field">
            <span className="mono-label">Próximo contato</span>
            <span className="mono-val" style={contatoPendente ? { color: 'var(--gold)', fontWeight: 700 } : {}}>
              {formatDateBR(c.proximo_contato)}
            </span>
          </div>
        )}
      </div>

      {!isProspect && hasTermino && (
        <>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progresso}%`, background: s.color }} />
          </div>
          <div className="progress-label">~{parcelasEstimadas}/{c.numero_parcelas} parcelas (estimado)</div>
        </>
      )}

      {contatoPendente && (
        <div className="alert-row">
          <div className="alert-pill"><Clock size={13} strokeWidth={2.5} /> Contato de pós-venda pendente</div>
          <button className="mini-btn" onClick={e => { e.stopPropagation(); onMarcarContato(c.id); }}><Check size={12} /> Marcar feito</button>
        </div>
      )}

      {c.observacoes && <div className="card-obs">&quot;{c.observacoes}&quot;</div>}

      <div className="card-actions" onClick={e => e.stopPropagation()}>
        {c.telefone && (
          <>
            <a className="icon-btn" href={`tel:${onlyDigits(c.telefone)}`} title="Ligar"><Phone size={16} /></a>
            <div style={{ position: 'relative' }}>
              <button ref={waBtnRef} className="icon-btn wa" title="WhatsApp" onClick={() => setWaOpen(o => !o)}><MessageCircle size={16} /></button>
              {waOpen && waBtnRef.current && (
                <WaMenu c={c} onClose={() => setWaOpen(false)} anchorRect={waBtnRef.current.getBoundingClientRect()} />
              )}
            </div>
          </>
        )}
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
  const [produtoDraft, setProdutoDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [metaMensal, setMetaMensal] = useState<number | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [acaoDoDiaOpen, setAcaoDoDiaOpen] = useState(true);
  const [oportunidadesExcluidas, setOportunidadesExcluidas] = useState<Set<string>>(new Set());
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [metasCategoria, setMetasCategoria] = useState<Record<CategoriaProduto, number | null>>({ MOVEIS: null, TV: null, OUTROS: null });
  const [editingCategoria, setEditingCategoria] = useState<CategoriaProduto | null>(null);
  const [categoriaInput, setCategoriaInput] = useState('');
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [relatorioMes, setRelatorioMes] = useState(() => monthKey(todayIso()));
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [metaOpen, setMetaOpen] = useState(true);
  const [produtosOpen, setProdutosOpen] = useState(true);
  const [incompletosOpen, setIncompletosOpen] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushSupported(true);
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(sub => setPushSubscribed(!!sub));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cem-meta-open');
    if (saved !== null) setMetaOpen(saved === '1');
    const savedProdutos = localStorage.getItem('cem-produtos-open');
    if (savedProdutos !== null) setProdutosOpen(savedProdutos === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('cem-meta-open', metaOpen ? '1' : '0');
  }, [metaOpen]);
  useEffect(() => {
    localStorage.setItem('cem-produtos-open', produtosOpen ? '1' : '0');
  }, [produtosOpen]);

  function toggleSelectionMode() {
    setSelectionMode(m => !m);
    setSelectedIds(new Set());
  }
  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function handleMarcarContatoLote() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const { error } = await supabase.from('clientes').update({ ultimo_contato: todayIso(), proximo_contato: null }).in('id', ids);
    if (error) { showToast('Erro ao atualizar em lote'); return; }
    showToast(`${ids.length} cliente${ids.length > 1 ? 's' : ''} atualizado${ids.length > 1 ? 's' : ''} 👍`);
    setSelectedIds(new Set());
    setSelectionMode(false);
    loadClients({ silent: true });
  }

  async function handleAtivarNotificacoes() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { showToast('Permissão de notificação negada'); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setPushSubscribed(true);
      showToast('Notificações ativadas!');
    } catch {
      showToast('Não consegui ativar as notificações');
    }
  }

  const loadClients = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').order('criado_em', { ascending: false });
    if (error) setErrorMsg('Não consegui carregar sua carteira. Recarrega a página.');
    else setClients(data as Cliente[]);
    if (!opts?.silent) setLoading(false);
  }, [supabase]);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('meta_mensal, meta_moveis, meta_tv, meta_outros').maybeSingle();
    if (data) {
      setMetaMensal(data.meta_mensal);
      setMetasCategoria({ MOVEIS: data.meta_moveis, TV: data.meta_tv, OUTROS: data.meta_outros });
    }
  }, [supabase]);

  useEffect(() => { loadClients(); loadConfig(); }, [loadClients, loadConfig]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function loadInteracoes(clienteId: string) {
    const { data } = await supabase
      .from('interacoes')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false });
    setInteracoes((data as Interacao[]) ?? []);
  }

  function openAdd(status: StatusKey = 'ATIVO') {
    setForm({ ...emptyForm, id: '', status, data_compra: status === 'PROSPECT' ? null : emptyForm.data_compra });
    setInteracoes([]); setNovaNota(''); setProdutoDraft(''); setFormOpen(true);
  }
  function openEdit(c: Cliente) { setForm(c); setNovaNota(''); setProdutoDraft(''); loadInteracoes(c.id); setFormOpen(true); }

  async function handleAddInteracao() {
    if (!novaNota.trim() || !form.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Não consegui salvar'); return; }
    const { error } = await supabase.from('interacoes').insert({
      cliente_id: form.id, user_id: user.id, nota: novaNota.trim(), data: todayIso(),
    });
    if (error) { showToast('Não consegui salvar a anotação'); return; }
    await supabase.from('clientes').update({ ultimo_contato: todayIso() }).eq('id', form.id);
    setNovaNota('');
    loadInteracoes(form.id);
    loadClients({ silent: true });
  }

  async function handleDeleteInteracao(id: string) {
    const { error } = await supabase.from('interacoes').delete().eq('id', id);
    if (error) { showToast('Não consegui excluir'); return; }
    setInteracoes(prev => prev.filter(i => i.id !== id));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { showToast('Preenche pelo menos o nome'); return; }
    const num = (v: unknown) => (v === null || v === undefined || v === '') ? null : Number(v);
    const aVista = form.forma_pagamento === 'A_VISTA';
    const isProspect = form.status === 'PROSPECT';
    const payload = {
      nome: form.nome,
      telefone: form.telefone || null,
      produto: form.produto || null,
      forma_pagamento: form.forma_pagamento,
      valor_total: isProspect ? null : num(form.valor_total),
      valor_sinal: (isProspect || aVista) ? null : num(form.valor_sinal),
      valor_parcela: (isProspect || aVista) ? null : num(form.valor_parcela),
      numero_parcelas: (isProspect || aVista) ? null : num(form.numero_parcelas),
      data_compra: isProspect ? null : (form.data_compra || null),
      dia_vencimento: (isProspect || aVista) ? null : num(form.dia_vencimento),
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
    loadClients({ silent: true });
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    setConfirmDelete(null);
    if (error) { showToast('Erro ao excluir'); return; }
    showToast('Cliente removido');
    loadClients({ silent: true });
  }

  async function handleMarcarContato(id: string) {
    const { error } = await supabase.from('clientes').update({ ultimo_contato: todayIso(), proximo_contato: null }).eq('id', id);
    if (error) { showToast('Erro ao atualizar'); return; }
    showToast('Contato registrado 👍');
    loadClients({ silent: true });
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

  async function handleSaveMetaCategoria(cat: CategoriaProduto) {
    const val = parseFloat(categoriaInput.replace(',', '.'));
    setEditingCategoria(null);
    if (isNaN(val)) return;
    setMetasCategoria(prev => ({ ...prev, [cat]: val }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Não consegui salvar a meta'); return; }
    const coluna = cat === 'MOVEIS' ? 'meta_moveis' : cat === 'TV' ? 'meta_tv' : 'meta_outros';
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ user_id: user.id, [coluna]: val }, { onConflict: 'user_id' });
    if (error) showToast('Não consegui salvar a meta');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function exportCsv() {
    const headers = ['Nome','Telefone','Produto','Forma Pagamento','Valor Total','Sinal','Valor Parcela','Numero Parcelas','Data Compra','Termino Previsto','Status','Proximo Contato','Ultimo Contato','Observacoes'];
    const rows = enriched.map(c => [
      c.nome, c.telefone, c.produto || '', FORMA_PAGAMENTO[c.forma_pagamento]?.label || c.forma_pagamento,
      c.valor_total ?? '', c.valor_sinal ?? '', c.valor_parcela ?? '', c.numero_parcelas ?? '',
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
        const motivoContato = c.status === 'PROSPECT' ? 'Follow-up de venda pendente' : 'Contato de pós-venda vencido';
        candidatos.push({ cliente: c, motivo: motivoContato, icon: Clock, cor: 'var(--slate)', prioridade: 90 });
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

  const cadastrosIncompletos = useMemo(() => {
    return enriched
      .map(c => {
        const faltando: string[] = [];
        if (!c.telefone) faltando.push('telefone');
        if (c.status !== 'PROSPECT' && !c.produto) faltando.push('produto');
        return { cliente: c, faltando };
      })
      .filter(x => x.faltando.length > 0);
  }, [enriched]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const atrasados = enriched.filter(c => c.status === 'ATRASADO').length;
    const vips = enriched.filter(c => c.isVip).length;
    return { total, atrasados, vips, acaoHoje: acaoDoDia.length, incompletos: cadastrosIncompletos.length };
  }, [enriched, acaoDoDia, cadastrosIncompletos]);

  const statTotalAnim = useCountUp(stats.total);
  const statAcaoHojeAnim = useCountUp(stats.acaoHoje);
  const statAtrasadosAnim = useCountUp(stats.atrasados);
  const statVipsAnim = useCountUp(stats.vips);
  const statIncompletosAnim = useCountUp(stats.incompletos);

  const vendasMes = useMemo(() => {
    const now = new Date();
    return enriched.reduce((sum, c) => {
      if (!c.data_compra || !c.valor_total) return sum;
      const d = new Date(c.data_compra);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return sum + c.valor_total;
      return sum;
    }, 0);
  }, [enriched]);

  const comissaoMes = useMemo(() => {
    const now = new Date();
    return enriched.reduce((sum, c) => {
      if (!c.data_compra || !c.valor_total) return sum;
      const d = new Date(c.data_compra);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        return sum + comissaoVenda(c.produto, c.valor_total);
      }
      return sum;
    }, 0);
  }, [enriched]);

  const vendasPorCategoria = useMemo(() => {
    const now = new Date();
    const totais: Record<CategoriaProduto, number> = { MOVEIS: 0, TV: 0, OUTROS: 0 };
    enriched.forEach(c => {
      if (!c.data_compra || !c.valor_total) return;
      const d = new Date(c.data_compra);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        const porCategoria = valorPorCategoria(c.produto, c.valor_total);
        CATEGORIA_ORDEM.forEach(cat => { totais[cat] += porCategoria[cat]; });
      }
    });
    return totais;
  }, [enriched]);

  const primeiraDataCompra = useMemo(() => {
    const datas = clients.map(c => c.data_compra).filter((d): d is string => !!d).sort();
    return datas[0] ?? null;
  }, [clients]);

  const ritmoRecenteDiario = useMemo(() => {
    const now = new Date();
    const janela = 7;
    const diaFim = now.getDate();
    let diaInicio = Math.max(1, diaFim - janela + 1);
    // não deixa a janela recuar antes da primeira venda registrada no mês — senão os dias
    // "zerados" de antes de você começar a vender puxam o ritmo médio pra baixo à toa
    if (primeiraDataCompra) {
      const [py, pm, pd] = primeiraDataCompra.split('-').map(Number);
      if (py === now.getFullYear() && pm === now.getMonth() + 1 && pd > diaInicio) diaInicio = pd;
    }
    const dias = diaFim - diaInicio + 1;
    const soma = enriched.reduce((sum, c) => {
      if (!c.data_compra || !c.valor_total) return sum;
      const d = new Date(c.data_compra);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() >= diaInicio && d.getDate() <= diaFim) {
        return sum + c.valor_total;
      }
      return sum;
    }, 0);
    return soma / dias;
  }, [enriched, primeiraDataCompra]);

  const vendasUltimos14 = useMemo(() => {
    const dias: { iso: string; valor: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const valor = enriched.reduce((sum, c) => c.data_compra === iso ? sum + (c.valor_total || 0) : sum, 0);
      dias.push({ iso, valor });
    }
    return dias;
  }, [enriched]);

  const vendasPeriodoAnterior14 = useMemo(() => {
    let soma = 0;
    for (let i = 27; i >= 14; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      soma += enriched.reduce((sum, c) => c.data_compra === iso ? sum + (c.valor_total || 0) : sum, 0);
    }
    return soma;
  }, [enriched]);

  const totalUltimos14 = useMemo(() => vendasUltimos14.reduce((sum, d) => sum + d.valor, 0), [vendasUltimos14]);
  const variacaoPeriodo = vendasPeriodoAnterior14 > 0 ? ((totalUltimos14 - vendasPeriodoAnterior14) / vendasPeriodoAnterior14) * 100 : null;
  const melhorDiaPeriodo = useMemo(() => {
    const maiorValor = Math.max(0, ...vendasUltimos14.map(d => d.valor));
    return maiorValor > 0 ? vendasUltimos14.find(d => d.valor === maiorValor) ?? null : null;
  }, [vendasUltimos14]);

  const produtosMaisVendidos = useMemo(() => {
    // conta ocorrências, não valor — uma venda com vários produtos não tem o preço de
    // cada item em separado, então "quanto vendeu de cada" seria uma estimativa falsa
    const mapa = new Map<string, { nome: string; count: number }>();
    clients.forEach(c => {
      if (c.status === 'PROSPECT') return;
      splitProdutos(c.produto).forEach(item => {
        const chave = normalizeText(item);
        if (!chave) return;
        const atual = mapa.get(chave) || { nome: item, count: 0 };
        atual.count += 1;
        mapa.set(chave, atual);
      });
    });
    return [...mapa.values()].sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome)).slice(0, 8);
  }, [clients]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    set.add(monthKey(todayIso()));
    clients.forEach(c => { if (c.data_compra) set.add(monthKey(c.data_compra)); });
    return [...set].sort().reverse();
  }, [clients]);

  const relatorioData = useMemo(() => {
    const doMes = enriched.filter(c => c.data_compra && monthKey(c.data_compra) === relatorioMes);
    const vendas = doMes.reduce((sum, c) => sum + (c.valor_total || 0), 0);
    const comissao = doMes.reduce((sum, c) => sum + comissaoVenda(c.produto, c.valor_total), 0);
    const categorias: Record<CategoriaProduto, number> = { MOVEIS: 0, TV: 0, OUTROS: 0 };
    doMes.forEach(c => {
      const porCategoria = valorPorCategoria(c.produto, c.valor_total);
      CATEGORIA_ORDEM.forEach(cat => { categorias[cat] += porCategoria[cat]; });
    });
    const indicacoes = doMes.filter(c => c.indicado_por).length;
    const clientesDoMes = [...doMes].sort((a, b) => (a.data_compra || '').localeCompare(b.data_compra || ''));
    return { clientesNovos: doMes.length, vendas, comissao, categorias, indicacoes, clientesDoMes };
  }, [enriched, relatorioMes]);

  const metaCalc = useMemo(() => {
    const now = new Date();
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const diasRestantes = Math.max(1, diasNoMes - now.getDate() + 1);
    const valorRestante = metaMensal ? Math.max(0, metaMensal - vendasMes) : null;
    const metaDiaria = valorRestante !== null ? valorRestante / diasRestantes : null;
    const pct = metaMensal && metaMensal > 0 ? Math.min(100, (vendasMes / metaMensal) * 100) : 0;
    // projeta com base no ritmo dos últimos dias (não na média do mês inteiro), senão um
    // começo de mês devagar arrasta a projeção pra baixo mesmo que o ritmo atual seja forte
    const diasFuturos = Math.max(0, diasRestantes - 1);
    const projecaoFimMes = vendasMes + ritmoRecenteDiario * diasFuturos;
    const projecaoPct = metaMensal && metaMensal > 0 ? (projecaoFimMes / metaMensal) * 100 : 0;
    return { diasRestantes, valorRestante, metaDiaria, pct, projecaoFimMes, projecaoPct };
  }, [metaMensal, vendasMes, ritmoRecenteDiario]);

  const metaPctAnim = useCountUp(metaCalc.pct);
  const vendasMesAnim = useCountUp(vendasMes);
  const comissaoMesAnim = useCountUp(comissaoMes);
  const diasRestantesAnim = useCountUp(metaCalc.diasRestantes);
  const valorRestanteAnim = useCountUp(metaCalc.valorRestante ?? 0);
  const metaDiariaAnim = useCountUp(metaCalc.metaDiaria ?? 0);
  const projecaoFimMesAnim = useCountUp(metaCalc.projecaoFimMes);
  const projecaoPctAnim = useCountUp(metaCalc.projecaoPct);

  const [showConfetti, setShowConfetti] = useState(false);
  const prevMetaPctRef = useRef(0);
  useEffect(() => {
    if (metaCalc.pct >= 100 && prevMetaPctRef.current < 100) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3200);
      prevMetaPctRef.current = metaCalc.pct;
      return () => clearTimeout(t);
    }
    prevMetaPctRef.current = metaCalc.pct;
  }, [metaCalc.pct]);

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
    if (statusFilter === 'QUITADO') {
      list = list.filter(c => c.status === 'QUITADO' || c.forma_pagamento === 'A_VISTA');
    } else if (statusFilter !== 'TODOS') {
      list = list.filter(c => c.status === statusFilter);
    }
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
  const isProspectForm = form.status === 'PROSPECT';

  const produtoItems = splitProdutos(form.produto);

  function addProdutoItem(raw?: string) {
    const value = (raw ?? produtoDraft).trim();
    setProdutoDraft('');
    if (!value) return;
    if (produtoItems.some(p => p.toLowerCase() === value.toLowerCase())) return;
    setForm({ ...form, produto: [...produtoItems, value].join(', ') });
  }
  function removeProdutoItem(item: string) {
    setForm({ ...form, produto: produtoItems.filter(p => p !== item).join(', ') });
  }

  return (
    <div className="carteira-app">
      {showConfetti && <Confetti />}
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
              {pushSupported && (
                <button className="backup-btn" onClick={handleAtivarNotificacoes} disabled={pushSubscribed}>
                  <Bell size={13} /> {pushSubscribed ? 'Avisos ativos' : 'Ativar avisos'}
                </button>
              )}
              <button className="backup-btn" onClick={() => setRelatorioOpen(true)}><ClipboardList size={13} /> Relatório</button>
              <button className="backup-btn" onClick={exportCsv}><Download size={13} /> CSV</button>
              <button className="logout-btn" onClick={handleLogout}><LogOut size={13} /> Sair</button>
            </div>
          </div>

          {errorMsg && <div className="error-banner">{errorMsg}</div>}

          <div className={`meta-hero ${metaCalc.pct >= 100 ? 'meta-hero-done' : ''}`}>
            <div className="meta-hero-top">
              <div className="meta-label"><Target size={15} /> Meta do mês</div>
              <div className="meta-hero-top-actions">
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
                <button type="button" className="meta-collapse-btn" onClick={() => setMetaOpen(o => !o)} title={metaOpen ? 'Recolher' : 'Expandir'}>
                  <ChevronDown size={16} style={{ transform: metaOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                </button>
              </div>
            </div>

            {!metaOpen && metaMensal && (
              <div className="meta-mini-summary">
                <div className="meta-mini-summary-pct mono">{metaCalc.pct >= 100 ? '🏆' : `${Math.round(metaCalc.pct)}%`}</div>
                <div className="meta-track-mini"><div className="meta-fill-mini" style={{ width: `${metaCalc.pct}%` }} /></div>
                <div className="meta-mini-summary-txt mono">{formatBRL(vendasMes)} de {formatBRL(metaMensal)}</div>
              </div>
            )}

            {metaOpen && (metaMensal ? (
              <>
                <div className="meta-pct-big mono">
                  {metaCalc.pct >= 100 ? '🏆 Meta batida!' : `${Math.round(metaPctAnim)}%`}
                </div>
                <div className="meta-track-big">
                  <div className="meta-fill-big" style={{ width: `${metaCalc.pct}%` }} />
                  <div className="meta-tick" style={{ left: '25%' }} />
                  <div className="meta-tick" style={{ left: '50%' }} />
                  <div className="meta-tick" style={{ left: '75%' }} />
                  <Trophy size={16} className="meta-trophy" />
                </div>
                <div className="meta-numbers mono">{formatBRL(vendasMesAnim)} de {formatBRL(metaMensal)}</div>

                <div className="projecao-box">
                  <div className="projecao-label"><Rocket size={13} /> Projeção pro fim do mês, no seu ritmo atual</div>
                  <div className="projecao-track">
                    <div
                      className={`projecao-fill${metaCalc.projecaoPct >= 100 ? ' projecao-fill-over' : ''}`}
                      style={{ width: `${Math.min(100, metaCalc.projecaoPct)}%` }}
                    />
                  </div>
                  <div className="projecao-numbers mono">
                    {formatBRL(projecaoFimMesAnim)} · {Math.round(projecaoPctAnim)}% da meta
                    {metaCalc.projecaoPct >= 100 ? (
                      <span className="projecao-over-tag"> · supera em {formatBRL(metaCalc.projecaoFimMes - metaMensal)}</span>
                    ) : (
                      <span className="projecao-under-tag"> · fica {formatBRL(metaMensal - metaCalc.projecaoFimMes)} abaixo</span>
                    )}
                  </div>
                </div>

                <div className="meta-mini-stats">
                  <div className="meta-mini">
                    <CalendarDays size={14} className="meta-mini-icon" />
                    <div className="meta-mini-text"><div className="meta-mini-num mono">{Math.round(diasRestantesAnim)}</div><div className="meta-mini-label">dias restantes</div></div>
                  </div>
                  <div className="meta-mini">
                    <Wallet size={14} className="meta-mini-icon" />
                    <div className="meta-mini-text"><div className="meta-mini-num mono">{formatBRL(valorRestanteAnim)}</div><div className="meta-mini-label">falta pra meta</div></div>
                  </div>
                  <div className="meta-mini">
                    <TrendingUp size={14} className="meta-mini-icon" />
                    <div className="meta-mini-text"><div className="meta-mini-num mono">{metaCalc.valorRestante === 0 ? 'R$ 0' : formatBRL(metaDiariaAnim)}</div><div className="meta-mini-label">vender por dia</div></div>
                  </div>
                  <div className="meta-mini" title="Estimativa aproximada: móveis 2,5%, TV 0,5%, demais produtos numa taxa média aproximada">
                    <Coins size={14} className="meta-mini-icon" />
                    <div className="meta-mini-text"><div className="meta-mini-num mono">{formatBRL(comissaoMesAnim)}</div><div className="meta-mini-label">comissão estimada</div></div>
                  </div>
                </div>

                <div className="piso-box">
                  <div className="piso-label">Comissão vs. piso garantido ({formatBRL(SALARIO_MINIMO_GARANTIDO)})</div>
                  <div className="piso-track">
                    <div className="piso-fill" style={{ width: `${Math.min(100, (comissaoMes / SALARIO_MINIMO_GARANTIDO) * 100)}%` }} />
                  </div>
                  <div className="piso-numbers mono">
                    {formatBRL(comissaoMesAnim)} de {formatBRL(SALARIO_MINIMO_GARANTIDO)} · {Math.min(100, (comissaoMes / SALARIO_MINIMO_GARANTIDO) * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="categorias-box">
                  <div className="categorias-title">Metas por categoria</div>
                  {CATEGORIA_ORDEM.map(cat => {
                    const meta = metasCategoria[cat];
                    const vendido = vendasPorCategoria[cat];
                    const pct = meta ? Math.min(100, (vendido / meta) * 100) : 0;
                    return (
                      <div key={cat} className="categoria-row">
                        <div className="categoria-row-top">
                          <span className="categoria-nome">{CATEGORIA_LABELS[cat]}</span>
                          {editingCategoria === cat ? (
                            <input
                              autoFocus
                              className="meta-input categoria-input"
                              value={categoriaInput}
                              onChange={e => setCategoriaInput(e.target.value)}
                              onBlur={() => handleSaveMetaCategoria(cat)}
                              onKeyDown={e => e.key === 'Enter' && handleSaveMetaCategoria(cat)}
                              placeholder="0,00"
                            />
                          ) : (
                            <button
                              className="meta-set-btn"
                              onClick={() => { setCategoriaInput(String(meta ?? '')); setEditingCategoria(cat); }}
                            >
                              {meta ? 'Editar' : 'Definir'}
                            </button>
                          )}
                        </div>
                        {meta ? (
                          <>
                            <div className="categoria-track">
                              <div className="categoria-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="categoria-numbers mono">{formatBRL(vendido)} de {formatBRL(meta)} · {pct.toFixed(0)}%</div>
                          </>
                        ) : (
                          <div className="categoria-empty">{formatBRL(vendido)} vendidos esse mês · sem meta definida</div>
                        )}
                      </div>
                    );
                  })}
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
            ))}
          </div>

          <div className="stats-row">
            <div className="stat-card"><div className="stat-num mono">{Math.round(statTotalAnim)}</div><div className="stat-label"><Users size={12} /> Total</div></div>
            <div className="stat-card warn"><div className="stat-num mono">{Math.round(statAcaoHojeAnim)}</div><div className="stat-label"><Zap size={12} /> Ação hoje</div></div>
            <div className="stat-card danger"><div className="stat-num mono">{Math.round(statAtrasadosAnim)}</div><div className="stat-label"><AlertTriangle size={12} /> Atrasados</div></div>
            <div className="stat-card gold"><div className="stat-num mono">{Math.round(statVipsAnim)}</div><div className="stat-label"><Star size={12} /> VIPs</div></div>
            <div className="stat-card danger"><div className="stat-num mono">{Math.round(statIncompletosAnim)}</div><div className="stat-label"><PhoneOff size={12} /> Incompletos</div></div>
          </div>

          {totalUltimos14 > 0 && (
            <div className="tendencia-card">
              <div className="tendencia-header">
                <div>
                  <div className="tendencia-title"><Activity size={15} /> Tendência — últimos 14 dias</div>
                  <div className="tendencia-total-big mono">{formatBRL(totalUltimos14)}</div>
                </div>
                {variacaoPeriodo !== null && (
                  <span className={`tendencia-badge ${variacaoPeriodo >= 0 ? 'up' : 'down'}`}>
                    {variacaoPeriodo >= 0 ? '▲' : '▼'} {Math.abs(Math.round(variacaoPeriodo))}%
                  </span>
                )}
              </div>
              <TendenciaChart data={vendasUltimos14} />
              {melhorDiaPeriodo && (
                <div className="tendencia-melhor-dia">
                  🏆 melhor dia: {weekdayAbbrev(melhorDiaPeriodo.iso)} {melhorDiaPeriodo.iso.slice(8, 10)}/{melhorDiaPeriodo.iso.slice(5, 7)} — {formatBRL(melhorDiaPeriodo.valor)}
                </div>
              )}
            </div>
          )}

          {produtosMaisVendidos.length > 0 && (
            <div className="tendencia-card">
              <button type="button" className="tendencia-header tendencia-header-toggle" onClick={() => setProdutosOpen(o => !o)}>
                <div className="tendencia-title"><BarChart3 size={15} /> Produtos mais vendidos</div>
                <ChevronDown size={16} style={{ transform: produtosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
              </button>
              {produtosOpen && (
                <div className="produtos-ranking">
                  {produtosMaisVendidos.map((p, i) => {
                    const maiorCount = produtosMaisVendidos[0].count;
                    const pct = maiorCount > 0 ? (p.count / maiorCount) * 100 : 0;
                    return (
                      <div key={p.nome} className="produto-rank-row">
                        <span className="produto-rank-pos">{i + 1}º</span>
                        <div className="produto-rank-info">
                          <div className="produto-rank-top">
                            <span className="produto-rank-nome">{p.nome}</span>
                            <span className="produto-rank-count mono">{p.count}x</span>
                          </div>
                          <div className="produto-rank-track">
                            <div className="produto-rank-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
                      <a
                        className="mini-btn wa-mini"
                        href={waLinkWithText(
                          cliente.telefone,
                          cliente.status === 'PROSPECT'
                            ? PROSPECT_SCRIPTS.abordagem.build(cliente.nome, cliente.produto)
                            : SCRIPTS.posvenda.build(cliente.nome, cliente.produto)
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={12} /> Chamar
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {cadastrosIncompletos.length > 0 && (
            <div className="acao-dia-section incompletos-section">
              <button className="acao-dia-header" onClick={() => setIncompletosOpen(o => !o)}>
                <span><PhoneOff size={15} color="var(--rust)" /> Cadastro incompleto — {cadastrosIncompletos.length} cliente{cadastrosIncompletos.length > 1 ? 's' : ''}</span>
                <ChevronDown size={16} style={{ transform: incompletosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {incompletosOpen && (
                <div className="acao-dia-list">
                  {cadastrosIncompletos.map(({ cliente, faltando }) => (
                    <div key={cliente.id} className="acao-dia-item">
                      <PhoneOff size={15} color="var(--rust)" />
                      <div className="acao-dia-texto">
                        <strong>{cliente.nome}</strong> — falta {faltando.join(' e ')}
                      </div>
                      <button type="button" className="mini-btn" onClick={() => openEdit(cliente)}>
                        <Pencil size={12} /> Completar
                      </button>
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
            <button type="button" className={`backup-btn ${selectionMode ? 'active' : ''}`} onClick={toggleSelectionMode}>
              <ListChecks size={13} /> {selectionMode ? 'Cancelar' : 'Selecionar'}
            </button>
          </div>

          <div className="chip-row">
            <button className={`chip ${statusFilter === 'TODOS' ? 'active' : ''}`} onClick={() => setStatusFilter('TODOS')}>Todos</button>
            {STATUS_ORDER.map(k => (
              <button key={k} className={`chip ${statusFilter === k ? 'active' : ''}`} onClick={() => setStatusFilter(k)}>{STATUS[k].label}</button>
            ))}
            {selectionMode && (
              <button className="chip" onClick={() => setSelectedIds(new Set(filtered.map(c => c.id)))}>
                Selecionar todos ({filtered.length})
              </button>
            )}
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
                  selectionMode={selectionMode}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={toggleSelected}
                />
              ))}
            </div>
          )}

          {selectionMode ? (
            selectedIds.size > 0 && (
              <div className="selection-bar">
                <span className="selection-bar-count">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
                <div className="selection-bar-actions">
                  <button type="button" className="btn-cancel" onClick={toggleSelectionMode}>Cancelar</button>
                  <button type="button" className="btn-confirm" onClick={handleMarcarContatoLote}><Check size={13} /> Marcar contato feito</button>
                </div>
              </div>
            )
          ) : (
            <>
              <button className="fab-secondary ripple-host" onClick={(e) => { ripple(e); openAdd('PROSPECT'); }}><Users size={16} /> Novo prospect</button>
              <button className="fab ripple-host" onClick={(e) => { ripple(e); openAdd(); }}><Plus size={18} /> Novo cliente</button>
            </>
          )}

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
                    <label>Telefone / WhatsApp</label>
                    <input {...field('telefone')} placeholder="(17) 99999-9999" />
                  </div>
                  <div className="form-field full">
                    <label>{isProspectForm ? 'Produtos de interesse' : 'Produtos'}</label>
                    <div className="tags-input">
                      {produtoItems.map(item => (
                        <span key={item} className="tag-chip">
                          {item}
                          <button type="button" onClick={() => removeProdutoItem(item)} aria-label={`Remover ${item}`}><X size={11} /></button>
                        </span>
                      ))}
                      <input
                        list="produtos-sugeridos"
                        value={produtoDraft}
                        onChange={e => setProdutoDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addProdutoItem(); }
                          else if (e.key === 'Backspace' && !produtoDraft && produtoItems.length) removeProdutoItem(produtoItems[produtoItems.length - 1]);
                        }}
                        onBlur={() => addProdutoItem()}
                        placeholder={produtoItems.length ? 'Adicionar outro...' : 'Painel TV, sofá, geladeira...'}
                        autoComplete="off"
                      />
                      <button type="button" className="tag-add-btn" onClick={() => addProdutoItem()} title="Adicionar produto"><Plus size={14} /></button>
                    </div>
                    <datalist id="produtos-sugeridos">
                      {PRODUTOS_SUGERIDOS.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select {...field('status')}>
                      {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                    </select>
                  </div>
                  {!isProspectForm && (
                    <>
                      <div className="form-field">
                        <label>Forma de pagamento</label>
                        <select {...field('forma_pagamento')}>
                          <option value="PARCELADO">Parcelado</option>
                          <option value="A_VISTA">À vista</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label>Valor total</label>
                        <input {...field('valor_total')} type="number" step="0.01" placeholder="0,00" />
                      </div>
                      {form.forma_pagamento !== 'A_VISTA' && (
                        <>
                          <div className="form-field">
                            <label>Sinal (entrada)</label>
                            <input {...field('valor_sinal')} type="number" step="0.01" placeholder="0,00" />
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
                        </>
                      )}
                      <div className="form-field">
                        <label>Data da compra</label>
                        <input {...field('data_compra')} type="date" />
                      </div>
                    </>
                  )}
                  <div className="form-field">
                    <label>Data de nascimento</label>
                    <input {...field('data_nascimento')} type="date" />
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
                  {previewTermino && !isProspectForm && (
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

                {form.id && (
                  <div className="historico-box">
                    <div className="historico-title">Histórico de interações</div>
                    <div className="historico-add">
                      <textarea
                        value={novaNota}
                        onChange={e => setNovaNota(e.target.value)}
                        placeholder="O que foi combinado/falado com o cliente..."
                      />
                      <button type="button" className="btn ghost historico-add-btn" onClick={handleAddInteracao}>
                        <Plus size={14} /> Registrar
                      </button>
                    </div>
                    {interacoes.length === 0 ? (
                      <p className="historico-empty">Nenhuma interação registrada ainda.</p>
                    ) : (
                      <div className="historico-list">
                        {interacoes.map(i => (
                          <div key={i.id} className="historico-item">
                            <div className="historico-item-top">
                              <span className="historico-data mono">{formatDateBR(i.data)}</span>
                              <button type="button" className="historico-del" onClick={() => handleDeleteInteracao(i.id)}><Trash2 size={12} /></button>
                            </div>
                            <div className="historico-nota">{i.nota}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn primary ripple-host" onClick={ripple}>Salvar</button>
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

          {relatorioOpen && (
            <div className="modal-overlay relatorio-modal-overlay" onClick={() => setRelatorioOpen(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Relatório mensal</span>
                  <div className="modal-header-actions">
                    <button type="button" className="backup-btn" onClick={() => window.print()}><Download size={13} /> Baixar PDF</button>
                    <button type="button" className="close-btn" onClick={() => setRelatorioOpen(false)}><X size={20} /></button>
                  </div>
                </div>

                <div className="relatorio-print">
                  <div className="relatorio-print-header">
                    <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="relatorio-print-logo" />
                    <div>
                      <div className="relatorio-print-titulo">Relatório mensal — {monthLabel(relatorioMes)}</div>
                      <div className="relatorio-print-sub">{userEmail} · gerado em {new Date().toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>

                  <select className="sort-select relatorio-mes-select" value={relatorioMes} onChange={e => setRelatorioMes(e.target.value)}>
                    {mesesDisponiveis.map(mes => (
                      <option key={mes} value={mes}>{monthLabel(mes)}</option>
                    ))}
                  </select>

                  <div className="relatorio-stats">
                    <div className="relatorio-stat">
                      <div className="relatorio-stat-num mono">{formatBRL(relatorioData.vendas)}</div>
                      <div className="relatorio-stat-label">Total vendido</div>
                    </div>
                    <div className="relatorio-stat">
                      <div className="relatorio-stat-num mono">{formatBRL(relatorioData.comissao)}</div>
                      <div className="relatorio-stat-label">Comissão estimada</div>
                    </div>
                    <div className="relatorio-stat">
                      <div className="relatorio-stat-num mono">{relatorioData.clientesNovos}</div>
                      <div className="relatorio-stat-label">Clientes atendidos</div>
                    </div>
                    <div className="relatorio-stat">
                      <div className="relatorio-stat-num mono">{relatorioData.indicacoes}</div>
                      <div className="relatorio-stat-label">Vieram por indicação</div>
                    </div>
                  </div>

                  <div className="relatorio-categorias">
                    <div className="relatorio-categorias-title">Vendas por categoria</div>
                    {CATEGORIA_ORDEM.map(cat => (
                      <div key={cat} className="relatorio-categoria-row">
                        <span>{CATEGORIA_LABELS[cat]}</span>
                        <span className="mono">{formatBRL(relatorioData.categorias[cat])}</span>
                      </div>
                    ))}
                  </div>

                  {relatorioData.clientesDoMes.length > 0 && (
                    <div className="relatorio-clientes">
                      <div className="relatorio-categorias-title">Clientes do mês ({relatorioData.clientesDoMes.length})</div>
                      <div className="relatorio-clientes-lista">
                        {relatorioData.clientesDoMes.map(c => (
                          <div key={c.id} className="relatorio-cliente-card">
                            <div className="relatorio-cliente-top">
                              <span className="relatorio-cliente-nome">{c.nome}</span>
                              <span className="relatorio-cliente-status">{STATUS[c.status]?.label || c.status}</span>
                            </div>
                            <div className="relatorio-cliente-grid">
                              <span><strong>Telefone:</strong> {c.telefone || '—'}</span>
                              <span><strong>Produto:</strong> {c.produto || '—'}</span>
                              <span><strong>Pagamento:</strong> {FORMA_PAGAMENTO[c.forma_pagamento]?.label || c.forma_pagamento}</span>
                              <span><strong>Valor total:</strong> {formatBRL(c.valor_total)}</span>
                              {c.forma_pagamento !== 'A_VISTA' && (
                                <>
                                  <span><strong>Sinal:</strong> {formatBRL(c.valor_sinal)}</span>
                                  <span><strong>Parcela:</strong> {formatBRL(c.valor_parcela)}{c.numero_parcelas ? ` · ${c.numero_parcelas}x` : ''}</span>
                                  <span><strong>Vencimento:</strong> {c.dia_vencimento ? `dia ${c.dia_vencimento}` : '—'}</span>
                                </>
                              )}
                              <span><strong>Data da compra:</strong> {formatDateBR(c.data_compra)}</span>
                              <span><strong>Próximo contato:</strong> {formatDateBR(c.proximo_contato)}</span>
                              <span><strong>Último contato:</strong> {formatDateBR(c.ultimo_contato)}</span>
                              <span><strong>Nascimento:</strong> {formatDateBR(c.data_nascimento)}</span>
                              {c.indicado_por && (
                                <span><strong>Indicado por:</strong> {clienteById.get(c.indicado_por)?.nome ?? '—'}</span>
                              )}
                            </div>
                            {c.observacoes && <div className="relatorio-cliente-obs">&quot;{c.observacoes}&quot;</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setRelatorioOpen(false)}>Fechar</button>
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
