import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Permite compilar en otra carpeta (NEXT_DIST_DIR=.next-new) sin pisar la que está sirviendo producción
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // La API (NestJS) y las fotos subidas se sirven bajo el mismo dominio
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
      // Link público del presupuesto que recibe el cliente por WhatsApp
      { source: '/p/:token', destination: `${API_URL}/api/p/:token` },
      // …que redirige a una URL con el nombre del archivo (así se comparte como "Presupuesto-Gesetec-Cliente.pdf")
      { source: '/p/:token/:archivo', destination: `${API_URL}/api/p/:token/:archivo` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
