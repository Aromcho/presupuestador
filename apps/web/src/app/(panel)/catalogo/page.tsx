'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Icono, type IconoNombre } from '@/components/Icono';
import { Area, Boton, Cabecera, Campo, Cargando, Chip, Hoja, Interruptor, Pastilla, Selector, Vacio } from '@/components/ui';
import { useAccion, useApi, useMe } from '@/lib/api';
import { post, upload } from '@/lib/client-api';
import { moneda, pesos, REGLAS, TIPOS } from '@/lib/format';
import type { Brand, Currency, Item, ItemType, Paged, PriceList, PriceRule } from '@/lib/types';

const ICONO_TIPO: Record<ItemType, IconoNombre> = { EQUIPO: 'instalacion', REPUESTO: 'llave', MATERIAL: 'caja', MANO_DE_OBRA: 'usuario', SERVICIO: 'mantenimiento' };

function useDebounce<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Catalogo() {
  const params = useSearchParams();
  const me = useMe();
  const admin = me.data?.role === 'ADMIN';
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<ItemType | ''>('');
  const [marca, setMarca] = useState('');
  const [lista, setLista] = useState('');
  const [limite, setLimite] = useState(40);
  const [editando, setEditando] = useState<Item | 'nuevo' | null>(null);
  const [aumento, setAumento] = useState(params.get('aumento') === '1');
  const qd = useDebounce(q);

  const marcas = useApi<Brand[]>(['brands'], '/brands');
  const listas = useApi<PriceList[]>(['price-lists'], '/admin/price-lists', { enabled: admin });
  const query = new URLSearchParams({ limit: String(limite), ...(qd && { q: qd }), ...(tipo && { type: tipo }), ...(marca && { brandId: marca }), ...(lista && { priceListId: lista }) });
  const items = useApi<Paged<Item>>(['items', query.toString()], `/items?${query}`);

  return (
    <>
      <Cabecera
        etiqueta="Catálogo"
        titulo="Catálogo y precios"
        bajada={admin ? 'Buscá por código, nombre o marca. El precio final se calcula con la lista, tu ganancia o beneficio, el IVA y el dólar del día.' : 'Buscá por código, nombre o marca. El precio es el final, con el dólar del día.'}
        acciones={
          admin && (
            <>
              <Boton variante="contorno" icono="porcentaje" onClick={() => setAumento(true)}>
                Actualizar por %
              </Boton>
              <Boton icono="mas" onClick={() => setEditando('nuevo')}>
                Nuevo ítem
              </Boton>
            </>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <label className="flex min-h-13 items-center gap-3 rounded-2xl border border-linea bg-marino px-4 text-humo focus-within:border-azul">
          <Icono nombre="buscar" />
          <span className="sr-only">Buscar en el catálogo</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimite(40);
            }}
            placeholder="Código, nombre o marca: «peisa 24», «cp30», «R-NTC»…"
            className="min-w-0 flex-1 bg-transparent py-3 text-[1.05rem] text-white outline-none placeholder:text-humo focus-visible:outline-none"
            autoFocus
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Chip activo={!tipo} onClick={() => setTipo('')}>
            Todo
          </Chip>
          {(Object.keys(TIPOS) as ItemType[]).map((t) => (
            <Chip key={t} activo={tipo === t} onClick={() => setTipo(tipo === t ? '' : t)}>
              {TIPOS[t]}
            </Chip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <Selector etiqueta="Marca" value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas</option>
            {marcas.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Selector>
          {admin && (
            <Selector etiqueta="Lista de precios" value={lista} onChange={(e) => setLista(e.target.value)}>
              <option value="">Todas</option>
              {listas.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Selector>
          )}
        </div>
      </div>

      {items.isLoading ? (
        <Cargando />
      ) : !items.data?.items.length ? (
        <Vacio titulo="No encontramos nada" texto={q ? 'Probá con otra palabra o con el código del repuesto.' : 'Todavía no hay ítems. Importá la lista de una firma desde Administración.'} />
      ) : (
        <section aria-label="Resultados" className="flex flex-col gap-2.5">
          <p className="text-sm text-humo">
            {items.data.total} {items.data.total === 1 ? 'resultado' : 'resultados'}
          </p>
          <ul className="flex flex-col gap-2.5">
            {items.data.items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => admin && setEditando(it)}
                  className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-linea bg-marino p-3.5 text-left transition hover:border-celeste/40 disabled:cursor-default"
                  disabled={!admin}
                >
                  <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                    {it.photo ? <img src={it.photo.sm} alt="" className="max-h-14 max-w-14 object-contain" /> : <Icono nombre={ICONO_TIPO[it.type]} className="size-7 text-[#26324d]" />}
                  </span>
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                    <span className="font-bold">{it.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-humo">
                      {it.code && <span className="tabular rounded-md bg-noche px-1.5 py-0.5 text-xs text-celeste">{it.code}</span>}
                      {it.brand?.name}
                      <Pastilla tono={it.type === 'MANO_DE_OBRA' || it.type === 'SERVICIO' ? 'rojo' : it.type === 'REPUESTO' ? 'verde' : 'azul'}>{TIPOS[it.type]}</Pastilla>
                      {admin && it.priceList && <span className="text-xs">{it.priceList.name}</span>}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-col items-end gap-0.5 text-right">
                    <span className="titular-medio tabular text-xl">{it.price.needsDollar ? 'Falta el dólar' : pesos(it.price.ars)}</span>
                    <span className="text-xs text-humo">{it.price.withIva ? 'Final, IVA incluido' : 'Sin IVA · + IVA si factura'}</span>
                    {admin && it.listPrice != null && (
                      <span className="tabular text-xs text-celeste">
                        Lista {moneda(it.listPrice, it.currency)}
                        {it.rule !== 'PRECIO_FIJO' && it.percent ? ` · ${it.rule === 'COSTO_MAS_MARGEN' ? '+' : '−'}${it.percent}%` : ''}
                        {!it.ivaIncluded && it.price.withIva ? ` · +IVA ${it.ivaRate}%` : ''}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.data.total > items.data.items.length && (
            <Boton variante="contorno" className="self-center" onClick={() => setLimite((l) => l + 40)} cargando={items.isFetching}>
              Ver más
            </Boton>
          )}
        </section>
      )}

      {admin && editando && <EditarItem item={editando === 'nuevo' ? null : editando} marcas={marcas.data ?? []} listas={listas.data ?? []} onCerrar={() => setEditando(null)} />}
      {admin && <Aumento abierta={aumento} onCerrar={() => setAumento(false)} marcas={marcas.data ?? []} listas={listas.data ?? []} />}
    </>
  );
}

function EditarItem({ item, marcas, listas, onCerrar }: { item: Item | null; marcas: Brand[]; listas: PriceList[]; onCerrar: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({
    type: item?.type ?? ('EQUIPO' as ItemType),
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    brandId: item?.brand?.id ?? '',
    priceListId: item?.priceList?.id ?? '',
    currency: item?.currency ?? ('ARS' as Currency),
    listPrice: item?.listPrice != null ? String(item.listPrice) : '',
    ruleOverride: (item?.ruleOverride ?? '') as PriceRule | '',
    percentOverride: item?.percentOverride != null ? String(item.percentOverride) : '',
    ivaIncluded: item?.ivaIncluded ?? true,
    unit: item?.unit ?? 'u.',
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const lista = listas.find((l) => l.id === f.priceListId);

  const guardar = useAccion<void, Item>({
    method: item ? 'PATCH' : 'POST',
    path: item ? `/admin/items/${item.id}` : '/admin/items',
    body: () => ({
      ...f,
      code: f.code || null,
      description: f.description || null,
      brandId: f.brandId || null,
      priceListId: f.priceListId || null,
      listPrice: Number(f.listPrice.replace(',', '.')) || 0,
      ruleOverride: f.ruleOverride || null,
      percentOverride: f.percentOverride === '' ? null : Number(f.percentOverride),
    }),
    invalidate: [['items']],
    success: item ? 'Guardado' : 'Ítem agregado',
    onSuccess: onCerrar,
  });
  const archivar = useAccion<void>({ method: 'DELETE', path: `/admin/items/${item?.id}`, invalidate: [['items']], success: 'Ítem archivado', onSuccess: onCerrar });

  const subirFoto = async (file: File | undefined) => {
    if (!file || !item) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await upload(`/admin/items/${item.id}/photo`, fd);
      toast.success('Foto actualizada');
      qc.invalidateQueries({ queryKey: ['items'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      etiqueta={item ? 'Editar ítem' : 'Nuevo ítem'}
      titulo={item?.name ?? 'Agregar al catálogo'}
      ancha
      pie={
        <>
          {item && (
            <Boton variante="texto" icono="basura" onClick={() => archivar.mutate()} cargando={archivar.isPending} className="mr-auto">
              Archivar
            </Boton>
          )}
          <Boton variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="check" onClick={() => guardar.mutate()} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {(Object.keys(TIPOS) as ItemType[]).map((t) => (
            <Chip key={t} activo={f.type === t} onClick={() => set('type', t)}>
              {TIPOS[t]}
            </Chip>
          ))}
        </div>
        <Campo etiqueta="Nombre" value={f.name} onChange={(e) => set('name', e.target.value)} className="sm:col-span-2" />
        <Campo etiqueta="Código" value={f.code} onChange={(e) => set('code', e.target.value)} />
        <Selector etiqueta="Marca" value={f.brandId} onChange={(e) => set('brandId', e.target.value)}>
          <option value="">Sin marca</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Selector>
        <Area etiqueta="Descripción (sale en el presupuesto)" value={f.description} onChange={(e) => set('description', e.target.value)} className="sm:col-span-2" />
        <Selector
          etiqueta="Lista de precios"
          value={f.priceListId}
          onChange={(e) => {
            const l = listas.find((x) => x.id === e.target.value);
            setF((x) => ({ ...x, priceListId: e.target.value, ...(l ? { currency: l.currency, ivaIncluded: l.ivaIncluded } : {}) }));
          }}
          className="sm:col-span-2"
        >
          <option value="">Sin lista (precio fijo)</option>
          {listas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Selector>
        <div className="flex gap-2 sm:col-span-2">
          <Chip activo={f.currency === 'ARS'} onClick={() => set('currency', 'ARS')}>
            Pesos
          </Chip>
          <Chip activo={f.currency === 'USD'} onClick={() => set('currency', 'USD')}>
            Dólares
          </Chip>
        </div>
        <Campo etiqueta={`Precio de lista (${f.currency === 'USD' ? 'U$S' : '$'})`} inputMode="decimal" value={f.listPrice} onChange={(e) => set('listPrice', e.target.value)} />
        <Campo etiqueta="Unidad" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
        <Interruptor activo={f.ivaIncluded} onCambio={(v) => set('ivaIncluded', v)} etiqueta="El precio de lista ya trae IVA" ayuda="Equipos y repuestos salen con IVA incluido. La mano de obra y los servicios salen sin IVA, salvo que el precio ya lo traiga (ej.: tarifario de servicio técnico)." />
        <div className="rounded-2xl border border-linea bg-noche p-4 sm:col-span-2">
          <p className="text-sm text-celeste">
            Regla de la lista: <b className="text-white">{lista ? `${REGLAS[lista.rule].titulo}${lista.rule !== 'PRECIO_FIJO' ? ` (${lista.percent}%)` : ''}` : 'Precio fijo'}</b>. Si este ítem lleva otra, completala acá:
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Selector etiqueta="Regla propia" value={f.ruleOverride} onChange={(e) => set('ruleOverride', e.target.value as PriceRule | '')}>
              <option value="">La de la lista</option>
              {(Object.keys(REGLAS) as PriceRule[]).map((r) => (
                <option key={r} value={r}>
                  {REGLAS[r].titulo}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="% propio" inputMode="decimal" value={f.percentOverride} onChange={(e) => set('percentOverride', e.target.value)} placeholder="El de la lista" />
          </div>
        </div>
        {item && (
          <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-linea-2 p-4 sm:col-span-2">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
              {item.photo ? <img src={item.photo.sm} alt="" className="max-h-14 max-w-14 object-contain" /> : <Icono nombre="foto" className="size-7 text-[#26324d]" />}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{item.photo ? 'Cambiar la foto' : 'Agregar una foto'}</span>
              <span className="text-sm text-humo">JPG, PNG o WebP. Sale en el presupuesto.</span>
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => subirFoto(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </Hoja>
  );
}

function Aumento({ abierta, onCerrar, marcas, listas }: { abierta: boolean; onCerrar: () => void; marcas: Brand[]; listas: PriceList[] }) {
  const qc = useQueryClient();
  const [pct, setPct] = useState('8');
  const [marca, setMarca] = useState('');
  const [lista, setLista] = useState('');
  const [tipo, setTipo] = useState<ItemType | ''>('');
  const [vista, setVista] = useState<{ total: number; changes: { id: string; name: string; before: number; after: number }[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const body = useMemo(
    () => ({ percent: Number(pct.replace(',', '.')), ...(marca && { brandId: marca }), ...(lista && { priceListId: lista }), ...(tipo && { type: tipo }) }),
    [pct, marca, lista, tipo],
  );
  useEffect(() => setVista(null), [body]);

  const correr = async (preview: boolean) => {
    setCargando(true);
    try {
      const r = await post<{ total: number; changes: { id: string; name: string; before: number; after: number }[] }>('/admin/items/bulk-percent', { ...body, preview });
      if (preview) setVista(r);
      else {
        toast.success(`Listo: ${r.total} precios actualizados`);
        qc.invalidateQueries({ queryKey: ['items'] });
        onCerrar();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      etiqueta="Para cuando llega un aumento"
      titulo="Actualizar precios por %"
      pie={
        vista ? (
          <Boton icono="check" onClick={() => correr(false)} cargando={cargando} disabled={!vista.total}>
            Aplicar a {vista.total} ítems
          </Boton>
        ) : (
          <Boton icono="ojo" onClick={() => correr(true)} cargando={cargando} disabled={!body.percent}>
            Ver qué cambia
          </Boton>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-celeste">Sube (o baja) el precio de lista. Los presupuestos ya enviados no cambian.</p>
        <div className="flex flex-wrap gap-2">
          {['5', '8', '10', '-5'].map((p) => (
            <Chip key={p} activo={pct === p} onClick={() => setPct(p)}>
              {Number(p) > 0 ? '+' : ''}
              {p}%
            </Chip>
          ))}
        </div>
        <Campo etiqueta="Porcentaje" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
        <Selector etiqueta="Marca" value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Lista" value={lista} onChange={(e) => setLista(e.target.value)}>
          <option value="">Todas</option>
          {listas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ItemType | '')}>
          <option value="">Todos</option>
          {(Object.keys(TIPOS) as ItemType[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS[t]}
            </option>
          ))}
        </Selector>
        {vista && (
          <div className="rounded-2xl border border-linea bg-noche px-4 py-2">
            <p className="py-2 font-bold text-info">{vista.total} ítems cambian</p>
            {vista.changes.map((c) => (
              <div key={c.id} className="flex justify-between gap-3 border-t border-linea py-2.5 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="tabular whitespace-nowrap">
                  <s className="text-humo">{pesos(c.before)}</s> <b>{pesos(c.after)}</b>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Hoja>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense>
      <Catalogo />
    </Suspense>
  );
}
