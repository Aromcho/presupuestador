'use client';

import Link from 'next/link';
import { Icono, type IconoNombre } from '@/components/Icono';
import { Llama } from '@/components/Llama';
import { BotonLink, Etiqueta } from '@/components/ui';
import { MODULOS } from '@/lib/modulos';

export default function Administracion() {
  const activos = MODULOS.filter((m) => m.estado === 'activo');
  const futuros = MODULOS.filter((m) => m.estado === 'proximamente');
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-bordo/40 px-3 py-1.5 text-sm font-semibold text-alerta">
            <Icono nombre="escudo" className="size-4" />
            Solo administradores
          </span>
          <h1 className="titular text-[2.1rem] sm:text-5xl">Administración</h1>
          <p className="text-celeste md:text-[1.05rem]">Precios, plantillas, usuarios y el dólar: lo que hace que cada presupuesto salga solo y bien.</p>
        </div>
        <Llama className="hidden h-24 w-auto md:block" modo="viva" />
      </div>

      <div className="flex flex-wrap gap-2.5">
        <BotonLink href="/admin/listas?importar=1" icono="subir">
          Importar lista de precios
        </BotonLink>
        <BotonLink href="/api/admin/excel/export/catalogo.xlsx" variante="contorno" icono="excel">
          Exportar catálogo a Excel
        </BotonLink>
        <BotonLink href="/api/admin/excel/export/presupuestos.xlsx" variante="contorno" icono="excel">
          Exportar presupuestos
        </BotonLink>
        <BotonLink href="/api/admin/excel/export/clientes.xlsx" variante="contorno" icono="excel">
          Exportar clientes
        </BotonLink>
        <BotonLink href="/catalogo?aumento=1" variante="contorno" icono="porcentaje">
          Actualizar precios por %
        </BotonLink>
      </div>

      <section aria-labelledby="mod-t" className="flex flex-col gap-4">
        <h2 id="mod-t" className="titular-medio text-2xl">
          Módulos
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((m) => (
            <Link key={m.id} href={m.ruta!} className="flex min-h-44 flex-col gap-3.5 rounded-2xl border border-linea bg-marino p-5 transition hover:border-celeste/40">
              <span className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl border border-linea bg-noche text-celeste">
                  <Icono nombre={m.icono as IconoNombre} className="size-[1.3rem]" />
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok">
                  <span className="size-1.5 rounded-full bg-ok" />
                  Activo
                </span>
              </span>
              <span className="titular-medio text-lg">{m.nombre}</span>
              <span className="text-sm leading-relaxed text-celeste">{m.descripcion}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="fut-t" className="flex flex-col gap-4">
        <div>
          <h2 id="fut-t" className="titular-medio text-2xl">
            Próximamente
          </h2>
          <p className="mt-1.5 max-w-2xl text-celeste">El sistema está preparado para sumar módulos sin tocar lo que ya funciona.</p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {futuros.map((m) => (
            <div key={m.id} className="flex min-h-40 flex-col gap-3 rounded-2xl border border-dashed border-linea-2 bg-marino/40 p-5">
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl border border-dashed border-linea-2 text-humo">
                  <Icono nombre={m.icono as IconoNombre} className="size-5" />
                </span>
                <Etiqueta className="text-[0.68rem] text-humo">Próximamente</Etiqueta>
              </span>
              <span className="titular-medio text-[1.05rem] text-[#dce4f7]">{m.nombre}</span>
              <span className="text-sm leading-relaxed text-humo">{m.descripcion}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
