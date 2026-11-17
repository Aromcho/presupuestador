'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FilaPresupuesto } from '@/components/FilaPresupuesto';
import { Icono } from '@/components/Icono';
import { Area, Boton, BotonLink, Cabecera, Campo, Cargando, Tarjeta, Vacio } from '@/components/ui';
import { useAccion, useApi } from '@/lib/api';
import { waLink } from '@/lib/format';
import type { Client, Paged, QuoteRow } from '@/lib/types';

export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const c = useApi<Client>(['client', id], `/clients/${id}`);
  const presupuestos = useApi<Paged<QuoteRow>>(['quotes', 'cliente', id], `/quotes?clientId=${id}&limit=50`);
  const [f, setF] = useState<Client | null>(null);
  useEffect(() => {
    if (c.data) setF(c.data);
  }, [c.data]);
  const guardar = useAccion<Client, Client>({
    method: 'PATCH',
    path: `/clients/${id}`,
    body: (v) => ({ name: v.name, phone: v.phone ?? '', email: v.email ?? '', zone: v.zone ?? '', address: v.address ?? '', notes: v.notes ?? '' }),
    invalidate: [['clients'], ['quotes']],
    success: 'Datos guardados',
    onSuccess: (r) => qc.setQueryData(['client', id], r),
  });

  if (c.isError) return <Vacio titulo="No encontramos ese cliente" texto={(c.error as Error).message} />;
  if (!c.data || !f) return <Cargando />;
  const cambiar = (k: keyof Client) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <Cabecera
        volver={{ href: '/clientes', texto: 'Clientes' }}
        etiqueta="Cliente"
        titulo={c.data.name}
        bajada={[c.data.phone, c.data.zone, c.data.address].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
        acciones={
          <>
            {c.data.phone && (
              <a href={waLink(c.data.phone)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-whatsapp bg-whatsapp px-[1.1rem] font-bold text-[#03190b] hover:brightness-110">
                <Icono nombre="whatsapp" className="size-[1.1rem]" />
                WhatsApp
              </a>
            )}
            <BotonLink href={`/presupuestos/nuevo?cliente=${id}`} icono="mas">
              Nuevo presupuesto
            </BotonLink>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="titular-medio text-2xl">Presupuestos</h2>
          {!presupuestos.data ? (
            <Cargando />
          ) : presupuestos.data.items.length === 0 ? (
            <Vacio icono="doc" titulo="Sin presupuestos todavía" />
          ) : (
            presupuestos.data.items.map((r) => <FilaPresupuesto key={r.id} r={r} />)
          )}
        </section>
        <Tarjeta className="flex min-w-0 flex-col gap-3 lg:self-start">
          <p className="titular-medio text-xl">Datos</p>
          <Campo etiqueta="Nombre" value={f.name} onChange={cambiar('name')} />
          <Campo etiqueta="WhatsApp" type="tel" value={f.phone ?? ''} onChange={cambiar('phone')} />
          <Campo etiqueta="Zona" value={f.zone ?? ''} onChange={cambiar('zone')} />
          <Campo etiqueta="Dirección" value={f.address ?? ''} onChange={cambiar('address')} />
          <Campo etiqueta="Email" type="email" value={f.email ?? ''} onChange={cambiar('email')} />
          <Area etiqueta="Notas internas" value={f.notes ?? ''} onChange={cambiar('notes')} placeholder="Ej.: tiene caldera Peisa Diva de 2019" />
          <Boton icono="check" cargando={guardar.isPending} onClick={() => guardar.mutate(f)} disabled={f.name.trim().length < 2}>
            Guardar
          </Boton>
        </Tarjeta>
      </div>
    </>
  );
}
