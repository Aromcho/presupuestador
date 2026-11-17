'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useDolar, useMe } from '@/lib/api';
import { post } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { fechaHora, pesos } from '@/lib/format';
import { Icono, type IconoNombre } from './Icono';
import { Cargando } from './ui';

type Nav = { href: string; texto: string; icono: IconoNombre; admin?: boolean };
const NAV: Nav[] = [
  { href: '/', texto: 'Inicio', icono: 'inicio' },
  { href: '/presupuestos/nuevo', texto: 'Presupuestos', icono: 'doc' },
  { href: '/catalogo', texto: 'Catálogo', icono: 'etiqueta' },
  { href: '/admin', texto: 'Administración', icono: 'ajustes', admin: true },
];

const activo = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

/** Dólar BNA venta del momento, visible en todo el panel */
export function DolarChip({ className }: { className?: string }) {
  const { data } = useDolar();
  if (!data) return null;
  const sin = data.venta == null;
  return (
    <span
      className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', sin ? 'border-bordo/60 text-alerta' : 'border-linea text-celeste', className)}
      title={data.fecha ? `Actualizado ${fechaHora(data.fecha)}` : undefined}
    >
      <Icono nombre="dolar" className="size-4" />
      {sin ? 'Sin dólar cargado' : (
        <>
          <span className="tabular font-semibold text-white">{pesos(data.venta)}</span>
          <span className="hidden xl:inline">{data.modo === 'manual' ? 'a mano' : 'BNA venta'}</span>
        </>
      )}
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();

  useEffect(() => {
    if (me.isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isError, pathname, router]);

  if (me.isLoading || !me.data) return <Cargando texto="Abriendo el presupuestador…" />;
  const admin = me.data.role === 'ADMIN';
  const nav = NAV.filter((n) => !n.admin || admin);

  const salir = async () => {
    await post('/auth/logout').catch(() => undefined);
    qc.clear();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-svh flex-wrap">
      {/* Menú lateral (compu) */}
      <aside className="hidden w-64 shrink-0 flex-col gap-7 border-r border-linea bg-marino px-4 py-6 lg:flex">
        <Link href="/" className="px-2" aria-label="Inicio">
          <img src="/brand/gesetec-logo.svg" alt="Gesetec Calderas" className="h-11 w-auto" />
        </Link>
        <Link href="/presupuestos/nuevo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rojo px-4 font-bold transition hover:bg-rojo-hover">
          <Icono nombre="mas" className="size-[1.1rem]" />
          Nuevo presupuesto
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[0.95rem] transition',
                activo(pathname, n.href) ? 'bg-azul/20 font-bold text-white' : 'text-celeste hover:bg-white/5 hover:text-white',
              )}
            >
              <Icono nombre={n.icono} />
              {n.texto}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <DolarChip className="self-start" />
          <div className="flex items-center gap-3 rounded-2xl border border-linea bg-marino-2 p-3">
            <span className="titular-medio grid size-10 shrink-0 place-items-center rounded-full bg-noche">{me.data.name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{me.data.name}</p>
              <p className="text-xs text-humo">{admin ? 'Administrador' : 'Ventas'}</p>
            </div>
            <button type="button" onClick={salir} aria-label="Salir" title="Salir" className="grid size-10 place-items-center rounded-xl text-celeste hover:bg-white/5 hover:text-white">
              <Icono nombre="salir" className="size-[1.15rem]" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        {/* Barra superior (celular) */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-linea/70 bg-noche/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/" aria-label="Inicio" className="mr-auto">
            <img src="/brand/gesetec-logo.svg" alt="Gesetec Calderas" className="h-9 w-auto" />
          </Link>
          <DolarChip />
          <button type="button" onClick={salir} aria-label="Salir" className="grid size-11 place-items-center rounded-full border border-linea text-celeste">
            <Icono nombre="salir" className="size-[1.1rem]" />
          </button>
        </header>
        <main id="contenido" className="flex-1 px-4 pb-32 pt-6 md:px-8 lg:px-10 lg:pb-14 lg:pt-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">{children}</div>
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 flex items-start border-t border-linea bg-marino px-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {[NAV[0], NAV[1]].map((n) => (
          <Link key={n.href} href={n.href} className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem]', activo(pathname, n.href) ? 'font-bold text-white' : 'text-humo')}>
            <Icono nombre={n.icono} className="size-[1.4rem]" />
            {n.texto}
          </Link>
        ))}
        <Link href="/presupuestos/nuevo" aria-label="Nuevo presupuesto" className="flex flex-1 justify-center">
          <span className="-mt-7 grid size-[3.7rem] place-items-center rounded-full bg-rojo shadow-[0_10px_24px_rgba(227,50,42,.45),0_0_0_6px_var(--color-noche)]">
            <Icono nombre="mas" className="size-7" />
          </span>
        </Link>
        {(admin ? [NAV[2], NAV[3]] : [NAV[2]]).map((n) => (
          <Link key={n.href} href={n.href} className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem]', activo(pathname, n.href) ? 'font-bold text-white' : 'text-humo')}>
            <Icono nombre={n.icono} className="size-[1.4rem]" />
            {n.admin ? 'Admin' : n.texto}
          </Link>
        ))}
        {!admin && (
          <button type="button" onClick={salir} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] text-humo">
            <Icono nombre="salir" className="size-[1.4rem]" />
            Salir
          </button>
        )}
      </nav>
    </div>
  );
}
