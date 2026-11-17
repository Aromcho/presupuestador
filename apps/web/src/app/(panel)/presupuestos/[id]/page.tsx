'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Icono } from '@/components/Icono';
import { Boton, BotonLink, Cabecera, Cargando, Chip, Etiqueta, Pastilla, Tarjeta, Vacio } from '@/components/ui';
import { useAccion, useApi, useMe } from '@/lib/api';
import { del, post } from '@/lib/client-api';
import { esProducto, ESTADOS, fecha, fechaHora, pesos, TIPOS } from '@/lib/format';
import type { Quote, QuoteStatus, SendResult } from '@/lib/types';

function Ficha() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const q = useApi<Quote>(['quote', id], `/quotes/${id}`);
  const [envio, setEnvio] = useState<SendResult | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [borrar, setBorrar] = useState(false);

  const refrescar = (data: Quote) => {
    qc.setQueryData(['quote', id], data);
    qc.invalidateQueries({ queryKey: ['quotes'] });
  };
  const estado = useAccion<QuoteStatus, Quote>({ method: 'PATCH', path: `/quotes/${id}/status`, body: (status) => ({ status }), success: (r) => `Quedó como ${ESTADOS[r.status].texto.toLowerCase()}`, onSuccess: refrescar });
  const duplicar = useAccion<void, Quote>({
    method: 'POST',
    path: `/quotes/${id}/duplicate`,
    body: () => ({}),
    invalidate: [['quotes']],
    success: (r) => `Copia lista: N° ${r.numberLabel}`,
    onSuccess: (r) => router.push(`/presupuestos/${r.id}/editar`),
  });
  const actualizar = useAccion<void, Quote & { changed: number }>({
    method: 'POST',
    path: `/quotes/${id}/reprice`,
    body: () => ({}),
    success: (r) => (r.changed ? `Actualicé ${r.changed} precio${r.changed === 1 ? '' : 's'} al dólar de hoy` : 'Los precios ya estaban al día'),
    onSuccess: refrescar,
  });

  if (q.isError) return <Vacio titulo="No encontramos ese presupuesto" texto={(q.error as Error).message} accion={<BotonLink href="/presupuestos">Ver presupuestos</BotonLink>} />;
  if (!q.data) return <Cargando />;
  const p = q.data;
  const comparativa = p.mode === 'COMPARATIVA' && p.groups.length > 1;
  const est = ESTADOS[p.status];

  async function enviar() {
    // La ventana se abre en el mismo toque (si no, el navegador la bloquea) y después se le pone el link
    const w = window.open('', '_blank');
    setEnviando(true);
    try {
      const r = await post<SendResult>(`/quotes/${id}/send`);
      setEnvio(r);
      if (w) w.location.href = r.whatsappUrl;
      else window.location.href = r.whatsappUrl;
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    } catch (e) {
      w?.close();
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      toast.error('No pude copiar. Mantené apretado el texto para copiarlo.');
    }
  }

  async function eliminar() {
    if (!borrar) {
      setBorrar(true);
      setTimeout(() => setBorrar(false), 4000);
      return;
    }
    try {
      await del(`/quotes/${id}`);
      qc.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(`Borré el N° ${p.numberLabel}`);
      router.replace('/presupuestos');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Cabecera
        volver={{ href: '/presupuestos', texto: 'Presupuestos' }}
        etiqueta={`Presupuesto N° ${p.numberLabel} · ${fecha(p.createdAt)}`}
        titulo={p.title}
        bajada={
          <span className="flex flex-wrap items-center gap-2">
            <Pastilla tono={est.tono}>{est.texto}</Pastilla>
            <span>
              {p.client?.name ?? 'Sin cliente'}
              {p.client?.zone ? ` · ${p.client.zone}` : ''}
            </span>
          </span>
        }
      />

      {params.get('listo') === '1' && !p.sentAt && (
        <div className="flex items-center gap-3 rounded-2xl border border-whatsapp/40 bg-whatsapp/10 px-4 py-3 text-[0.95rem]">
          <Icono nombre="check" className="size-5 shrink-0 text-ok" />
          Quedó guardado. Ahora mandáselo por WhatsApp: le llega un link para ver y bajar el PDF.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          {p.groups.map((g) => (
            <Tarjeta key={g.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="titular-medio text-xl">{comparativa ? g.label : 'Detalle'}</p>
                {comparativa && <p className="titular tabular text-2xl">{pesos(g.total)}</p>}
              </div>
              <ul className="flex flex-col divide-y divide-linea">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 py-3">
                    {i.photo ? (
                      <img src={i.photo} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1" />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
                        <Icono nombre={esProducto(i.type) ? 'caja' : 'usuario'} className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{i.name}</p>
                      <p className="text-xs text-humo">{[TIPOS[i.type], i.code, i.description].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular font-bold">{pesos(i.total)}</p>
                      {(i.qty !== 1 || !esProducto(i.type)) && (
                        <p className="text-xs text-humo">
                          {i.qty !== 1 ? `${i.qty} × ${pesos(i.unitPrice)}` : ''}
                          {i.qty !== 1 && !esProducto(i.type) ? ' · ' : ''}
                          {!esProducto(i.type) ? '+ IVA si factura' : ''}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ))}
          {p.total != null && (
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-marino-2 px-6 py-5">
              <Etiqueta>Total</Etiqueta>
              <p className="titular tabular text-4xl">{pesos(p.total)}</p>
            </div>
          )}
          {(p.seIncluye.length > 0 || p.notes.length > 0 || p.observations) && (
            <Tarjeta className="flex flex-col gap-4">
              {p.seIncluye.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Etiqueta>Se incluye</Etiqueta>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {p.seIncluye.map((s) => (
                      <li key={s} className="flex gap-2 text-[0.95rem]">
                        <Icono nombre="check" className="mt-0.5 size-4 shrink-0 text-info" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.notes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Etiqueta>Aclaraciones</Etiqueta>
                  <ul className="flex flex-col gap-1 text-sm text-celeste">
                    {p.notes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.observations && (
                <div className="flex flex-col gap-2">
                  <Etiqueta>Observaciones</Etiqueta>
                  <p className="whitespace-pre-line text-[0.95rem]">{p.observations}</p>
                </div>
              )}
            </Tarjeta>
          )}
        </div>

        <aside className="order-first flex min-w-0 flex-col gap-4 lg:order-none lg:sticky lg:top-6 lg:self-start">
          <Tarjeta className="flex flex-col gap-3">
            <Boton variante="wa" grande icono="whatsapp" cargando={enviando} onClick={enviar}>
              {p.sentAt ? 'Reenviar por WhatsApp' : 'Enviar por WhatsApp'}
            </Boton>
            {!p.client?.phone && <p className="text-sm text-alerta">El cliente no tiene WhatsApp cargado: vas a elegir el contacto en WhatsApp.</p>}
            <div className="grid grid-cols-2 gap-2">
              <a href={`/api/quotes/${id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-linea px-4 font-bold transition hover:border-celeste/50 hover:bg-white/5">
                <Icono nombre="ojo" className="size-[1.1rem]" />
                Ver PDF
              </a>
              <a href={`/api/quotes/${id}/pdf?descargar=1`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-linea px-4 font-bold transition hover:border-celeste/50 hover:bg-white/5">
                <Icono nombre="bajar" className="size-[1.1rem]" />
                Bajar PDF
              </a>
            </div>
            {(envio || p.share) && (
              <div className="flex flex-col gap-2 rounded-2xl border border-linea bg-noche/50 p-3">
                <p className="text-xs text-humo">Link para el cliente (vence {fecha(p.share?.expiresAt ?? null)})</p>
                <p className="break-all text-sm text-celeste">{envio?.url ?? p.share?.url}</p>
                <div className="flex flex-wrap gap-2">
                  <Boton variante="suave" icono="copiar" onClick={() => copiar((envio?.url ?? p.share?.url)!, 'Link copiado')}>
                    Copiar link
                  </Boton>
                  {envio && (
                    <Boton variante="suave" icono="copiar" onClick={() => copiar(envio.text, 'Mensaje copiado')}>
                      Copiar mensaje
                    </Boton>
                  )}
                </div>
              </div>
            )}
            {p.sentAt && (
              <p className="text-sm text-humo">
                Enviado {fechaHora(p.sentAt)}
                {p.expiresAt ? ` · vence ${fechaHora(p.expiresAt)}` : ''}
              </p>
            )}
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3">
            <Etiqueta className="text-humo">¿Qué respondió?</Etiqueta>
            <div className="flex flex-wrap gap-2">
              {(['ENVIADO', 'ACEPTADO', 'RECHAZADO'] as QuoteStatus[]).map((s) => (
                <Chip key={s} activo={p.rawStatus === s} onClick={() => p.rawStatus !== s && estado.mutate(s)} disabled={estado.isPending}>
                  {s === 'ENVIADO' ? 'Esperando respuesta' : ESTADOS[s].texto}
                </Chip>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-2">
            <BotonLink href={`/presupuestos/${id}/editar`} variante="contorno" icono="lapiz">
              Editar
            </BotonLink>
            <Boton variante="contorno" icono="copiar" cargando={duplicar.isPending} onClick={() => duplicar.mutate()}>
              Duplicar
            </Boton>
            {p.usesDollar && (
              <Boton variante="contorno" icono="recargar" cargando={actualizar.isPending} onClick={() => actualizar.mutate()}>
                Actualizar al dólar de hoy
              </Boton>
            )}
            {p.dollarSell && p.usesDollar && <p className="text-xs text-humo">Calculado con dólar BNA venta {pesos(p.dollarSell)} ({fecha(p.dollarAt)}).</p>}
            {(me.data?.role === 'ADMIN' || p.rawStatus === 'BORRADOR') && (
              <Boton variante="texto" icono="basura" onClick={eliminar} className="text-alerta">
                {borrar ? 'Tocá de nuevo para borrarlo' : 'Borrar presupuesto'}
              </Boton>
            )}
          </Tarjeta>

          {p.client && (
            <Tarjeta className="flex flex-col gap-1.5">
              <Etiqueta className="text-humo">Cliente</Etiqueta>
              <BotonLink href={`/clientes/${p.client.id}`} variante="texto" className="justify-start px-0 text-lg text-white">
                {p.client.name}
              </BotonLink>
              <p className="text-sm text-celeste">{[p.client.phone, p.client.zone, p.client.address].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
              <p className="text-xs text-humo">Lo armó {p.user?.name ?? '—'}</p>
            </Tarjeta>
          )}
        </aside>
      </div>
    </>
  );
}

export default function FichaPage() {
  return (
    <Suspense>
      <Ficha />
    </Suspense>
  );
}
