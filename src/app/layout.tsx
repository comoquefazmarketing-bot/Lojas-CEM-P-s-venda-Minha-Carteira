import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carteira de Clientes — CEM',
  description: 'Controle pessoal de pós-venda e acompanhamento de clientes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
