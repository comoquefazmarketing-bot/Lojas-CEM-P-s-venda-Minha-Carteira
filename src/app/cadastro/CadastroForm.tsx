'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function CadastroForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (senha !== confirmar) {
      setError('As senhas não são iguais.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, codigo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Não consegui criar a conta agora.');
        return;
      }
      setSucesso(true);
    } catch {
      setError('Não consegui me conectar. Confere sua internet e tenta de novo.');
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="auth-logo" />
          <div className="auth-eyebrow">Lojas CEM · Pós-venda</div>
          <h1 className="auth-title">Conta criada! 🎉</h1>
          <p className="auth-sucesso-texto">Já pode entrar com o email e a senha que você cadastrou.</p>
          <button className="auth-btn ripple-host" onClick={(e) => { ripple(e); router.push('/login'); }}>
            Ir pro login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="auth-logo" />
        <div className="auth-eyebrow">Lojas CEM · Pós-venda</div>
        <h1 className="auth-title">Criar conta</h1>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="auth-field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </div>
          <div className="auth-field">
            <label>Confirmar senha</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
          </div>
          <div className="auth-field">
            <label>Código de convite</label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required placeholder="peça pro seu gerente" />
          </div>
          <button className="auth-btn ripple-host" type="submit" disabled={loading} onClick={ripple}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
        <button type="button" className="auth-link-btn" onClick={() => router.push('/login')}>
          Já tenho conta — entrar
        </button>
      </div>
    </div>
  );
}
