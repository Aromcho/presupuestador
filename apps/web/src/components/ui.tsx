'use client';

import Link from 'next/link';
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icono, type IconoNombre } from './Icono';
import { Llama } from './Llama';

type Variante = 'rojo' | 'contorno' | 'suave' | 'wa' | 'texto';

const VARIANTES: Record<Variante, string> = {
  rojo: 'bg-rojo text-white border-rojo hover:bg-rojo-hover hover:border-rojo-hover',
  contorno: 'bg-transparent text-white border-linea hover:border-celeste/50 hover:bg-white/5',
  suave: 'bg-marino-2 text-white border-linea hover:border-celeste/40',
  wa: 'bg-whatsapp text-[#03190b] border-whatsapp hover:brightness-110',
  texto: 'bg-transparent border-transparent text-celeste hover:text-white px-2',
};

const base = (v: Variante, grande?: boolean) =>
  cn(
    'inline-flex items-center justify-center gap-2.5 rounded-full border font-bold whitespace-nowrap transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    grande ? 'min-h-14 px-6 text-lg' : 'min-h-11 px-[1.1rem] text-[0.95rem]',
    VARIANTES[v],
  );

export function Boton({
  variante = 'rojo',
  icono,
  grande,
  cargando,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icono?: IconoNombre; grande?: boolean; cargando?: boolean }) {
  return (
    <button type="button" className={cn(base(variante, grande), className)} disabled={cargando || rest.disabled} {...rest}>
      {cargando ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : icono && <Icono nombre={icono} className={grande ? 'size-5' : 'size-[1.1rem]'} />}
      {children}
    </button>
  );
}

export function BotonLink({ href, variante = 'rojo', icono, grande, className, children }: { href: string; variante?: Variante; icono?: IconoNombre; grande?: boolean; className?: string; children: ReactNode }) {
  const inner = (
    <>
      {icono && <Icono nombre={icono} className={grande ? 'size-5' : 'size-[1.1rem]'} />}
      {children}
    </>
  );
  // Las descargas (Excel) van con <a> común para que el navegador baje el archivo
  if (href.startsWith('/api/'))
    return (
      <a href={href} download className={cn(base(variante, grande), className)}>
        {inner}
      </a>
    );
  return (
    <Link href={href} className={cn(base(variante, grande), className)}>
      {inner}
    </Link>
  );
}

export function IconoBoton({ icono, etiqueta, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icono: IconoNombre; etiqueta: string }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} className={cn('grid size-10 place-items-center rounded-xl text-celeste transition hover:bg-white/5 hover:text-white', className)} {...rest}>
      <Icono nombre={icono} className="size-[1.15rem]" />
    </button>
  );
}

/** Chip seleccionable, el mismo de "Pedí tu service" */
export function Chip({ activo, icono, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { activo?: boolean; icono?: IconoNombre }) {
  return (
    <button
      type="button"
      aria-pressed={!!activo}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-[0.95rem] leading-tight transition-all active:scale-[0.98]',
        activo ? 'border-rojo bg-rojo/15 text-white shadow-[0_0_0_1px_var(--color-rojo)]' : 'border-linea bg-marino-2/60 text-celeste hover:border-celeste/50 hover:text-white',
        className,
      )}
      {...rest}
    >
      {icono && <Icono nombre={icono} className="size-[1.1rem]" />}
      {children}
    </button>
  );
}

export function Etiqueta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('etiqueta text-celeste', className)}>{children}</p>;
}

