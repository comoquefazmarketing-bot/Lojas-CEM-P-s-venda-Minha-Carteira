'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut, Users, TrendingUp, AlertTriangle, Target, ChevronDown,
  Repeat, ClipboardList, PhoneOff, Trophy, Pencil, Check, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Cliente, Interacao, MetaHistorico, StatusKey, STATUS, STATUS_ORDER } from '@/types';
import { splitProdutos } from '@/lib/produtos';
import { HelpTip } from '@/components/HelpTip';
import { ConfirmModal } from '@/components/ConfirmModal';

function formatBRL(v: number | null | undefined) {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function monthKey(iso: string) { return iso.slice(0, 7); }
/** `toISOString()` converte pra UTC antes de formatar — depois das 21h no horário de
 * Brasília (fuso negativo) isso já mostra o dia seguinte como "hoje". Usa os componentes
 * locais em vez disso. */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Profile = { user_id: string; email: string | null; nome: string | null; role: string };
type Configuracao = { user_id: string; meta_mensal: number | null };
type UsuarioGerencia = { user_id: string; email: string | null; nome: string | null; role: string; ativo: boolean; criado_em: string };

type VendedorResumo = {
  userId: string;
  nome: string;
  clientes: Cliente[];
  metaMensal: number | null;
  vendasMes: number;
  atrasados: number;
  prospects: number;
  pctMeta: number | null;
  pctContribuicaoLoja: number | null;
  conversoesMes: number;
  taxaConversao: number | null;
  interacoesMes: number;
  followUpsVencidos: number;
  diasMetaBatida: number | null;
  pctEsperadoPeloTempo: number;
  statusBreakdown: Record<StatusKey, number>;
  produtosMaisVendidos: { nome: string; qtd: number }[];
};

export default function GerenteApp({ userEmail, userNome }: { userEmail: string; userNome?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [metasHistorico, setMetasHistorico] = useState<MetaHistorico[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioGerencia[]>([]);
  const [usuariosOpen, setUsuariosOpen] = useState(false);
  const [destinoTransferencia, setDestinoTransferencia] = useState<Record<string, string>>({});
  const [metaLoja, setMetaLoja] = useState<number | null>(null);
  const [editandoMetaLoja, setEditandoMetaLoja] = useState(false);
  const [metaLojaInput, setMetaLojaInput] = useState('');
  const [salvandoMetaLoja, setSalvandoMetaLoja] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmTransferir, setConfirmTransferir] = useState<{ deUserId: string; paraUserId: string; deNome: string; paraNome: string; qtd: number } | null>(null);
  const [transferindoConfirmado, setTransferindoConfirmado] = useState(false);
  const [confirmUsuario, setConfirmUsuario] = useState<{ userId: string; update: { ativo?: boolean; role?: string }; titulo: string; mensagem: string; danger: boolean } | null>(null);
  const [alterandoConfirmado, setAlterandoConfirmado] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: c }, { data: p }, { data: cfg }, { data: intr }, { data: mh }] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('profiles').select('user_id, email, nome, role'),
        supabase.from('configuracoes').select('user_id, meta_mensal'),
        supabase.from('interacoes').select('*'),
        supabase.from('metas_historico').select('*'),
      ]);
      setClientes((c as Cliente[]) ?? []);
      setProfiles((p as Profile[]) ?? []);
      setConfigs((cfg as Configuracao[]) ?? []);
      setInteracoes((intr as Interacao[]) ?? []);
      setMetasHistorico((mh as MetaHistorico[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const loadMetaLoja = useCallback(async () => {
    const res = await fetch('/api/gerente/meta-loja');
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    setMetaLoja(typeof data?.valor === 'number' ? data.valor : null);
  }, []);

  useEffect(() => { loadMetaLoja(); }, [loadMetaLoja]);

  async function handleSalvarMetaLoja() {
    const valor = parseFloat(metaLojaInput.replace(/\./g, '').replace(',', '.'));
    if (!valor || valor <= 0) { showToast('Digita um valor válido pra meta da loja.'); return; }
    setSalvandoMetaLoja(true);
    const res = await fetch('/api/gerente/meta-loja', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ valor }),
    });
    setSalvandoMetaLoja(false);
    if (!res.ok) { showToast('Não consegui salvar a meta da loja.'); return; }
    setEditandoMetaLoja(false);
    loadMetaLoja();
  }

  const loadUsuarios = useCallback(async () => {
    const res = await fetch('/api/gerente/usuarios');
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.usuarios) setUsuarios(data.usuarios);
  }, []);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  function pedirAlteracaoUsuario(u: UsuarioGerencia, update: { ativo?: boolean; role?: string }) {
    const nome = u.nome || u.email || '(sem nome)';
    if (update.role) {
      const viraGerente = update.role === 'gerente';
      setConfirmUsuario({
        userId: u.user_id, update,
        titulo: viraGerente ? 'Promover a gerente?' : 'Rebaixar a vendedor?',
        mensagem: viraGerente
          ? `${nome} passa a ter acesso a esse painel gerencial e aos dados de todos os vendedores da loja.`
          : `${nome} perde o acesso a esse painel gerencial e volta a ver só a própria carteira.`,
        danger: !viraGerente,
      });
    } else {
      const vaiAtivar = !!update.ativo;
      setConfirmUsuario({
        userId: u.user_id, update,
        titulo: vaiAtivar ? 'Reativar usuário?' : 'Desativar usuário?',
        mensagem: vaiAtivar
          ? `${nome} volta a conseguir fazer login normalmente.`
          : `${nome} não vai mais conseguir fazer login até ser reativado.`,
        danger: !vaiAtivar,
      });
    }
  }

  async function confirmarAlteracaoUsuario() {
    if (!confirmUsuario) return;
    setAlterandoConfirmado(true);
    const res = await fetch('/api/gerente/usuarios', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: confirmUsuario.userId, ...confirmUsuario.update }),
    });
    setAlterandoConfirmado(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || 'Não consegui atualizar esse usuário.');
      setConfirmUsuario(null);
      return;
    }
    setConfirmUsuario(null);
    loadUsuarios();
  }

  function pedirTransferencia(deUserId: string) {
    const paraUserId = destinoTransferencia[deUserId];
    if (!paraUserId) { showToast('Escolhe pra quem transferir a carteira.'); return; }
    const de = usuarios.find(u => u.user_id === deUserId);
    const para = usuarios.find(u => u.user_id === paraUserId);
    const qtd = vendedores.find(v => v.userId === deUserId)?.clientes.length ?? 0;
    setConfirmTransferir({
      deUserId, paraUserId,
      deNome: de?.nome || de?.email || '(sem nome)',
      paraNome: para?.nome || para?.email || '(sem nome)',
      qtd,
    });
  }

  async function confirmarTransferencia() {
    if (!confirmTransferir) return;
    setTransferindoConfirmado(true);
    const res = await fetch('/api/gerente/transferir-carteira', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ de_user_id: confirmTransferir.deUserId, para_user_id: confirmTransferir.paraUserId }),
    });
    const data = await res.json().catch(() => null);
    setTransferindoConfirmado(false);
    if (!res.ok) { showToast(data?.error || 'Não consegui transferir a carteira.'); setConfirmTransferir(null); return; }
    showToast(`${data.transferidos} cliente(s) transferido(s) com sucesso.`);
    setDestinoTransferencia(prev => ({ ...prev, [confirmTransferir.deUserId]: '' }));
    setConfirmTransferir(null);
    const [{ data: c }] = await Promise.all([supabase.from('clientes').select('*')]);
    setClientes((c as Cliente[]) ?? []);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const [boasVindas, setBoasVindas] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!localStorage.getItem('cem-gerente-boas-vindas-visto')) setBoasVindas(true);
  }, [loading]);
  function fecharBoasVindas() {
    localStorage.setItem('cem-gerente-boas-vindas-visto', '1');
    setBoasVindas(false);
  }

  const vendedores: VendedorResumo[] = useMemo(() => {
    const hojeIso = todayIso();
    const mesAtual = monthKey(hojeIso);
    const metaPorUsuario = new Map(configs.map(c => [c.user_id, c.meta_mensal]));
    const vendedoresProfiles = profiles.filter(p => p.role !== 'gerente');

    return vendedoresProfiles
      .map(p => {
        const clientesDoVendedor = clientes.filter(c => c.user_id === p.user_id);
        const vendasMes = clientesDoVendedor.reduce((sum, c) => {
          if (c.data_compra && c.valor_total && monthKey(c.data_compra) === mesAtual) return sum + c.valor_total;
          return sum;
        }, 0);
        const atrasados = clientesDoVendedor.filter(c => c.status === 'ATRASADO').length;
        const prospects = clientesDoVendedor.filter(c => c.status === 'PROSPECT').length;
        const metaMensal = metaPorUsuario.get(p.user_id) ?? null;
        const pctMeta = metaMensal ? Math.min(100, (vendasMes / metaMensal) * 100) : null;
        const pctContribuicaoLoja = metaLoja ? (vendasMes / metaLoja) * 100 : null;

        const conversoesMes = clientesDoVendedor.filter(
          c => c.data_conversao && monthKey(c.data_conversao) === mesAtual
        ).length;
        const convertidosTotal = clientesDoVendedor.filter(c => c.data_conversao).length;
        const taxaConversao = (convertidosTotal + prospects) > 0
          ? Math.round((convertidosTotal / (convertidosTotal + prospects)) * 100)
          : null;

        const interacoesMes = interacoes.filter(
          it => it.user_id === p.user_id && it.data && monthKey(it.data) === mesAtual
        ).length;

        const followUpsVencidos = clientesDoVendedor.filter(
          c => c.proximo_contato && c.proximo_contato <= hojeIso
        ).length;

        const metaBatidaEsseMes = metasHistorico.find(m => m.user_id === p.user_id && m.mes === mesAtual);
        const diasMetaBatida = metaBatidaEsseMes?.dia_meta_batida ?? null;

        const hoje = new Date();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        const pctEsperadoPeloTempo = Math.min(100, (hoje.getDate() / diasNoMes) * 100);

        const statusBreakdown = STATUS_ORDER.reduce((acc, s) => {
          acc[s] = clientesDoVendedor.filter(c => c.status === s).length;
          return acc;
        }, {} as Record<StatusKey, number>);

        const contagemProdutos = new Map<string, number>();
        clientesDoVendedor.forEach(c => {
          splitProdutos(c.produto).forEach(item => {
            contagemProdutos.set(item, (contagemProdutos.get(item) ?? 0) + 1);
          });
        });
        const produtosMaisVendidos = Array.from(contagemProdutos.entries())
          .map(([nome, qtd]) => ({ nome, qtd }))
          .sort((a, b) => b.qtd - a.qtd)
          .slice(0, 5);

        return {
          userId: p.user_id,
          nome: p.nome || p.email || '(sem nome)',
          clientes: clientesDoVendedor,
          metaMensal,
          vendasMes,
          atrasados,
          prospects,
          pctMeta,
          pctContribuicaoLoja,
          conversoesMes,
          taxaConversao,
          interacoesMes,
          followUpsVencidos,
          diasMetaBatida,
          pctEsperadoPeloTempo,
          statusBreakdown,
          produtosMaisVendidos,
        };
      })
      .sort((a, b) => b.vendasMes - a.vendasMes);
  }, [clientes, profiles, configs, interacoes, metasHistorico, metaLoja]);

  const totais = useMemo(() => {
    const vendasMesTotal = vendedores.reduce((s, v) => s + v.vendasMes, 0);
    const atrasadosTotal = vendedores.reduce((s, v) => s + v.atrasados, 0);
    const prospectsTotal = vendedores.reduce((s, v) => s + v.prospects, 0);
    const metaTotal = vendedores.reduce((s, v) => s + (v.metaMensal || 0), 0);
    const pctMetaLoja = metaLoja ? Math.min(100, (vendasMesTotal / metaLoja) * 100) : null;
    return { vendasMesTotal, atrasadosTotal, prospectsTotal, metaTotal, pctMetaLoja, qtdVendedores: vendedores.length };
  }, [vendedores, metaLoja]);

  if (loading) {
    return (
      <div className="carteira-app">
        <div className="loading-msg">carregando painel...</div>
      </div>
    );
  }

  return (
    <div className="carteira-app">
      <div className="top-header">
        <div>
          <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="header-logo" />
          <div className="eyebrow">Lojas CEM · Painel Gerencial</div>
          <h1 className="title">Visão da Loja</h1>
          <div className="subtitle">{userNome || userEmail} · {totais.qtdVendedores} vendedor{totais.qtdVendedores !== 1 ? 'es' : ''}</div>
        </div>
        <div className="header-actions">
          <button className="logout-btn" onClick={handleLogout}><LogOut size={13} /> Sair</button>
        </div>
      </div>

      {boasVindas && (
        <div className="welcome-banner">
          <div>
            <strong>Esse é o painel de gerente.</strong> Diferente da carteira de vendedor, aqui você vê o resultado
            de todos os vendedores da loja, define a meta geral e pode transferir carteiras ou gerenciar acessos.
          </div>
          <button type="button" className="welcome-banner-close" onClick={fecharBoasVindas}><X size={16} /></button>
        </div>
      )}

      <div className="meta-hero">
        <div className="meta-hero-top">
          <div className="meta-label"><Target size={15} /> Meta da loja — mês atual</div>
          {editandoMetaLoja ? (
            <div className="meta-hero-top-actions">
              <input
                autoFocus
                className="meta-input"
                value={metaLojaInput}
                onChange={e => setMetaLojaInput(e.target.value)}
                placeholder="1800000"
              />
              <button type="button" className="meta-set-btn" disabled={salvandoMetaLoja} onClick={handleSalvarMetaLoja}>
                <Check size={13} /> {salvandoMetaLoja ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" className="meta-set-btn" onClick={() => setEditandoMetaLoja(false)}><X size={13} /></button>
            </div>
          ) : (
            <button
              type="button"
              className="meta-set-btn"
              onClick={() => { setMetaLojaInput(metaLoja ? String(metaLoja) : ''); setEditandoMetaLoja(true); }}
            >
              <Pencil size={12} /> {metaLoja ? 'Editar' : 'Definir meta'}
            </button>
          )}
        </div>
        {metaLoja ? (
          <>
            <div className="meta-pct-big mono">{totais.pctMetaLoja !== null ? `${Math.round(totais.pctMetaLoja)}%` : '—'}</div>
            <div className="meta-track-big">
              <div className="meta-fill-big" style={{ width: `${totais.pctMetaLoja ?? 0}%` }} />
            </div>
            <div className="meta-numbers mono">{formatBRL(totais.vendasMesTotal)} de {formatBRL(metaLoja)}</div>
          </>
        ) : (
          <div className="gerente-vendedor-vazio">Nenhuma meta da loja definida ainda.</div>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num mono">{formatBRL(totais.vendasMesTotal)}</div>
          <div className="stat-label"><TrendingUp size={12} /> Vendido no mês</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-num mono">{totais.metaTotal > 0 ? `${Math.min(100, Math.round((totais.vendasMesTotal / totais.metaTotal) * 100))}%` : '—'}</div>
          <div className="stat-label"><Target size={12} /> Da meta somada (individual)</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-num mono">{totais.atrasadosTotal}</div>
          <div className="stat-label"><AlertTriangle size={12} /> Atrasados</div>
        </div>
        <div className="stat-card">
          <div className="stat-num mono">{totais.prospectsTotal}</div>
          <div className="stat-label"><Users size={12} /> Prospects</div>
        </div>
      </div>

      <div className="gerente-ranking">
        <div className="gerente-ranking-title">Ranking de vendedores — mês atual</div>
        {vendedores.length === 0 ? (
          <div className="empty-state">
            <h3>Ninguém cadastrado ainda</h3>
            <p>Assim que os vendedores criarem a conta em /cadastro, eles aparecem aqui.</p>
          </div>
        ) : (
          vendedores.map((v, i) => (
            <div key={v.userId} className="gerente-vendedor-card">
              <button type="button" className="gerente-vendedor-header" onClick={() => setExpandido(e => (e === v.userId ? null : v.userId))}>
                <span className="gerente-vendedor-pos mono">{i + 1}º</span>
                <div className="gerente-vendedor-info">
                  <div className="gerente-vendedor-email">{v.nome}</div>
                  <div className="gerente-vendedor-sub mono">
                    {formatBRL(v.vendasMes)}{v.metaMensal ? ` de ${formatBRL(v.metaMensal)}` : ''}
                    {v.pctContribuicaoLoja !== null && ` · ${v.pctContribuicaoLoja.toFixed(1)}% da meta da loja`}
                    {v.atrasados > 0 && <span className="gerente-vendedor-alerta"> · {v.atrasados} atrasado{v.atrasados > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <ChevronDown size={16} style={{ transform: expandido === v.userId ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
              </button>
              {v.pctMeta !== null && (
                <div className="gerente-vendedor-track"><div className="gerente-vendedor-fill" style={{ width: `${v.pctMeta}%` }} /></div>
              )}
              {expandido === v.userId && (
                <div className="gerente-vendedor-clientes">
                  <div className="gerente-indicadores">
                    <div className="gerente-indicador">
                      <Target size={13} />
                      <span>{v.pctContribuicaoLoja !== null ? `${v.pctContribuicaoLoja.toFixed(1)}%` : '—'} da meta da loja</span>
                      <HelpTip label="% da meta da loja" text="Quanto esse vendedor já vendeu esse mês, dividido pela meta total da loja — mostra a fatia que ele contribuiu pro resultado geral." />
                    </div>
                    <div className="gerente-indicador">
                      <Users size={13} />
                      <span>{v.prospects} prospect{v.prospects !== 1 ? 's' : ''} ativo{v.prospects !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="gerente-indicador">
                      <Repeat size={13} />
                      <span>{v.conversoesMes} conversão{v.conversoesMes !== 1 ? 'ões' : ''} esse mês{v.taxaConversao !== null ? ` (${v.taxaConversao}% histórico)` : ''}</span>
                      <HelpTip label="Taxa de conversão histórica" text="De todos os prospects que esse vendedor já cadastrou (convertidos + ainda em aberto), qual porcentagem virou venda de fato." />
                    </div>
                    <div className="gerente-indicador">
                      <ClipboardList size={13} />
                      <span>{v.interacoesMes} interaç{v.interacoesMes !== 1 ? 'ões' : 'ão'} de pós-venda esse mês</span>
                    </div>
                    <div className={`gerente-indicador${v.followUpsVencidos > 0 ? ' alerta' : ''}`}>
                      <PhoneOff size={13} />
                      <span>{v.followUpsVencidos} follow-up{v.followUpsVencidos !== 1 ? 's' : ''} vencido{v.followUpsVencidos !== 1 ? 's' : ''}</span>
                    </div>
                    {v.diasMetaBatida !== null && (
                      <div className="gerente-indicador">
                        <Trophy size={13} />
                        <span>Bateu a meta em {v.diasMetaBatida} dia{v.diasMetaBatida !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {v.pctMeta !== null && v.diasMetaBatida === null && (
                      <div className={`gerente-indicador${v.pctMeta < v.pctEsperadoPeloTempo ? ' alerta' : ''}`}>
                        <TrendingUp size={13} />
                        <span>
                          {Math.round(v.pctMeta)}% da meta · esperado {Math.round(v.pctEsperadoPeloTempo)}% (proporcional aos dias do mês)
                        </span>
                      </div>
                    )}
                  </div>

                  {v.produtosMaisVendidos.length > 0 && (
                    <div className="gerente-subsecao">
                      <div className="gerente-subsecao-titulo">Produtos mais vendidos</div>
                      <div className="gerente-indicadores">
                        {v.produtosMaisVendidos.map(p => (
                          <div key={p.nome} className="gerente-indicador">
                            <span>{p.nome} · {p.qtd}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="gerente-subsecao">
                    <div className="gerente-subsecao-titulo">Clientes por status</div>
                    <div className="gerente-indicadores">
                      {STATUS_ORDER.filter(s => v.statusBreakdown[s] > 0).map(s => (
                        <div key={s} className="gerente-indicador">
                          <span>{STATUS[s]?.label || s} · {v.statusBreakdown[s]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {v.clientes.length === 0 ? (
                    <div className="gerente-vendedor-vazio">Ainda sem clientes cadastrados.</div>
                  ) : (
                    v.clientes
                      .slice()
                      .sort((a, b) => (b.data_compra || '').localeCompare(a.data_compra || ''))
                      .map(c => (
                        <div key={c.id} className="gerente-cliente-row">
                          <span className="gerente-cliente-nome">{c.nome}</span>
                          <span className="gerente-cliente-status">{STATUS[c.status]?.label || c.status}</span>
                          <span className="gerente-cliente-valor mono">{formatBRL(c.valor_total)}</span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="gerente-ranking">
        <button type="button" className="tendencia-header tendencia-header-toggle" onClick={() => setUsuariosOpen(o => !o)}>
          <div className="gerente-ranking-title" style={{ marginBottom: 0 }}>Usuários com acesso ({usuarios.length})</div>
          <ChevronDown size={16} style={{ transform: usuariosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
        </button>
        {usuariosOpen && (
          <div style={{ marginTop: 10 }}>
            {usuarios.length === 0 ? (
              <div className="gerente-vendedor-vazio">Nenhum usuário encontrado.</div>
            ) : (
              usuarios.map(u => (
                <div key={u.user_id} className="usuario-row">
                  <div className="usuario-info">
                    <span className="usuario-email">{u.nome || u.email || '(sem nome)'}</span>
                    <span className={`usuario-badge ${u.role}`}>{u.role === 'gerente' ? 'Gerente' : 'Vendedor'}</span>
                    <span className={`usuario-badge ${u.ativo ? 'ativo' : 'inativo'}`}>{u.ativo ? 'Ativo' : 'Desativado'}</span>
                  </div>
                  <div className="usuario-actions">
                    <select
                      className="usuario-select"
                      value={destinoTransferencia[u.user_id] || ''}
                      onChange={e => setDestinoTransferencia(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                    >
                      <option value="">Transferir carteira pra...</option>
                      {usuarios.filter(o => o.user_id !== u.user_id).map(o => (
                        <option key={o.user_id} value={o.user_id}>{o.nome || o.email}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="usuario-btn"
                      disabled={!destinoTransferencia[u.user_id]}
                      onClick={() => pedirTransferencia(u.user_id)}
                    >
                      Transferir
                    </button>
                    <button type="button" className="usuario-btn" onClick={() => pedirAlteracaoUsuario(u, { role: u.role === 'gerente' ? 'vendedor' : 'gerente' })}>
                      {u.role === 'gerente' ? 'Rebaixar a vendedor' : 'Promover a gerente'}
                    </button>
                    <button type="button" className={`usuario-btn ${u.ativo ? 'perigo' : ''}`} onClick={() => pedirAlteracaoUsuario(u, { ativo: !u.ativo })}>
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmTransferir}
        title="Transferir carteira?"
        message={
          confirmTransferir && (
            <>
              Move <strong>{confirmTransferir.qtd} cliente{confirmTransferir.qtd !== 1 ? 's' : ''}</strong> de{' '}
              <strong>{confirmTransferir.deNome}</strong> pra <strong>{confirmTransferir.paraNome}</strong>. Essa ação não pode ser desfeita.
            </>
          )
        }
        confirmLabel="Transferir"
        danger
        loading={transferindoConfirmado}
        typeToConfirm={confirmTransferir?.deNome}
        onConfirm={confirmarTransferencia}
        onCancel={() => setConfirmTransferir(null)}
      />

      <ConfirmModal
        open={!!confirmUsuario}
        title={confirmUsuario?.titulo || ''}
        message={confirmUsuario?.mensagem || ''}
        confirmLabel="Confirmar"
        danger={confirmUsuario?.danger}
        loading={alterandoConfirmado}
        onConfirm={confirmarAlteracaoUsuario}
        onCancel={() => setConfirmUsuario(null)}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
