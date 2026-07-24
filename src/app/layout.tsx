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

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('cem-theme');
    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
