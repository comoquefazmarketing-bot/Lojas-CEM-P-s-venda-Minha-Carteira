import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carteira de Clientes — CEM',
  description: 'Controle pessoal de pós-venda e acompanhamento de clientes',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#23283A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
