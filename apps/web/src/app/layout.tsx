import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

// Archivo variable (peso 100–900 y ancho 62–125%), la misma de gesetecalderas.com
const archivo = localFont({
  src: './fonts/archivo-latin-wdth.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  preload: true,
});

export const metadata: Metadata = {
  title: { default: 'Presupuestador · Gesetec Calderas', template: '%s · Presupuestador Gesetec' },
  robots: { index: false, follow: false },
  icons: { icon: '/brand/gesetec-llama.svg' },
};

export const viewport: Viewport = {
  themeColor: '#040B1D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={archivo.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
