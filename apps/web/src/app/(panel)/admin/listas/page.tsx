'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Icono } from '@/components/Icono';
import { Area, Boton, BotonLink, Cabecera, Campo, Cargando, Chip, Hoja, Interruptor, Pastilla, Selector, Vacio } from '@/components/ui';
import { useAccion, useApi } from '@/lib/api';
import { post, upload } from '@/lib/client-api';
import { fechaHora, moneda, pesos, REGLAS, TIPOS } from '@/lib/format';
import type { Brand, Currency, ItemType, PriceList, PriceRule } from '@/lib/types';

interface Preview {
  importId: string;
  fileName: string;
  sheets: string[];
  mapping: { sheet: string; headerRow: number; codeCol: number | null; nameCol: number; priceCol: number; typeCol: number | null };
  columns: { col: number; title: string }[];
  list: { id: string; name: string; currency: Currency; rule: PriceRule; percent: number; ivaIncluded: boolean };
  totals: { rows: number; new: number; changed: number; unchanged: number; invalid: number; excluded?: number };
  excludeCodes?: string[];
  changed: { code: string | null; name: string; before: number; after: number; pct: number | null; currencyChanged?: boolean; arsAfter: number }[];
  news: { code: string | null; name: string; price: number; type: ItemType; ars: number }[];
}

