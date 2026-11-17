'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icono, type IconoNombre } from '@/components/Icono';
import { Area, Boton, Campo, Cargando, Chip, Etiqueta, IconoBoton, Pastilla, Tarjeta } from '@/components/ui';
import { useApi, useDolar } from '@/lib/api';
import { get, post, put } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { esProducto, pesos, TIPOS } from '@/lib/format';
import type { AjustesPresupuestos, Client, Empresa, Item, ItemType, Note, Paged, Quote, QuoteMode, Template } from '@/lib/types';

// ------------------------------------------------------------------ modelo del borrador

export interface Linea {
  key: string;
  itemId: string | null;
  type: ItemType;
  code: string | null;
  name: string;
  description: string | null;
  photo: string | null;
  unitPrice: number;
  qty: number;
  discountPct: number;
  ivaIncluded: boolean;
  usd?: boolean;
}

export interface Grupo {
  key: string;
  label: string;
  items: Linea[];
}

export interface Borrador {
  templateId: string | null;
  title: string;
  mode: QuoteMode;
  client: { id?: string | null; name: string; phone: string; email: string; zone: string; address: string };
  groups: Grupo[];
  seIncluye: string[];
  /** Notas automáticas que el usuario prendió o apagó a mano */
  notesOverride: Record<string, boolean>;
  extraNotes: string[];
  observations: string;
  validityHours: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const letra = (i: number) => `Opción ${String.fromCharCode(65 + i)}`;
const CLAVE = 'gc-borrador-nuevo';

export const vacio = (validez = 48): Borrador => ({
  templateId: null,
  title: '',
  mode: 'SUMA',
  client: { name: '', phone: '', email: '', zone: '', address: '' },
  groups: [{ key: uid(), label: 'Presupuesto', items: [] }],
  seIncluye: [],
  notesOverride: {},
  extraNotes: [],
  observations: '',
  validityHours: validez,
});

export const lineaDe = (it: Item, qty = 1): Linea => ({
  key: uid(),
  itemId: it.id,
  type: it.type,
  code: it.code,
  name: it.name,
  description: [it.brand?.name, it.description].filter(Boolean).join(' · ') || null,
  photo: it.photo?.sm ?? null,
  unitPrice: it.price.ars,
  qty,
  discountPct: 0,
  ivaIncluded: esProducto(it.type),
  usd: it.currency === 'USD',
});

/** De un presupuesto guardado al borrador del armado (para editar) */
export function desdePresupuesto(q: Quote, notas: Note[]): Borrador {
  const activas = notas.filter((n) => n.active);
  const override: Record<string, boolean> = {};
  for (const n of activas) override[n.id] = q.notes.includes(n.text);
  return {
    templateId: q.templateId,
    title: q.title,
    mode: q.mode,
    client: { id: q.client?.id ?? null, name: q.client?.name ?? '', phone: q.client?.phone ?? '', email: q.client?.email ?? '', zone: q.client?.zone ?? '', address: q.client?.address ?? '' },
    groups: q.groups.map((g) => ({
      key: uid(),
      label: g.label,
      items: g.items.map((i) => ({ key: uid(), itemId: i.itemId, type: i.type, code: i.code, name: i.name, description: i.description, photo: i.photo, unitPrice: i.unitPrice, qty: i.qty, discountPct: i.discountPct, ivaIncluded: i.ivaIncluded, usd: i.usd })),
    })),
    seIncluye: q.seIncluye,
    notesOverride: override,
    extraNotes: q.notes.filter((t) => !activas.some((n) => n.text === t)),
    observations: q.observations ?? '',
    validityHours: q.validityHours,
  };
}

const totalLinea = (l: Linea) => Math.round(l.unitPrice * l.qty * (1 - (l.discountPct || 0) / 100));
const totalGrupo = (g: Grupo) => g.items.reduce((a, l) => a + totalLinea(l), 0);

/** Qué aclaraciones van según lo que tiene el presupuesto */
function notaAplica(n: Note, b: Borrador) {
  const lineas = b.groups.flatMap((g) => g.items);
  const productos = lineas.some((l) => esProducto(l.type));
  const manoDeObra = lineas.some((l) => !esProducto(l.type));
  switch (n.rule) {
    case 'SIEMPRE':
      return true;
    case 'SI_PRODUCTOS':
      return productos;
    case 'SI_MANO_DE_OBRA':
      return manoDeObra;
    case 'SI_SIN_INSTALACION':
      return productos && !manoDeObra;
    default:
      return false;
  }
}

function useDebounce<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

const ICONO_TIPO: Record<ItemType, IconoNombre> = { EQUIPO: 'instalacion', REPUESTO: 'llave', MATERIAL: 'caja', MANO_DE_OBRA: 'usuario', SERVICIO: 'mantenimiento' };

const PASOS = ['Cliente', 'Equipos y trabajos', 'Revisar y enviar'] as const;

// ------------------------------------------------------------------ armado en 3 pasos

export function Armador({ editar, plantillaInicial, clienteInicial }: { editar?: Quote; plantillaInicial?: string | null; clienteInicial?: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const plantillas = useApi<Template[]>(['templates'], '/templates');
  const notas = useApi<Note[]>(['notes'], '/notes');
  const company = useApi<{ empresa: Empresa; presupuestos: AjustesPresupuestos }>(['company'], '/company');
  const dolar = useDolar();

  const [b, setB] = useState<Borrador | null>(null);
  const [paso, setPaso] = useState(0);
  const [grupoActivo, setGrupoActivo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [recuperado, setRecuperado] = useState(false);
  const arriba = useRef<HTMLDivElement>(null);

  // Arranque: editar, plantilla del link, borrador guardado o en blanco
  useEffect(() => {
    if (b || !notas.data || !plantillas.data || !company.data) return;
    if (editar) {
      setB(desdePresupuesto(editar, notas.data));
      return;
    }
    const base = vacio(company.data.presupuestos.validezHoras);
    if (!plantillaInicial && !clienteInicial) {
      try {
        const raw = localStorage.getItem(CLAVE);
        if (raw) {
          const prev = JSON.parse(raw) as Borrador;
          if (prev.groups?.some((g) => g.items.length) || prev.client?.name) {
            setB({ ...base, ...prev });
            setRecuperado(true);
            return;
          }
        }
      } catch {
        /* sin almacenamiento: arranca en blanco */
      }
    }
    setB(base);
    const t = plantillas.data.find((p) => p.slug === plantillaInicial);
    if (t) void aplicarPlantilla(t, base);
    if (clienteInicial)
      get<Client>(`/clients/${clienteInicial}`)
        .then((c) => setB((p) => (p ? { ...p, client: { id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', zone: c.zone ?? '', address: c.address ?? '' } } : p)))
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notas.data, plantillas.data, company.data, editar]);

  // Borrador automático (solo para presupuestos nuevos)
  useEffect(() => {
    if (!b || editar) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(b));
      } catch {
        /* nada */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [b, editar]);

  const set = (fn: (prev: Borrador) => Borrador) => setB((p) => (p ? fn(p) : p));

  async function aplicarPlantilla(t: Template, actual?: Borrador) {
    const cur = actual ?? b;
    if (!cur) return;
    const tieneItems = cur.groups.some((g) => g.items.length);
    let lineas: Linea[] = [];
    if (!tieneItems && t.items.length) {
      try {
        const r = await get<Paged<Item>>(`/items?active=all&limit=50&ids=${t.items.map((i) => i.item.id).join(',')}`);
        const porId = new Map(r.items.map((i) => [i.id, i]));
        lineas = t.items.map((ti) => porId.get(ti.item.id)).filter((x): x is Item => !!x).map((it, n) => lineaDe(it, t.items[n]?.qty ?? 1));
      } catch {
        toast.error('No pude traer los equipos de la plantilla. Agregalos desde el buscador.');
      }
    }
    setB((p) => {
      const prev = p ?? cur;
      const groups =
        tieneItems || !lineas.length
          ? prev.mode === t.mode
            ? prev.groups
            : t.mode === 'SUMA'
              ? [{ key: uid(), label: 'Presupuesto', items: prev.groups.flatMap((g) => g.items) }]
              : prev.groups.map((g, i) => ({ ...g, label: letra(i) }))
          : t.mode === 'COMPARATIVA'
            ? lineas.map((l, i) => ({ key: uid(), label: letra(i), items: [l] }))
            : [{ key: uid(), label: 'Presupuesto', items: lineas }];
      return { ...prev, templateId: t.id, title: t.title, mode: t.mode, seIncluye: [...t.seIncluye], groups };
    });
    setGrupoActivo(0);
    if (tieneItems && t.items.length) toast('Cambié la plantilla. Los equipos que ya cargaste quedaron igual.');
  }

  const notasActivas = useMemo(() => (notas.data ?? []).filter((n) => n.active), [notas.data]);
  const notasFinales = useMemo(() => {
    if (!b) return [];
    const auto = notasActivas.filter((n) => b.notesOverride[n.id] ?? notaAplica(n, b)).map((n) => n.text);
    return [...auto, ...b.extraNotes.map((t) => t.trim()).filter(Boolean)];
  }, [b, notasActivas]);

  if (!b || !company.data) return <Cargando texto="Preparando el presupuesto…" />;

  const lineas = b.groups.flatMap((g) => g.items);
  const comparativa = b.mode === 'COMPARATIVA';
  const grupo = b.groups[Math.min(grupoActivo, b.groups.length - 1)];
  const sinDolar = lineas.some((l) => l.usd && !l.unitPrice);

  const irA = (n: number) => {
    if (n > paso && paso === 0 && b.client.name.trim().length < 2) {
      toast.error('Poné el nombre del cliente para seguir.');
      return;
    }
    if (n > paso && paso === 1 && !lineas.length) {
      toast.error('Agregá al menos un equipo o un trabajo.');
      return;
    }
    if (n === 2 && !b.title.trim()) set((p) => ({ ...p, title: comparativa ? 'Comparativa de opciones' : lineas[0]?.name ?? 'Presupuesto' }));
    setPaso(n);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cambiarModo = (m: QuoteMode) =>
    set((p) => {
      if (p.mode === m) return p;
      if (m === 'SUMA') return { ...p, mode: m, groups: [{ key: uid(), label: 'Presupuesto', items: p.groups.flatMap((g) => g.items) }] };
      const items = p.groups.flatMap((g) => g.items);
      return { ...p, mode: m, groups: items.length > 1 ? items.map((l, i) => ({ key: uid(), label: letra(i), items: [l] })) : [{ key: uid(), label: letra(0), items }, { key: uid(), label: letra(1), items: [] }] };
    });

  const setGrupo = (key: string, fn: (g: Grupo) => Grupo) => set((p) => ({ ...p, groups: p.groups.map((g) => (g.key === key ? fn(g) : g)) }));
  const setLinea = (gk: string, lk: string, cambio: Partial<Linea>) => setGrupo(gk, (g) => ({ ...g, items: g.items.map((l) => (l.key === lk ? { ...l, ...cambio } : l)) }));
  const agregar = (l: Linea) => {
    setGrupo(grupo.key, (g) => ({ ...g, items: [...g.items, l] }));
    toast.success(`Agregado${comparativa ? ` a ${grupo.label}` : ''}: ${l.name || TIPOS[l.type]}`);
  };

  async function guardar() {
    if (!b) return;
    if (b.client.name.trim().length < 2) {
      setPaso(0);
      toast.error('Falta el nombre del cliente.');
      return;
    }
    if (lineas.some((l) => !l.name.trim())) {
      setPaso(1);
      toast.error('Hay un ítem sin nombre. Completalo o borralo.');
      return;
    }
    setGuardando(true);
    const body = {
      client: { ...b.client, id: b.client.id || undefined },
      templateId: b.templateId,
      title: b.title.trim() || 'Presupuesto',
      mode: b.mode,
      groups: (comparativa ? b.groups.filter((g) => g.items.length) : b.groups.slice(0, 1)).map((g, i) => ({
        label: comparativa ? g.label.trim() || letra(i) : 'Presupuesto',
        items: g.items.map(({ key: _k, photo: _p, usd: _u, ...l }) => ({ ...l, name: l.name.trim(), unitPrice: Math.round(l.unitPrice) || 0, qty: l.qty || 1 })),
      })),
      seIncluye: b.seIncluye.map((s) => s.trim()).filter(Boolean),
      notes: notasFinales,
      observations: b.observations.trim() || null,
      validityHours: b.validityHours || 48,
    };
    try {
      const q = editar ? await put<Quote>(`/quotes/${editar.id}`, body) : await post<Quote>('/quotes', body);
      try {
        if (!editar) localStorage.removeItem(CLAVE);
      } catch {
        /* nada */
      }
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.setQueryData(['quote', q.id], q);
      toast.success(editar ? `Guardé los cambios del N° ${q.numberLabel}` : `Listo el presupuesto N° ${q.numberLabel}`);
      router.push(`/presupuestos/${q.id}${editar ? '' : '?listo=1'}`);
    } catch (e) {
      toast.error((e as Error).message);
      setGuardando(false);
    }
  }

  const empezarDeCero = () => {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada */
    }
    setB(vacio(company.data!.presupuestos.validezHoras));
    setRecuperado(false);
    setPaso(0);
  };

  return (
    <div ref={arriba} className="flex scroll-mt-24 flex-col gap-6">
      {/* Encabezado y progreso frío → calor */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Etiqueta>
              Paso {paso + 1} de 3 · {PASOS[paso]}
            </Etiqueta>
            <h1 className="titular text-[2.1rem] sm:text-4xl md:text-5xl">{editar ? `Editar N° ${editar.numberLabel}` : 'Nuevo presupuesto'}</h1>
          </div>
          {recuperado && !editar && (
            <div className="flex items-center gap-2 rounded-2xl border border-linea bg-marino px-3 py-2 text-sm text-celeste">
              Seguís con el borrador que dejaste a medias.
              <button type="button" onClick={empezarDeCero} className="font-semibold text-white underline-offset-4 hover:underline">
                Empezar de cero
              </button>
            </div>
          )}
        </div>
        <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p}>
              <button type="button" onClick={() => (i < paso ? irA(i) : i > paso ? irA(i) : undefined)} className="flex w-full flex-col gap-2 text-left">
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-marino-2">
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{ width: i <= paso ? '100%' : '0%', background: 'linear-gradient(90deg, #3371D1, #E3322A)', backgroundSize: '300% 100%', backgroundPosition: `${i * 50}% 0` }}
                  />
                </span>
                <span className={cn('text-xs sm:text-sm', i === paso ? 'font-bold text-white' : 'text-humo')}>{p}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {paso === 0 && <PasoCliente b={b} set={set} plantillas={plantillas.data ?? []} aplicarPlantilla={aplicarPlantilla} zonas={company.data.empresa.zonas} editando={!!editar} />}

      {paso === 1 && (
        <div className="flex flex-col gap-5">
          <Tarjeta className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="titular-medio text-xl">¿Cómo lo armás?</p>
                <p className="text-sm text-celeste">{comparativa ? 'Cada opción tiene su precio; el cliente elige una.' : 'Todo suma un solo total.'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip activo={!comparativa} icono="suma" onClick={() => cambiarModo('SUMA')}>
                  Una opción
                </Chip>
                <Chip activo={comparativa} icono="columnas" onClick={() => cambiarModo('COMPARATIVA')}>
                  Comparativa
                </Chip>
              </div>
            </div>
            {comparativa && (
              <div className="flex flex-wrap items-center gap-2">
                {b.groups.map((g, i) => (
                  <Chip key={g.key} activo={i === grupoActivo} onClick={() => setGrupoActivo(i)}>
                    {g.label || letra(i)}
                    <span className="tabular text-xs text-humo">{pesos(totalGrupo(g))}</span>
                  </Chip>
                ))}
                {b.groups.length < 6 && (
                  <Chip
                    icono="mas"
                    onClick={() => {
                      set((p) => ({ ...p, groups: [...p.groups, { key: uid(), label: letra(p.groups.length), items: [] }] }));
                      setGrupoActivo(b.groups.length);
                    }}
                  >
                    Otra opción
                  </Chip>
                )}
              </div>
            )}
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {comparativa ? (
                <div className="flex min-w-[10rem] flex-1 items-center gap-2">
                  <input
                    value={grupo.label}
                    onChange={(e) => setGrupo(grupo.key, (g) => ({ ...g, label: e.target.value }))}
                    aria-label="Nombre de la opción"
                    className="titular-medio min-w-0 flex-1 rounded-lg bg-transparent px-1 text-2xl outline-none focus:bg-noche"
                  />
                  {b.groups.length > 1 && (
                    <IconoBoton
                      icono="basura"
                      etiqueta="Borrar esta opción"
                      onClick={() => {
                        set((p) => ({ ...p, groups: p.groups.filter((g) => g.key !== grupo.key).map((g, i) => ({ ...g, label: /^Opción [A-Z]$/.test(g.label) ? letra(i) : g.label })) }));
                        setGrupoActivo(0);
                      }}
                    />
                  )}
                </div>
              ) : (
                <p className="titular-medio text-2xl">Equipos y trabajos</p>
              )}
              <p className="titular tabular text-xl sm:text-2xl">{pesos(totalGrupo(grupo))}</p>
            </div>

            {grupo.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-linea-2 px-4 py-6 text-center text-sm text-celeste">
                Todavía no hay nada{comparativa ? ` en ${grupo.label}` : ''}. Buscá un equipo o repuesto abajo, o sumá mano de obra.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-linea">
                {grupo.items.map((l) => (
                  <FilaLinea key={l.key} l={l} cambiar={(c) => setLinea(grupo.key, l.key, c)} quitar={() => setGrupo(grupo.key, (g) => ({ ...g, items: g.items.filter((x) => x.key !== l.key) }))} />
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton variante="suave" icono="usuario" onClick={() => agregar({ key: uid(), itemId: null, type: 'MANO_DE_OBRA', code: null, name: 'Instalación', description: null, photo: null, unitPrice: 0, qty: 1, discountPct: 0, ivaIncluded: false })}>
                Mano de obra
              </Boton>
              <Boton variante="suave" icono="mantenimiento" onClick={() => agregar({ key: uid(), itemId: null, type: 'SERVICIO', code: null, name: 'Service', description: null, photo: null, unitPrice: 0, qty: 1, discountPct: 0, ivaIncluded: false })}>
                Servicio
              </Boton>
              <Boton variante="suave" icono="caja" onClick={() => agregar({ key: uid(), itemId: null, type: 'MATERIAL', code: null, name: '', description: null, photo: null, unitPrice: 0, qty: 1, discountPct: 0, ivaIncluded: true })}>
                Ítem libre
              </Boton>
            </div>
          </Tarjeta>

          <BuscadorCatalogo onElegir={(it) => agregar(lineaDe(it))} destino={comparativa ? grupo.label : undefined} />
          {sinDolar && <p className="text-sm text-alerta">Hay equipos en dólares sin precio porque no hay dólar cargado. Cargalo en Administración → Empresa y dólar.</p>}
        </div>
      )}

      {paso === 2 && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <Tarjeta className="flex flex-col gap-4">
              <Campo etiqueta="Título del presupuesto" value={b.title} onChange={(e) => set((p) => ({ ...p, title: e.target.value }))} placeholder="Comparativa de calderas Peisa 24 tiro forzado" maxLength={160} />
              <div className="flex flex-col gap-2">
                {b.groups
                  .filter((g) => g.items.length)
                  .map((g) => (
                    <div key={g.key} className="flex flex-col gap-1.5 rounded-2xl border border-linea bg-noche/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{comparativa ? g.label : 'Total'}</p>
                        <p className="titular tabular text-xl">{pesos(totalGrupo(g))}</p>
                      </div>
                      <p className="text-sm text-celeste">{g.items.map((l) => (l.qty !== 1 ? `${l.qty} × ${l.name}` : l.name)).join(' · ')}</p>
                    </div>
                  ))}
              </div>
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-3">
              <p className="titular-medio text-xl">Se incluye</p>
              <ListaEditable items={b.seIncluye} cambiar={(v) => set((p) => ({ ...p, seIncluye: v }))} placeholder="Ej.: Puesta en marcha" />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-3">
              <div>
                <p className="titular-medio text-xl">Aclaraciones</p>
                <p className="text-sm text-celeste">Se prenden solas según lo que cargaste. Podés sacar o sumar las que quieras.</p>
              </div>
              <ul className="flex flex-col gap-1">
                {notasActivas.map((n) => {
                  const on = b.notesOverride[n.id] ?? notaAplica(n, b);
                  return (
                    <li key={n.id}>
                      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 hover:bg-white/5">
                        <input type="checkbox" checked={on} onChange={(e) => set((p) => ({ ...p, notesOverride: { ...p.notesOverride, [n.id]: e.target.checked } }))} className="mt-0.5 size-5 shrink-0 accent-[#3371D1]" />
                        <span className={cn('text-[0.95rem]', on ? 'text-white' : 'text-humo')}>{n.text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <ListaEditable items={b.extraNotes} cambiar={(v) => set((p) => ({ ...p, extraNotes: v }))} placeholder="Otra aclaración para este presupuesto" />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <Area etiqueta="Observaciones (opcional)" value={b.observations} onChange={(e) => set((p) => ({ ...p, observations: e.target.value }))} placeholder="Ej.: la instalación se coordina una vez confirmado." maxLength={2000} />
              <Campo
                etiqueta="Validez (horas)"
                type="number"
                inputMode="numeric"
                min={1}
                value={b.validityHours}
                onChange={(e) => set((p) => ({ ...p, validityHours: Math.max(1, Number(e.target.value) || 48) }))}
                className="max-w-40"
              />
            </Tarjeta>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <Tarjeta className="flex flex-col gap-3">
              <Etiqueta className="text-humo">Para</Etiqueta>
              <p className="titular-medio text-xl">{b.client.name || 'Sin nombre'}</p>
              <p className="text-sm text-celeste">{[b.client.phone, b.client.zone, b.client.address].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
              {!b.client.phone && <p className="text-sm text-alerta">Sin WhatsApp: al enviarlo vas a tener que elegir el contacto a mano.</p>}
              {lineas.some((l) => l.usd) && dolar.data?.venta && <p className="text-sm text-celeste">Precios en dólares pasados a pesos con el dólar BNA venta de {pesos(dolar.data.venta)}.</p>}
            </Tarjeta>
            <Boton grande icono="doc" cargando={guardando} onClick={guardar}>
              {editar ? 'Guardar cambios' : 'Guardar y ver el presupuesto'}
            </Boton>
            <p className="text-center text-sm text-humo">En el siguiente paso lo mandás por WhatsApp o bajás el PDF.</p>
          </aside>
        </div>
      )}

      {/* Barra fija con el total y la navegación */}
      <div className="sticky bottom-24 z-30 flex items-center gap-3 rounded-2xl border border-linea bg-marino/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur lg:bottom-4">
        {paso > 0 ? (
          <Boton variante="contorno" icono="atras" onClick={() => irA(paso - 1)}>
            <span className="hidden sm:inline">Atrás</span>
          </Boton>
        ) : (
          <span />
        )}
        <div className="min-w-0 flex-1 text-right">
          {comparativa ? (
            <p className="truncate text-sm text-celeste">
              {b.groups.filter((g) => g.items.length).map((g) => `${g.label.replace('Opción ', '')}: ${pesos(totalGrupo(g))}`).join(' · ') || 'Sin opciones todavía'}
            </p>
          ) : (
            <>
              <p className="etiqueta text-humo">Total</p>
              <p className="titular tabular text-2xl">{pesos(totalGrupo(b.groups[0]))}</p>
            </>
          )}
        </div>
        {paso < 2 ? (
          <Boton icono="flecha" onClick={() => irA(paso + 1)}>
            Siguiente
          </Boton>
        ) : (
          <Boton icono="check" cargando={guardando} onClick={guardar}>
            Guardar
          </Boton>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ paso 1

function PasoCliente({
  b,
  set,
  plantillas,
  aplicarPlantilla,
  zonas,
  editando,
}: {
  b: Borrador;
  set: (fn: (p: Borrador) => Borrador) => void;
  plantillas: Template[];
  aplicarPlantilla: (t: Template) => void;
  zonas: string[];
  editando: boolean;
}) {
  const [busca, setBusca] = useState('');
  const q = useDebounce(busca);
  const sugeridos = useApi<Client[]>(['clients', q], `/clients?q=${encodeURIComponent(q)}`, { enabled: q.trim().length >= 2 });
  const setCliente = (c: Partial<Borrador['client']>) => set((p) => ({ ...p, client: { ...p.client, ...c } }));

  return (
    <div className="flex flex-col gap-5">
      {!editando && (
        <Tarjeta className="flex flex-col gap-4">
          <div>
            <p className="titular-medio text-xl">¿Qué vas a presupuestar?</p>
            <p className="text-sm text-celeste">La plantilla trae los equipos, lo que incluye y las aclaraciones. Después cambiás lo que quieras.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {plantillas
              .filter((t) => t.active)
              .map((t) => {
                const on = b.templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => aplicarPlantilla(t)}
                    className={cn(
                      'flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]',
                      on ? 'border-rojo bg-rojo/15 shadow-[0_0_0_1px_var(--color-rojo)]' : 'border-linea bg-marino-2/60 hover:border-celeste/50',
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
                      <Icono nombre={t.icon as IconoNombre} className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-humo">{t.mode === 'COMPARATIVA' ? 'Comparativa de opciones' : t.items.length ? `${t.items.length} equipo${t.items.length === 1 ? '' : 's'} sugerido${t.items.length === 1 ? '' : 's'}` : 'Una opción'}</span>
                    </span>
                    {on && <Icono nombre="check" className="ml-auto size-5 shrink-0 text-white" />}
                  </button>
                );
              })}
            <button
              type="button"
              onClick={() => set((p) => ({ ...p, templateId: null }))}
              className={cn('flex min-h-16 items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-left transition', !b.templateId ? 'border-celeste/60 text-white' : 'border-linea-2 text-celeste hover:text-white')}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
                <Icono nombre="doc" className="size-5" />
              </span>
              <span className="font-semibold">En blanco</span>
            </button>
          </div>
        </Tarjeta>
      )}

      <Tarjeta className="flex flex-col gap-4">
        <div>
          <p className="titular-medio text-xl">Cliente</p>
          <p className="text-sm text-celeste">Buscalo si ya te pidió antes, o cargalo nuevo: queda guardado para la próxima.</p>
        </div>
        {!b.client.id && (
          <div className="relative">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-linea bg-noche px-3.5 text-humo focus-within:border-azul">
              <Icono nombre="buscar" className="size-[1.1rem]" />
              <span className="sr-only">Buscar cliente</span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o teléfono" className="min-w-0 flex-1 bg-transparent py-2.5 text-white outline-none placeholder:text-humo focus-visible:outline-none" />
            </label>
            {q.trim().length >= 2 && (sugeridos.data?.length ?? 0) > 0 && (
              <ul className="mt-2 flex flex-col overflow-hidden rounded-xl border border-linea bg-marino-2">
                {sugeridos.data!.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCliente({ id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', zone: c.zone ?? '', address: c.address ?? '' });
                        setBusca('');
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-sm text-humo">{[c.phone, c.zone].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {b.client.id && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-azul/50 bg-azul/10 px-4 py-3 text-sm">
            <span>Cliente guardado. Si cambiás un dato, se actualiza su ficha.</span>
            <button type="button" className="font-semibold text-celeste hover:text-white" onClick={() => setCliente({ id: null, name: '', phone: '', email: '', zone: '', address: '' })}>
              Otro cliente
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre *" value={b.client.name} onChange={(e) => setCliente({ name: e.target.value })} placeholder="Ej.: Aldo Cufré" autoComplete="off" />
          <Campo etiqueta="WhatsApp" type="tel" inputMode="tel" value={b.client.phone} onChange={(e) => setCliente({ phone: e.target.value })} placeholder="Ej.: 2255 48-5539" autoComplete="off" />
          <Campo etiqueta="Dirección" value={b.client.address} onChange={(e) => setCliente({ address: e.target.value })} placeholder="Calle, número, barrio" autoComplete="off" />
          <Campo etiqueta="Email (opcional)" type="email" value={b.client.email} onChange={(e) => setCliente({ email: e.target.value })} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="etiqueta text-humo">Zona</span>
          <div className="flex flex-wrap gap-2">
            {zonas.map((z) => (
              <Chip key={z} activo={b.client.zone === z} onClick={() => setCliente({ zone: b.client.zone === z ? '' : z })}>
                {z}
              </Chip>
            ))}
            <input
              value={zonas.includes(b.client.zone) ? '' : b.client.zone}
              onChange={(e) => setCliente({ zone: e.target.value })}
              placeholder="Otra zona"
              className="min-h-11 w-40 rounded-xl border border-linea bg-noche px-3.5 text-[0.95rem] text-white outline-none placeholder:text-humo focus:border-azul"
            />
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

// ------------------------------------------------------------------ paso 2

function FilaLinea({ l, cambiar, quitar }: { l: Linea; cambiar: (c: Partial<Linea>) => void; quitar: () => void }) {
  const [precio, setPrecio] = useState(l.unitPrice ? String(l.unitPrice) : '');
  useEffect(() => setPrecio(l.unitPrice ? String(l.unitPrice) : ''), [l.unitPrice]);
  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {l.photo ? (
          <img src={l.photo} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-noche text-celeste">
            <Icono nombre={ICONO_TIPO[l.type]} className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {l.itemId ? (
            <p className="font-semibold leading-snug">{l.name}</p>
          ) : (
            <input
              value={l.name}
              onChange={(e) => cambiar({ name: e.target.value })}
              placeholder={l.type === 'MANO_DE_OBRA' ? 'Ej.: Instalación de caldera' : 'Describí el ítem'}
              aria-label="Nombre del ítem"
              className="min-h-10 rounded-lg border border-linea bg-noche px-2.5 font-semibold text-white outline-none placeholder:font-normal placeholder:text-humo focus:border-azul"
              autoFocus={!l.name}
            />
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-humo">
            <span>{TIPOS[l.type]}</span>
            {l.code && <span>· {l.code}</span>}
            {l.usd && <Pastilla tono="azul">U$S al dólar de hoy</Pastilla>}
            {!esProducto(l.type) && <span>· sin IVA (+ IVA si factura)</span>}
          </p>
        </div>
        <IconoBoton icono="basura" etiqueta="Quitar" onClick={quitar} className="sm:hidden" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-linea bg-noche">
          <button type="button" aria-label="Menos" onClick={() => cambiar({ qty: Math.max(1, Math.round((l.qty - 1) * 100) / 100) })} className="grid size-10 place-items-center text-celeste hover:text-white">
            −
          </button>
          <input
            value={l.qty}
            onChange={(e) => {
              const v = Number(e.target.value.replace(',', '.'));
              if (!Number.isNaN(v)) cambiar({ qty: v });
            }}
            onBlur={() => !l.qty && cambiar({ qty: 1 })}
            inputMode="decimal"
            aria-label="Cantidad"
            className="tabular w-10 bg-transparent text-center outline-none focus-visible:outline-none"
          />
          <button type="button" aria-label="Más" onClick={() => cambiar({ qty: Math.round((l.qty + 1) * 100) / 100 })} className="grid size-10 place-items-center text-celeste hover:text-white">
            +
          </button>
        </div>
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-1 rounded-xl border border-linea bg-noche px-2.5 focus-within:border-azul sm:flex-none">
          <span className="text-humo">$</span>
          <span className="sr-only">Precio unitario</span>
          <input
            value={precio ? Number(precio).toLocaleString('es-AR') : ''}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(0, 10);
              setPrecio(d);
              cambiar({ unitPrice: Number(d) || 0 });
            }}
            inputMode="numeric"
            placeholder="0"
            className="tabular w-full min-w-0 bg-transparent text-right outline-none placeholder:text-humo focus-visible:outline-none sm:w-28"
          />
        </label>
        <p className={cn('tabular shrink-0 text-right text-sm font-bold sm:block sm:min-w-28 sm:text-base', l.qty === 1 && !l.discountPct && 'hidden')}>{pesos(totalLinea(l))}</p>
        <IconoBoton icono="basura" etiqueta="Quitar" onClick={quitar} className="hidden sm:grid" />
      </div>
    </li>
  );
}

export function BuscadorCatalogo({ onElegir, destino }: { onElegir: (it: Item) => void; destino?: string }) {
  const [q, setQ] = useState('');
  const qd = useDebounce(q);
  const res = useApi<Paged<Item>>(['items', 'buscar', qd], `/items?limit=12&q=${encodeURIComponent(qd)}`, { enabled: qd.trim().length >= 2 });
  return (
    <Tarjeta className="flex flex-col gap-3">
      <div>
        <p className="titular-medio text-xl">Buscar en el catálogo</p>
        <p className="text-sm text-celeste">Por código, nombre o marca: «diva 24», «10000204», «minibox». Tocá para sumarlo{destino ? ` a ${destino}` : ''}.</p>
      </div>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-linea bg-noche px-3.5 text-humo focus-within:border-azul">
        <Icono nombre="buscar" className="size-[1.1rem]" />
        <span className="sr-only">Buscar equipo o repuesto</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, nombre o marca" className="min-w-0 flex-1 bg-transparent py-2.5 text-white outline-none placeholder:text-humo focus-visible:outline-none" />
      </label>
      {qd.trim().length >= 2 && (
        <div className="flex flex-col gap-1">
          {res.isLoading && <p className="px-1 py-3 text-sm text-celeste">Buscando…</p>}
          {res.data && res.data.items.length === 0 && <p className="px-1 py-3 text-sm text-celeste">No encontré nada con «{qd}». Probá con el código o una palabra más corta.</p>}
          {res.data?.items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onElegir(it)}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-linea hover:bg-white/5 active:scale-[0.99]"
            >
              {it.photo ? (
                <img src={it.photo.sm} alt="" className="size-11 shrink-0 rounded-lg bg-white object-contain p-0.5" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-noche text-celeste">
                  <Icono nombre={ICONO_TIPO[it.type]} className="size-5" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold leading-snug">{it.name}</span>
                <span className="text-xs text-humo">{[it.code, it.brand?.name, TIPOS[it.type]].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="tabular font-bold">{it.price.needsDollar ? 'Sin dólar' : pesos(it.price.ars)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-celeste">
                  <Icono nombre="mas" className="size-3.5" />
                  Sumar
                </span>
              </span>
            </button>
          ))}
          {res.data && res.data.total > res.data.items.length && <p className="px-1 pt-1 text-xs text-humo">Hay {res.data.total} resultados: escribí algo más para achicar la búsqueda.</p>}
        </div>
      )}
    </Tarjeta>
  );
}

// ------------------------------------------------------------------ paso 3

function ListaEditable({ items, cambiar, placeholder }: { items: string[]; cambiar: (v: string[]) => void; placeholder: string }) {
  const [nuevo, setNuevo] = useState('');
  const sumar = () => {
    if (!nuevo.trim()) return;
    cambiar([...items, nuevo.trim()]);
    setNuevo('');
  };
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((t, i) => (
            <li key={`${i}-${t}`} className="flex items-center gap-2 rounded-xl bg-noche/50 py-1 pl-3 pr-1">
              <Icono nombre="check" className="size-4 shrink-0 text-info" />
              <input value={t} onChange={(e) => cambiar(items.map((x, k) => (k === i ? e.target.value : x)))} className="min-h-10 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none focus-visible:outline-none" aria-label="Texto" />
              <IconoBoton icono="cerrar" etiqueta="Quitar" onClick={() => cambiar(items.filter((_, k) => k !== i))} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sumar();
            }
          }}
          placeholder={placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-linea bg-noche px-3.5 text-[0.95rem] text-white outline-none placeholder:text-humo focus:border-azul"
        />
        <Boton variante="suave" icono="mas" onClick={sumar} disabled={!nuevo.trim()}>
          Sumar
        </Boton>
      </div>
    </div>
  );
}
