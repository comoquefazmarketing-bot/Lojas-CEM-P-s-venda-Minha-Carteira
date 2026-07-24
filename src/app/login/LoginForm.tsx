'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email ou senha incorretos.');
      return;
    }
    router.push('/carteira');
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img src="/logo-lojas-cem.png" alt="Lojas CEM" className="auth-logo" />
        <div className="auth-eyebrow">Lojas CEM · Pós-venda</div>
        <h1 className="auth-title">Minha Carteira</h1>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn ripple-host" type="submit" disabled={loading} onClick={ripple}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <button type="button" className="auth-link-btn" onClick={() => router.push('/cadastro')}>
          Ainda não tem conta? Criar conta
        </button>
      </div>
    </div>
  );
}
