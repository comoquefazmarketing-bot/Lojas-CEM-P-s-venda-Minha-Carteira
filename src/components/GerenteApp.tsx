'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, TrendingUp, AlertTriangle, Target, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Cliente, STATUS } from '@/types';

function formatBRL(v: number | null | undefined) {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function monthKey(iso: string) { return iso.slice(0, 7); }
function todayIso() { return new Date().toISOString().slice(0, 10); }

type Profile = { user_id: string; email: string | null; role: string };
type Configuracao = { user_id: string; meta_mensal: number | null };

type VendedorResumo = {
  userId: string;
  email: string;
  clientes: Cliente[];
  metaMensal: number | null;
  vendasMes: number;
  atrasados: number;
  prospects: number;
  pctMeta: number | null;
};

export default function GerenteApp({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: c }, { data: p }, { data: cfg }] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('profiles').select('user_id, email, role'),
        supabase.from('configuracoes').select('user_id, meta_mensal'),
      ]);
      setClientes((c as Cliente[]) ?? []);
      setProfiles((p as Profile[]) ?? []);
      setConfigs((cfg as Configuracao[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const vendedores: VendedorResumo[] = useMemo(() => {
    const mesAtual = monthKey(todayIso());
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
        return {
          userId: p.user_id,
          email: p.email || '(sem email)',
          clientes: clientesDoVendedor,
          metaMensal,
          vendasMes,
          atrasados,
          prospects,
          pctMeta,
        };
      })
      .sort((a, b) => b.vendasMes - a.vendasMes);
  }, [clientes, profiles, configs]);

  const totais = useMemo(() => {
    const vendasMesTotal = vendedores.reduce((s, v) => s + v.vendasMes, 0);
    const atrasadosTotal = vendedores.reduce((s, v) => s + v.atrasados, 0);
    const prospectsTotal = vendedores.reduce((s, v) => s + v.prospects, 0);
    const metaTotal = vendedores.reduce((s, v) => s + (v.metaMensal || 0), 0);
    return { vendasMesTotal, atrasadosTotal, prospectsTotal, metaTotal, qtdVendedores: vendedores.length };
  }, [vendedores]);

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
          <div className="subtitle">{userEmail} · {totais.qtdVendedores} vendedor{totais.qtdVendedores !== 1 ? 'es' : ''}</div>
        </div>
        <div className="header-actions">
          <button className="logout-btn" onClick={handleLogout}><LogOut size={13} /> Sair</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num mono">{formatBRL(totais.vendasMesTotal)}</div>
          <div className="stat-label"><TrendingUp size={12} /> Vendido no mês</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-num mono">{totais.metaTotal > 0 ? `${Math.min(100, Math.round((totais.vendasMesTotal / totais.metaTotal) * 100))}%` : '—'}</div>
          <div className="stat-label"><Target size={12} /> Da meta somada</div>
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
                  <div className="gerente-vendedor-email">{v.email}</div>
                  <div className="gerente-vendedor-sub mono">
                    {formatBRL(v.vendasMes)}{v.metaMensal ? ` de ${formatBRL(v.metaMensal)}` : ''}
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
    </div>
  );
}
