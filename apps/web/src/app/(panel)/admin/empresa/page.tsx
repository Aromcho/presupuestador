'use client';

import { useEffect, useState } from 'react';
import { Boton, Cabecera, Campo, Cargando, Chip, Etiqueta, Tarjeta } from '@/components/ui';
import { useAccion, useApi, useDolar } from '@/lib/api';
import { fechaHora, pesos } from '@/lib/format';
import type { AjustesPresupuestos, Dolar, Empresa } from '@/lib/types';

const CAMPOS: [keyof Empresa, string][] = [
  ['nombre', 'Nombre comercial'],
  ['razonSocial', 'Razón social'],
  ['cuit', 'CUIT'],
  ['condicionIva', 'Condición frente al IVA'],
  ['direccion', 'Dirección'],
  ['localidad', 'Localidad'],
  ['telefono', 'Teléfono'],
  ['whatsapp', 'WhatsApp (con 549)'],
  ['email', 'Email'],
  ['web', 'Web'],
  ['instagram', 'Instagram'],
];

export default function EmpresaPage() {
  const datos = useApi<{ empresa: Empresa; presupuestos: AjustesPresupuestos }>(['company'], '/company');
  const [e, setE] = useState<Empresa | null>(null);
  const [p, setP] = useState<AjustesPresupuestos | null>(null);
  useEffect(() => {
    if (datos.data) {
      setE(datos.data.empresa);
      setP(datos.data.presupuestos);
    }
  }, [datos.data]);
  const guardar = useAccion<void>({ method: 'PATCH', path: '/admin/company', body: () => ({ empresa: e, presupuestos: p }), invalidate: [['company'], ['items']], success: 'Datos guardados' });

  if (!e || !p) return <Cargando />;
  return (
    <>
      <Cabecera
        volver={{ href: '/admin', texto: 'Administración' }}
        etiqueta="Empresa y dólar"
        titulo="Datos de Gesetec"
        bajada="Salen en el encabezado y el pie de cada presupuesto."
        acciones={
          <Boton icono="check" onClick={() => guardar.mutate()} cargando={guardar.isPending}>
            Guardar cambios
          </Boton>
        }
      />
      <DolarTarjeta />
      <Tarjeta className="flex flex-col gap-4">
        <h2 className="titular-medio text-2xl">Empresa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS.map(([k, t]) => (
            <Campo key={k} etiqueta={t} value={e[k] as string} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} />
          ))}
          <Campo etiqueta="Zonas (separadas por coma)" value={e.zonas.join(', ')} onChange={(ev) => setE({ ...e, zonas: ev.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="sm:col-span-2" />
          <Campo etiqueta="Marcas de la franja (separadas por coma)" value={e.marcas.join(', ')} onChange={(ev) => setE({ ...e, marcas: ev.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="sm:col-span-2" />
        </div>
      </Tarjeta>
      <Tarjeta className="flex flex-col gap-4">
        <h2 className="titular-medio text-2xl">Presupuestos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Próximo número" type="number" min={1} value={p.proximoNumero} onChange={(ev) => setP({ ...p, proximoNumero: Number(ev.target.value) || 1 })} />
          <Campo etiqueta="Validez (horas)" type="number" min={1} value={p.validezHoras} onChange={(ev) => setP({ ...p, validezHoras: Number(ev.target.value) || 48 })} />
          <Campo etiqueta="Forma de pago" value={p.formaPago} onChange={(ev) => setP({ ...p, formaPago: ev.target.value })} className="sm:col-span-2" />
          <Campo etiqueta="Pie del presupuesto" value={p.pie} onChange={(ev) => setP({ ...p, pie: ev.target.value })} className="sm:col-span-2" />
        </div>
        <div className="flex flex-col gap-2">
          <Etiqueta className="text-humo">Redondeo de los precios en pesos</Etiqueta>
          <div className="flex flex-wrap gap-2">
            {[1, 100, 1000, -1].map((r) => (
              <Chip key={r} activo={p.redondeo === r} onClick={() => setP({ ...p, redondeo: r })}>
                {r === 1 ? 'Sin redondeo' : r === -1 ? 'Hacia arriba, a números redondos' : `A los $${r.toLocaleString('es-AR')}`}
              </Chip>
            ))}
          </div>
          {p.redondeo === -1 && (
            <p className="text-sm text-humo">
              Para los precios que vienen en dólares: hasta $100.000 sube al $1.000 siguiente, hasta $1.000.000 a los $5.000 y desde ahí a los $50.000 (por ejemplo, $4.253.000 queda en $4.300.000). Los precios en pesos, como el tarifario del service, no cambian.
            </p>
          )}
        </div>
      </Tarjeta>
    </>
  );
}

function DolarTarjeta() {
  const dolar = useDolar();
  const historial = useApi<{ id: string; source: string; sell: number; quotedAt: string }[]>(['dolar', 'historial'], '/admin/exchange/history');
  const [manual, setManual] = useState('');
  const actualizar = useAccion<void, { ok: boolean }>({ method: 'POST', path: '/admin/exchange/refresh', body: () => ({}), invalidate: [['dolar'], ['items']], success: (r) => (r.ok ? 'Dólar actualizado' : 'La fuente no respondió: queda el último valor') });
  const fijar = useAccion<number | null, Dolar>({ method: 'POST', path: '/admin/exchange/manual', body: (v) => ({ venta: v }), invalidate: [['dolar'], ['items']], success: (d) => (d.modo === 'manual' ? 'Dólar fijado a mano' : 'Volvió al dólar BNA automático'), onSuccess: () => setManual('') });
  const d = dolar.data;

  return (
    <Tarjeta className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Etiqueta className="text-humo">{d?.modo === 'manual' ? 'Dólar fijado a mano' : 'Dólar oficial Banco Nación · venta'}</Etiqueta>
          <p className="titular tabular text-5xl">{pesos(d?.venta)}</p>
          <p className="text-sm text-celeste">{d?.fecha ? `Actualizado ${fechaHora(d.fecha)}` : 'Sin cotización todavía'} · se consulta solo cada hora</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d?.modo === 'manual' ? (
            <Boton variante="suave" icono="recargar" onClick={() => fijar.mutate(null)} cargando={fijar.isPending}>
              Volver al automático
            </Boton>
          ) : (
            <Boton variante="suave" icono="recargar" onClick={() => actualizar.mutate()} cargando={actualizar.isPending}>
              Actualizar ahora
            </Boton>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Fijar un valor a mano" inputMode="decimal" placeholder="1600" value={manual} onChange={(ev) => setManual(ev.target.value)} className="w-56" />
        <Boton variante="contorno" disabled={!Number(manual.replace(',', '.'))} cargando={fijar.isPending} onClick={() => fijar.mutate(Number(manual.replace(',', '.')))}>
          Usar este valor
        </Boton>
      </div>
      {!!historial.data?.length && (
        <details className="text-sm">
          <summary className="cursor-pointer text-celeste">Últimas cotizaciones</summary>
          <ul className="mt-3 flex flex-col gap-1.5">
            {historial.data.slice(0, 10).map((h) => (
              <li key={h.id} className="tabular flex justify-between gap-4 border-t border-linea pt-1.5">
                <span className="text-humo">{fechaHora(h.quotedAt)} · {h.source === 'manual' ? 'a mano' : 'BNA'}</span>
                <b>{pesos(h.sell)}</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Tarjeta>
  );
}