function Listas() {
  const params = useSearchParams();
  const listas = useApi<PriceList[]>(['price-lists'], '/admin/price-lists');
  const marcas = useApi<Brand[]>(['brands'], '/brands');
  const [editando, setEditando] = useState<PriceList | 'nueva' | null>(null);
  const [importar, setImportar] = useState<string | null>(params.get('importar') ? '' : null);

  return (
    <>
      <Cabecera
        volver={{ href: '/admin', texto: 'Administración' }}
        etiqueta="Listas de precios y Excel"
        titulo="Listas de precios"
        bajada="Cada firma, con su moneda, tu ganancia o beneficio y el IVA. Subí el Excel tal cual te lo mandan y los precios se actualizan por código."
        acciones={
          <>
            <BotonLink href="/api/admin/excel/plantilla.xlsx" variante="contorno" icono="bajar">
              Plantilla de Excel
            </BotonLink>
            <Boton variante="suave" icono="mas" onClick={() => setEditando('nueva')}>
              Nueva lista
            </Boton>
            <Boton icono="subir" onClick={() => setImportar('')}>
              Importar Excel
            </Boton>
          </>
        }
      />

      {listas.isLoading ? (
        <Cargando />
      ) : !listas.data?.length ? (
        <Vacio icono="excel" titulo="Todavía no hay listas" texto="Creá una lista por firma (por ejemplo, «Peisa · dólares») y después importá su Excel." />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {listas.data.map((l) => (
            <article key={l.id} className={`flex flex-col gap-4 rounded-2xl border border-linea bg-marino p-5 ${l.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
                  <Icono nombre={l.currency === 'USD' ? 'dolar' : 'etiqueta'} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="titular-medio text-lg">{l.name}</h2>
                  <p className="text-sm text-humo">
                    {l.brandName ?? 'Sin marca'} · {l.itemCount} ítems{l.validFrom ? ` · actualizada ${fechaHora(l.validFrom)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pastilla tono={l.currency === 'USD' ? 'verde' : 'gris'}>{l.currency === 'USD' ? 'En dólares' : 'En pesos'}</Pastilla>
                <Pastilla tono="azul">
                  {REGLAS[l.rule].titulo}
                  {l.rule !== 'PRECIO_FIJO' ? ` · ${l.percent}%` : ''}
                </Pastilla>
                <Pastilla tono={l.ivaIncluded ? 'gris' : 'rojo'}>{l.ivaIncluded ? 'IVA incluido' : `+ IVA ${l.ivaRate}%`}</Pastilla>
                {l.excludeCodes && <Pastilla>No trae códigos {l.excludeCodes}</Pastilla>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Boton variante="suave" icono="subir" onClick={() => setImportar(l.id)}>
                  Importar Excel
                </Boton>
                <BotonLink href={`/api/admin/excel/export/catalogo.xlsx?priceListId=${l.id}`} variante="contorno" icono="excel">
                  Exportar
                </BotonLink>
                <Boton variante="texto" icono="lapiz" onClick={() => setEditando(l)}>
                  Editar
                </Boton>
              </div>
            </article>
          ))}
        </div>
      )}

      {editando && <EditarLista lista={editando === 'nueva' ? null : editando} marcas={marcas.data ?? []} onCerrar={() => setEditando(null)} />}
      {importar !== null && <Importar listas={listas.data ?? []} inicial={importar} onCerrar={() => setImportar(null)} />}
    </>
  );
}

function EditarLista({ lista, marcas, onCerrar }: { lista: PriceList | null; marcas: Brand[]; onCerrar: () => void }) {
  const [f, setF] = useState({
    name: lista?.name ?? '',
    brandId: lista?.brandId ?? '',
    currency: lista?.currency ?? ('USD' as Currency),
    rule: lista?.rule ?? ('COSTO_MAS_MARGEN' as PriceRule),
    percent: String(lista?.percent ?? 30),
    ivaIncluded: lista?.ivaIncluded ?? false,
    ivaRate: String(lista?.ivaRate ?? 21),
    notes: lista?.notes ?? '',
    excludeCodes: lista?.excludeCodes ?? '',
    active: lista?.active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useAccion<void>({
    method: lista ? 'PATCH' : 'POST',
    path: lista ? `/admin/price-lists/${lista.id}` : '/admin/price-lists',
    body: () => ({ ...f, brandId: f.brandId || null, percent: Number(f.percent.replace(',', '.')) || 0, ivaRate: Number(f.ivaRate) || 21, notes: f.notes || null, excludeCodes: f.excludeCodes.trim().toUpperCase() || null }),
    invalidate: [['price-lists'], ['items']],
    success: 'Lista guardada',
    onSuccess: onCerrar,
  });
  const ejemplo = (() => {
    const base = 100;
    const p = Number(f.percent.replace(',', '.')) || 0;
    const neto = f.rule === 'COSTO_MAS_MARGEN' ? base * (1 + p / 100) : f.rule === 'LISTA_MENOS_DESCUENTO' ? base * (1 - p / 100) : base;
    const final = f.ivaIncluded ? neto : neto * (1 + (Number(f.ivaRate) || 21) / 100);
    return { neto, final };
  })();

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      etiqueta={lista ? 'Editar lista' : 'Nueva lista'}
      titulo={lista?.name ?? 'Lista de precios'}
      pie={
        <>
          <Boton variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="check" onClick={() => guardar.mutate()} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" placeholder="Peisa · lista en dólares" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <Selector etiqueta="Marca" value={f.brandId} onChange={(e) => set('brandId', e.target.value)}>
          <option value="">Sin marca (varias)</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Selector>
        <div className="flex flex-col gap-2">
          <span className="etiqueta text-humo">Moneda de la lista</span>
          <div className="flex gap-2">
            <Chip activo={f.currency === 'USD'} onClick={() => set('currency', 'USD')}>
              Dólares (se pasa con el BNA venta)
            </Chip>
            <Chip activo={f.currency === 'ARS'} onClick={() => set('currency', 'ARS')}>
              Pesos
            </Chip>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="etiqueta text-humo">¿Qué precio trae la lista?</span>
          {(Object.keys(REGLAS) as PriceRule[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={f.rule === r}
              onClick={() => set('rule', r)}
              className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 text-left ${f.rule === r ? 'border-rojo bg-rojo/15 shadow-[0_0_0_1px_var(--color-rojo)]' : 'border-linea bg-marino-2/60'}`}
            >
              <span className="font-bold">{REGLAS[r].titulo}</span>
              <span className="text-sm text-celeste">{REGLAS[r].ayuda}</span>
            </button>
          ))}
        </div>
        {f.rule !== 'PRECIO_FIJO' && <Campo etiqueta={`${REGLAS[f.rule].pct} (%)`} inputMode="decimal" value={f.percent} onChange={(e) => set('percent', e.target.value)} />}
        <Interruptor activo={f.ivaIncluded} onCambio={(v) => set('ivaIncluded', v)} etiqueta="Los precios de la lista ya traen IVA" ayuda="Si viene «+ IVA», dejalo apagado y el sistema lo suma en equipos y repuestos." />
        {!f.ivaIncluded && <Campo etiqueta="IVA (%)" inputMode="decimal" value={f.ivaRate} onChange={(e) => set('ivaRate', e.target.value)} />}
        <p className="rounded-xl bg-noche px-4 py-3 text-sm text-celeste">
          Ejemplo: un equipo de {f.currency === 'USD' ? 'U$S' : '$'} 100 de lista sale a{' '}
          <b className="text-white">
            {f.currency === 'USD' ? 'U$S' : '$'} {ejemplo.final.toFixed(2)}
          </b>{' '}
          final con IVA{f.currency === 'USD' ? ', y se pasa a pesos con el dólar del día' : ''}.
        </p>
        <Campo
          etiqueta="No traer los códigos que empiecen con"
          placeholder="Ej.: PEI"
          value={f.excludeCodes}
          onChange={(e) => set('excludeCodes', e.target.value)}
          ayuda="Para firmas que cotizás con otra lista. Separalos con coma. Al importar se saltean solos y los que ya estaban se archivan."
        />
        <Area etiqueta="Notas" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        {lista && <Interruptor activo={f.active} onCambio={(v) => set('active', v)} etiqueta="Lista activa" />}
      </div>
    </Hoja>
  );
}

function Importar({ listas, inicial, onCerrar }: { listas: PriceList[]; inicial: string; onCerrar: () => void }) {
  const qc = useQueryClient();
  const [listaId, setListaId] = useState(inicial || listas[0]?.id || '');
  // Las listas pueden llegar después de abrir la hoja
  useEffect(() => {
    if (!listaId && listas[0]) setListaId(listas[0].id);
  }, [listas, listaId]);
  const [tipo, setTipo] = useState<ItemType>('EQUIPO');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<Preview | null>(null);
  const [cargando, setCargando] = useState(false);

  const previsualizar = async (file = archivo, extra: Record<string, string | number> = {}) => {
    if (!file || !listaId) return;
    setCargando(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('priceListId', listaId);
    fd.append('defaultType', tipo);
    Object.entries(extra).forEach(([k, v]) => fd.append(k, String(v)));
    try {
      setVista(await upload<Preview>('/admin/excel/import/preview', fd));
    } catch (e) {
      toast.error((e as Error).message);
      setVista(null);
    } finally {
      setCargando(false);
    }
  };

  const columna = (k: 'codeCol' | 'nameCol' | 'priceCol' | 'typeCol', v: string) => {
    if (!vista) return;
    const m = { ...vista.mapping, [k]: Number(v) };
    previsualizar(archivo, { sheet: m.sheet, headerRow: m.headerRow, codeCol: m.codeCol ?? 0, nameCol: m.nameCol, priceCol: m.priceCol, typeCol: m.typeCol ?? 0 });
  };

  const confirmar = async () => {
    if (!vista) return;
    setCargando(true);
    try {
      const r = await post<{ created: number; updated: number }>(`/admin/excel/import/${vista.importId}/confirm`);
      toast.success(`Listo: ${r.created} nuevos y ${r.updated} con precio nuevo`);
      ['items', 'price-lists'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onCerrar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const moneyOf = (n: number) => moneda(n, vista?.list.currency ?? 'ARS');

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      ancha
      etiqueta={vista ? 'Paso 2 de 2 · Revisá antes de aplicar' : 'Paso 1 de 2 · Subí el archivo'}
      titulo="Importar lista de precios"
      pie={
        vista ? (
          <>
            <Boton variante="contorno" onClick={() => setVista(null)}>
              Atrás
            </Boton>
            <Boton icono="check" onClick={confirmar} cargando={cargando} disabled={!vista.totals.new && !vista.totals.changed}>
              Aplicar {vista.totals.new + vista.totals.changed} cambios
            </Boton>
          </>
        ) : (
          <Boton icono="ojo" onClick={() => previsualizar()} cargando={cargando} disabled={!archivo || !listaId}>
            Ver qué cambia
          </Boton>
        )
      }
    >
      {!vista ? (
        <div className="flex flex-col gap-4">
          {!listas.length && <p className="rounded-xl bg-bordo/40 px-4 py-3 text-sm text-alerta">Primero creá la lista de esa firma (moneda, ganancia o beneficio e IVA).</p>}
          <Selector etiqueta="¿De qué lista es el archivo?" value={listaId} onChange={(e) => setListaId(e.target.value)}>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Selector>
          <div className="flex flex-col gap-2">
            <span className="etiqueta text-humo">Si el archivo no dice el tipo, cargarlos como</span>
            <div className="flex flex-wrap gap-2">
              {(['EQUIPO', 'REPUESTO', 'MATERIAL'] as ItemType[]).map((t) => (
                <Chip key={t} activo={tipo === t} onClick={() => setTipo(t)}>
                  {TIPOS[t]}s
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-linea-2 bg-noche/60 p-6 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-whatsapp/12 text-ok">
              <Icono nombre="subir" className="size-7" />
            </span>
            <span className="font-bold">{archivo ? archivo.name : 'Tocá para elegir el Excel de la firma'}</span>
            <span className="text-sm text-humo">.xlsx o .csv · se buscan solas las columnas de código, descripción y precio</span>
            <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Pastilla tono="verde">{vista.totals.new} nuevos</Pastilla>
            <Pastilla tono="azul">{vista.totals.changed} cambian de precio</Pastilla>
            <Pastilla>{vista.totals.unchanged} sin cambios</Pastilla>
            {vista.totals.invalid > 0 && <Pastilla tono="rojo">{vista.totals.invalid} filas sin precio (se saltean)</Pastilla>}
            {!!vista.totals.excluded && <Pastilla>{vista.totals.excluded} con código {vista.excludeCodes?.join(', ')} (no se cargan)</Pastilla>}
          </div>
          <div className="grid gap-3 rounded-2xl border border-linea bg-noche p-4 sm:grid-cols-2">
            <p className="text-sm text-celeste sm:col-span-2">
              Columnas que encontramos en «{vista.mapping.sheet}». Si alguna no es, cambiala:
            </p>
            {(
              [
                ['codeCol', 'Código'],
                ['nameCol', 'Descripción'],
                ['priceCol', 'Precio'],
                ['typeCol', 'Tipo (opcional)'],
              ] as const
            ).map(([k, t]) => (
              <Selector key={k} etiqueta={t} value={String(vista.mapping[k] ?? 0)} onChange={(e) => columna(k, e.target.value)} disabled={cargando}>
                {(k === 'codeCol' || k === 'typeCol') && <option value="0">No hay</option>}
                {vista.columns.map((c) => (
                  <option key={c.col} value={c.col}>
                    {c.title}
                  </option>
                ))}
              </Selector>
            ))}
          </div>
          {vista.changed.length > 0 && (
            <Tabla
              titulo="Cambian de precio"
              filas={vista.changed.map((c) => [c.code ?? '—', c.name, c.currencyChanged ? `${pesos(c.before)} (otra moneda)` : moneyOf(c.before), moneyOf(c.after), c.pct != null ? `${c.pct > 0 ? '+' : ''}${c.pct}%` : '—', pesos(c.arsAfter)])}
              cols={['Código', 'Ítem', 'Antes', 'Ahora', 'Cambio', 'Final $']}
            />
          )}
          {vista.news.length > 0 && <Tabla titulo="Nuevos" filas={vista.news.map((n) => [n.code ?? '—', n.name, TIPOS[n.type], moneyOf(n.price), pesos(n.ars)])} cols={['Código', 'Ítem', 'Tipo', 'Lista', 'Final $']} />}
          <p className="text-sm text-humo">Se muestran los primeros. Los presupuestos ya enviados no cambian.</p>
        </div>
      )}
    </Hoja>
  );
}

function Tabla({ titulo, cols, filas }: { titulo: string; cols: string[]; filas: string[][] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="titular-medio text-lg">{titulo}</h3>
      <div className="overflow-x-auto rounded-2xl border border-linea bg-marino-2">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className="etiqueta px-3 pb-2 pt-3 text-left text-humo">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-t border-linea">
                {f.map((v, j) => (
                  <td key={j} className={`px-3 py-2.5 ${j === 1 ? 'font-semibold' : 'tabular text-celeste'}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ListasPage() {
  return (
    <Suspense>
      <Listas />
    </Suspense>
  );
}
