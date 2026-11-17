'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icono } from '@/components/Icono';
import { BotonLink, Cabecera, Cargando, Vacio } from '@/components/ui';
import { useApi, useMe } from '@/lib/api';
import { fecha, waLink } from '@/lib/format';
import type { Client } from '@/lib/types';

function useDebounce<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function ClientesPage() {
  const me = useMe();
  const [q, setQ] = useState('');
  const qd = useDebounce(q);
  const res = useApi<Client[]>(['clients', qd], `/clients${qd ? `?q=${encodeURIComponent(qd)}` : ''}`);

  return (
    <>
      <Cabecera
        etiqueta="Clientes"
        titulo="Clientes"
        bajada="Se guardan solos cuando armás un presupuesto. Desde acá le escribís o le armás uno nuevo."
        acciones={
          me.data?.role === 'ADMIN' && (
            <BotonLink href="/api/admin/excel/export/clientes.xlsx" variante="contorno" icono="excel">
              Excel
            </BotonLink>
          )
        }
      />
      <label className="flex min-h-13 items-center gap-3 rounded-2xl border border-linea bg-marino px-4 text-humo focus-within:border-azul">
        <Icono nombre="buscar" />
        <span className="sr-only">Buscar clientes</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, teléfono o zona" className="min-w-0 flex-1 bg-transparent py-3 text-[1.05rem] text-white outline-none placeholder:text-humo focus-visible:outline-none" />
      </label>
      {!res.data ? (
        <Cargando />
      ) : res.data.length === 0 ? (
        <Vacio icono="clientes" titulo={qd ? 'No encontré clientes con eso' : 'Todavía no hay clientes'} texto={qd ? 'Probá con otra búsqueda.' : 'Aparecen acá cuando armás el primer presupuesto.'} />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {res.data.map((c) => (
            <div key={c.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-linea bg-marino px-4 py-3.5">
              <Link href={`/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="titular-medio grid size-11 shrink-0 place-items-center rounded-full bg-noche text-lg">{c.name.slice(0, 1).toUpperCase()}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="truncate text-sm text-humo">
                    {[c.zone, c.quoteCount ? `${c.quoteCount} presupuesto${c.quoteCount === 1 ? '' : 's'}` : 'sin presupuestos', c.lastQuoteAt && `último ${fecha(c.lastQuoteAt)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
              {c.phone && (
                <a href={waLink(c.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${c.name}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-whatsapp/15 text-ok hover:bg-whatsapp/25">
                  <Icono nombre="whatsapp" className="size-5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
