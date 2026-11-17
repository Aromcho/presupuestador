'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Icono } from '@/components/Icono';
import { FilaPresupuesto } from '@/components/FilaPresupuesto';
import { BotonLink, Cabecera, Cargando, Chip, Vacio } from '@/components/ui';
import { useApi, useMe } from '@/lib/api';
import type { Paged, QuoteRow, QuoteStatus } from '@/lib/types';

const FILTROS: { id: QuoteStatus | 'SEGUIR' | ''; texto: string }[] = [
  { id: '', texto: 'Todos' },
  { id: 'BORRADOR', texto: 'Borradores' },
  { id: 'SEGUIR', texto: 'Sin respuesta' },
  { id: 'ACEPTADO', texto: 'Aceptados' },
  { id: 'RECHAZADO', texto: 'Rechazados' },
  { id: 'VENCIDO', texto: 'Vencidos' },
];

function useDebounce<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Lista() {
  const params = useSearchParams();
  const me = useMe();
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<string>(params.get('estado') ?? '');
  const [limite, setLimite] = useState(30);
  const qd = useDebounce(q);
  const query = new URLSearchParams({ limit: String(limite), ...(qd && { q: qd }), ...(estado && { status: estado }) });
  const res = useApi<Paged<QuoteRow>>(['quotes', query.toString()], `/quotes?${query}`);

  return (
    <>
      <Cabecera
        etiqueta="Presupuestos"
        titulo="Presupuestos"
        bajada="Todo lo que armaron, con su estado. Tocá uno para mandarlo, editarlo o duplicarlo."
        acciones={
          <>
            {me.data?.role === 'ADMIN' && (
              <BotonLink href="/api/admin/excel/export/presupuestos.xlsx" variante="contorno" icono="excel">
                Excel
              </BotonLink>
            )}
            <BotonLink href="/presupuestos/nuevo" icono="mas">
              Nuevo presupuesto
            </BotonLink>
          </>
        }
      />
      <div className="flex flex-col gap-3">
        <label className="flex min-h-13 items-center gap-3 rounded-2xl border border-linea bg-marino px-4 text-humo focus-within:border-azul">
          <Icono nombre="buscar" />
          <span className="sr-only">Buscar presupuestos</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, teléfono, zona o número" className="min-w-0 flex-1 bg-transparent py-3 text-[1.05rem] text-white outline-none placeholder:text-humo focus-visible:outline-none" />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Chip key={f.id} activo={estado === f.id} onClick={() => setEstado(f.id)}>
              {f.texto}
            </Chip>
          ))}
        </div>
      </div>
      {!res.data ? (
        <Cargando />
      ) : res.data.items.length === 0 ? (
        <Vacio
          icono="doc"
          titulo={qd || estado ? 'No hay presupuestos con ese filtro' : 'Todavía no hay presupuestos'}
          texto={qd || estado ? 'Probá con otra búsqueda.' : 'Armá el primero: elegís la plantilla, el cliente y los equipos, y lo mandás por WhatsApp.'}
          accion={!qd && !estado ? <BotonLink href="/presupuestos/nuevo" icono="mas">Nuevo presupuesto</BotonLink> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {res.data.items.map((r) => (
            <FilaPresupuesto key={r.id} r={r} />
          ))}
          {res.data.total > res.data.items.length && (
            <button type="button" onClick={() => setLimite((l) => l + 30)} className="self-center py-3 text-celeste hover:text-white">
              Ver más ({res.data.total - res.data.items.length})
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default function PresupuestosPage() {
  return (
    <Suspense>
      <Lista />
    </Suspense>
  );
}
