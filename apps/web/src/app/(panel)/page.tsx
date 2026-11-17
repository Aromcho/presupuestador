'use client';

import Link from 'next/link';
import { Icono, type IconoNombre } from '@/components/Icono';
import { Llama } from '@/components/Llama';
import { BotonLink, Etiqueta, Tarjeta } from '@/components/ui';
import { useApi, useDolar, useMe } from '@/lib/api';
import { fechaHora, pesos, TIPOS } from '@/lib/format';
import type { ItemType, Template } from '@/lib/types';

const saludo = () => {
  const h = Number(new Date().toLocaleString('es-AR', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }));
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};

export default function Inicio() {
  const me = useMe();
  const dolar = useDolar();
  const plantillas = useApi<Template[]>(['templates'], '/templates');
  const stats = useApi<Partial<Record<ItemType, number>>>(['items', 'stats'], '/items/stats');
  const admin = me.data?.role === 'ADMIN';
  const nombre = me.data?.name.split(' ')[0] ?? '';
  const totalItems = Object.values(stats.data ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <Etiqueta>Presupuestador</Etiqueta>
        <h1 className="titular text-5xl md:text-6xl">
          {saludo()}, <span className="degrade-llama">{nombre}.</span>
        </h1>
      </div>

      <section aria-labelledby="nuevo-t" className="relative flex flex-wrap gap-7 overflow-hidden rounded-3xl border border-linea bg-marino p-6 md:p-7">
        <Llama className="pointer-events-none absolute -right-8 -top-6 h-56 w-auto opacity-15" circulo={false} />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col justify-center gap-3.5">
          <h2 id="nuevo-t" className="titular-medio text-3xl">
            Nuevo presupuesto
          </h2>
          <p className="max-w-sm text-celeste">Elegí una plantilla: los equipos, lo que incluye y las aclaraciones ya vienen cargados.</p>
          <div>
            <BotonLink href="/presupuestos/nuevo" icono="mas" grande>
              Empezar
            </BotonLink>
          </div>
        </div>
        <div className="grid flex-[2_1_420px] grid-cols-1 content-center gap-2.5 sm:grid-cols-2">
          {(plantillas.data ?? []).filter((t) => t.active).slice(0, 6).map((t) => (
            <Link
              key={t.id}
              href={`/presupuestos/nuevo?plantilla=${t.slug}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-linea bg-marino-2/60 px-4 font-semibold transition hover:border-celeste/50"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
                <Icono nombre={t.icon as IconoNombre} className="size-[1.1rem]" />
              </span>
              {t.name}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Tarjeta className="flex flex-col gap-2">
          <Etiqueta className="text-humo">Dólar {dolar.data?.modo === 'manual' ? '(cargado a mano)' : 'BNA venta'}</Etiqueta>
          <p className="titular tabular text-4xl">{pesos(dolar.data?.venta)}</p>
          <p className="text-sm text-celeste">{dolar.data?.fecha ? `Actualizado ${fechaHora(dolar.data.fecha)}` : 'Todavía no hay cotización.'}</p>
          {admin && (
            <Link href="/admin/empresa" className="mt-1 text-sm text-celeste underline-offset-4 hover:text-white hover:underline">
              Ajustar el dólar
            </Link>
          )}
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-2">
          <Etiqueta className="text-humo">Catálogo</Etiqueta>
          <p className="titular tabular text-4xl">{totalItems}</p>
          <p className="text-sm text-celeste">
            {Object.entries(stats.data ?? {})
              .map(([k, v]) => `${v} ${TIPOS[k as ItemType].toLowerCase()}${v === 1 ? '' : 's'}`)
              .join(' · ') || 'Cargá tu primera lista de precios.'}
          </p>
          <Link href="/catalogo" className="mt-1 text-sm text-celeste underline-offset-4 hover:text-white hover:underline">
            Buscar por código o nombre
          </Link>
        </Tarjeta>
        {admin ? (
          <Tarjeta className="flex flex-col gap-3">
            <Etiqueta className="text-humo">Listas de precios</Etiqueta>
            <p className="text-sm text-celeste">Subí el Excel de cada firma y los precios quedan al día.</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <BotonLink href="/admin/listas?importar=1" variante="suave" icono="subir">
                Importar lista
              </BotonLink>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta className="flex flex-col gap-2">
            <Etiqueta className="text-humo">Ayuda</Etiqueta>
            <p className="text-sm text-celeste">Si un precio no está o te parece raro, avisale a Leo: él maneja las listas.</p>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
