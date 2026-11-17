'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Icono, type IconoNombre } from '@/components/Icono';
import { BotonLink, Cabecera, Tarjeta } from '@/components/ui';
import { useApi } from '@/lib/api';
import type { Template } from '@/lib/types';

function Nuevo() {
  const params = useSearchParams();
  const plantillas = useApi<Template[]>(['templates'], '/templates');
  const elegida = plantillas.data?.find((t) => t.slug === params.get('plantilla'));

  return (
    <>
      <Cabecera
        volver={{ href: '/', texto: 'Inicio' }}
        etiqueta="Paso 1 de 3 · Plantilla"
        titulo="Nuevo presupuesto"
        bajada="El armado en 3 pasos (cliente, equipos y enviar por WhatsApp) llega en la próxima entrega. Las plantillas, el catálogo y los precios ya están funcionando."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(plantillas.data ?? []).filter((t) => t.active).map((t) => {
          const on = elegida?.id === t.id;
          return (
            <Tarjeta key={t.id} className={on ? 'border-rojo shadow-[0_0_0_1px_var(--color-rojo)]' : ''}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-noche text-celeste">
                  <Icono nombre={t.icon as IconoNombre} />
                </span>
                <div>
                  <p className="titular-medio text-lg">{t.name}</p>
                  <p className="text-sm text-humo">{t.mode === 'COMPARATIVA' ? 'Comparativa de opciones' : 'Una opción'}</p>
                </div>
              </div>
              {t.items.length > 0 && <p className="mt-4 text-sm text-celeste">{t.items.map((i) => i.item.name).join(' · ')}</p>}
              {t.seIncluye.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {t.seIncluye.map((s) => (
                    <li key={s} className="flex gap-2">
                      <Icono nombre="check" className="mt-0.5 size-4 shrink-0 text-info" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          );
        })}
      </div>
      <div>
        <BotonLink href="/catalogo" variante="contorno" icono="buscar">
          Buscar precios en el catálogo
        </BotonLink>
      </div>
    </>
  );
}

export default function NuevoPage() {
  return (
    <Suspense>
      <Nuevo />
    </Suspense>
  );
}
