'use client';

import { Cabecera, Cargando, Vacio } from '@/components/ui';
import { useApi } from '@/lib/api';
import { fechaHora } from '@/lib/format';
import type { Activity } from '@/lib/types';

export default function Actividad() {
  const lista = useApi<Activity[]>(['activity'], '/admin/activity?limit=200');
  return (
    <>
      <Cabecera volver={{ href: '/admin', texto: 'Administración' }} etiqueta="Registro de actividad" titulo="Actividad" bajada="Quién cambió precios, importó listas, tocó el dólar o editó usuarios." />
      {lista.isLoading ? (
        <Cargando />
      ) : !lista.data?.length ? (
        <Vacio icono="historial" titulo="Todavía no hay movimientos" />
      ) : (
        <ul className="flex flex-col divide-y divide-linea rounded-2xl border border-linea bg-marino">
          {lista.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
              <span>{a.summary}</span>
              <span className="tabular text-sm text-humo">{fechaHora(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