export function Cabecera({ etiqueta, titulo, bajada, acciones, volver }: { etiqueta?: string; titulo: ReactNode; bajada?: ReactNode; acciones?: ReactNode; volver?: { href: string; texto: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2.5">
        {volver && (
          <Link href={volver.href} className="inline-flex items-center gap-1.5 text-sm text-celeste hover:text-white">
            <Icono nombre="atras" className="size-4" />
            {volver.texto}
          </Link>
        )}
        {etiqueta && <Etiqueta>{etiqueta}</Etiqueta>}
        <h1 className="titular text-[2.1rem] sm:text-4xl md:text-5xl">{titulo}</h1>
        {bajada && <p className="max-w-2xl text-base text-celeste md:text-[1.05rem]">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2.5">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl border border-linea bg-marino p-5 md:p-6', className)}>{children}</section>;
}

const campoCls = 'min-h-11 w-full rounded-xl border border-linea bg-noche px-3.5 text-[0.95rem] text-white placeholder:text-humo outline-none transition focus:border-azul';

export function Campo({ etiqueta, ayuda, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="etiqueta text-humo">{etiqueta}</span>
      <input className={cn(campoCls, rest.type === 'number' && 'tabular')} {...rest} />
      {ayuda && <span className="text-xs text-humo">{ayuda}</span>}
    </label>
  );
}

export function Selector({ etiqueta, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="etiqueta text-humo">{etiqueta}</span>
      <select className={cn(campoCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9')} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23B9C8F0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function Area({ etiqueta, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="etiqueta text-humo">{etiqueta}</span>
      <textarea className={cn(campoCls, 'min-h-24 py-2.5 leading-relaxed')} {...rest} />
    </label>
  );
}

export function Interruptor({ activo, onCambio, etiqueta, ayuda }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; ayuda?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input type="checkbox" className="peer sr-only" checked={activo} onChange={(e) => onCambio(e.target.checked)} />
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full border transition peer-focus-visible:outline-2 peer-focus-visible:outline-celeste', activo ? 'border-azul bg-azul' : 'border-linea-2 bg-noche')}>
        <span className={cn('absolute top-0.5 size-[1.15rem] rounded-full bg-white transition-all', activo ? 'left-[1.3rem]' : 'left-0.5')} />
      </span>
      <span className="flex flex-col">
        <span className="text-[0.95rem] text-white">{etiqueta}</span>
        {ayuda && <span className="text-xs text-humo">{ayuda}</span>}
      </span>
    </label>
  );
}

/** Hoja modal (abajo en el celular, centrada en la compu), como "Pedí tu service" */
export function Hoja({ abierta, onCerrar, titulo, etiqueta, children, pie, ancha }: { abierta: boolean; onCerrar: () => void; titulo: string; etiqueta?: string; children: ReactNode; pie?: ReactNode; ancha?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      className={cn('hoja m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-linea bg-marino p-0 text-white sm:m-auto sm:rounded-3xl', ancha ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
    >
      <div className="flex max-h-[94dvh] flex-col">
        <div className="flex items-start gap-3 border-b border-linea px-5 pb-4 pt-5">
          <Llama className="h-10 w-auto shrink-0" circulo={false} modo="viva" />
          <div className="min-w-0 flex-1">
            {etiqueta && <p className="etiqueta text-celeste">{etiqueta}</p>}
            <h2 className="titular-medio mt-1 text-2xl">{titulo}</h2>
          </div>
          <IconoBoton icono="cerrar" etiqueta="Cerrar" onClick={onCerrar} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2.5 border-t border-linea bg-marino px-5 py-4">{pie}</div>}
      </div>
    </dialog>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-celeste" role="status">
      <Llama className="h-9 w-auto" circulo={false} modo="viva" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ icono = 'buscar', titulo, texto, accion }: { icono?: IconoNombre; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-linea-2 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-marino-2 text-celeste">
        <Icono nombre={icono} className="size-6" />
      </span>
      <p className="titular-medio text-xl">{titulo}</p>
      {texto && <p className="max-w-md text-sm text-celeste">{texto}</p>}
      {accion}
    </div>
  );
}

export function Pastilla({ children, tono = 'gris' }: { children: ReactNode; tono?: 'gris' | 'azul' | 'verde' | 'rojo' }) {
  const t = {
    gris: 'bg-humo/15 text-[#c3cee9]',
    azul: 'bg-azul/20 text-info',
    verde: 'bg-whatsapp/15 text-ok',
    rojo: 'bg-bordo/40 text-alerta',
  }[tono];
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', t)}>{children}</span>;
}
