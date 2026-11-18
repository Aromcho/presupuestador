'use client';

import { useState } from 'react';
import { Icono, type IconoNombre } from '@/components/Icono';
import { Boton, Cabecera, Campo, Cargando, Chip, Hoja, IconoBoton, Interruptor, Selector, Tarjeta } from '@/components/ui';
import { useAccion, useApi } from '@/lib/api';
import { NOTA_REGLAS, pesos } from '@/lib/format';
import type { Item, Note, NoteRule, Paged, Template } from '@/lib/types';

const ICONOS: { id: IconoNombre; t: string }[] = [
  { id: 'instalacion', t: 'Caldera mural' },
  { id: 'caldera_pie', t: 'Caldera de pie' },
  { id: 'piscina', t: 'Piscina' },
  { id: 'radiador', t: 'Radiadores' },
  { id: 'mantenimiento', t: 'Service' },
  { id: 'temporada', t: 'Temporada' },
  { id: 'columnas', t: 'Comparativa' },
  { id: 'llave', t: 'Reparación' },
  { id: 'llama', t: 'Gas' },
];

export default function Plantillas() {
  const plantillas = useApi<Template[]>(['templates'], '/templates');
  const notas = useApi<Note[]>(['notes'], '/notes');
  const [editando, setEditando] = useState<Template | 'nueva' | null>(null);

  return (
    <>
      <Cabecera
        volver={{ href: '/admin', texto: 'Administración' }}
        etiqueta="Plantillas y notas"
        titulo="Plantillas"
        bajada="Cada plantilla trae sus equipos y lo que incluye la venta. Las notas se agregan solas según lo que lleve el presupuesto."
        acciones={
          <Boton icono="mas" onClick={() => setEditando('nueva')}>
            Nueva plantilla
          </Boton>
        }
      />
      {plantillas.isLoading ? (
        <Cargando />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {plantillas.data?.map((t) => (
            <button key={t.id} type="button" onClick={() => setEditando(t)} className={`flex flex-col gap-3 rounded-2xl border border-linea bg-marino p-5 text-left transition hover:border-celeste/40 ${t.active ? '' : 'opacity-60'}`}>
              <span className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-noche text-celeste">
                  <Icono nombre={t.icon as IconoNombre} />
                </span>
                <span>
                  <span className="titular-medio block text-lg">{t.name}</span>
                  <span className="text-sm text-humo">{t.mode === 'COMPARATIVA' ? 'Comparativa' : 'Una opción'} · {t.items.length} ítems</span>
                </span>
              </span>
              {t.seIncluye.length > 0 ? <span className="text-sm text-celeste">Incluye: {t.seIncluye.join(' · ')}</span> : <span className="text-sm text-humo">Sin «Se incluye» cargado</span>}
              {t.notes?.length > 0 && <span className="text-sm text-humo">Aclaraciones: {t.notes.join(' · ')}</span>}
            </button>
          ))}
        </div>
      )}

      <Notas notas={notas.data ?? []} />
      {editando && <EditarPlantilla plantilla={editando === 'nueva' ? null : editando} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function Notas({ notas }: { notas: Note[] }) {
  const [texto, setTexto] = useState('');
  const [regla, setRegla] = useState<NoteRule>('SIEMPRE');
  const crear = useAccion<void>({ method: 'POST', path: '/admin/notes', body: () => ({ text: texto, rule: regla, sortOrder: notas.length }), invalidate: [['notes']], success: 'Nota agregada', onSuccess: () => setTexto('') });
  const editar = useAccion<Note>({ method: 'PATCH', path: (n) => `/admin/notes/${n.id}`, body: (n) => ({ text: n.text, rule: n.rule, active: n.active, sortOrder: n.sortOrder }), invalidate: [['notes']] });
  const borrar = useAccion<string>({ method: 'DELETE', path: (id) => `/admin/notes/${id}`, invalidate: [['notes']], success: 'Nota borrada' });

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div>
        <h2 className="titular-medio text-2xl">Notas y aclaraciones</h2>
        <p className="mt-1 text-sm text-celeste">Van al pie del presupuesto. Cada una tiene su regla: por ejemplo, «Precios finales, IVA incluido» solo si hay equipos.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {notas.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-linea bg-marino-2 p-3">
            <input
              defaultValue={n.text}
              aria-label="Texto de la nota"
              onBlur={(e) => e.target.value !== n.text && editar.mutate({ ...n, text: e.target.value })}
              className="min-h-11 min-w-0 flex-[1_1_280px] rounded-xl border border-transparent bg-transparent px-2 outline-none focus:border-azul"
            />
            <select
              aria-label="Cuándo va"
              value={n.rule}
              onChange={(e) => editar.mutate({ ...n, rule: e.target.value as NoteRule })}
              className="min-h-11 rounded-xl border border-linea bg-noche px-3 text-sm text-celeste"
            >
              {(Object.keys(NOTA_REGLAS) as NoteRule[]).map((r) => (
                <option key={r} value={r}>
                  {NOTA_REGLAS[r]}
                </option>
              ))}
            </select>
            <Interruptor activo={n.active} onCambio={(v) => editar.mutate({ ...n, active: v })} etiqueta="Activa" />
            <IconoBoton icono="basura" etiqueta="Borrar nota" onClick={() => borrar.mutate(n.id)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Nueva nota" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Garantía oficial de fábrica." className="flex-[1_1_280px]" />
        <Selector etiqueta="Cuándo va" value={regla} onChange={(e) => setRegla(e.target.value as NoteRule)}>
          {(Object.keys(NOTA_REGLAS) as NoteRule[]).map((r) => (
            <option key={r} value={r}>
              {NOTA_REGLAS[r]}
            </option>
          ))}
        </Selector>
        <Boton variante="suave" icono="mas" onClick={() => crear.mutate()} cargando={crear.isPending} disabled={texto.trim().length < 3}>
          Agregar
        </Boton>
      </div>
    </Tarjeta>
  );
}

function EditarPlantilla({ plantilla, onCerrar }: { plantilla: Template | null; onCerrar: () => void }) {
  const [f, setF] = useState({
    name: plantilla?.name ?? '',
    title: plantilla?.title ?? '',
    icon: (plantilla?.icon ?? 'instalacion') as IconoNombre,
    mode: plantilla?.mode ?? ('SUMA' as const),
    seIncluye: plantilla?.seIncluye ?? [],
    notes: plantilla?.notes ?? [],
    active: plantilla?.active ?? true,
    items: plantilla?.items.map((i) => ({ itemId: i.item.id, name: i.item.name, qty: i.qty })) ?? [],
  });
  const [nuevoIncluye, setNuevoIncluye] = useState('');
  const [nuevaNota, setNuevaNota] = useState('');
  const [busca, setBusca] = useState('');
  const resultados = useApi<Paged<Item>>(['items', 'plantilla', busca], `/items?limit=6&q=${encodeURIComponent(busca)}`, { enabled: busca.length >= 2 });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const guardar = useAccion<void>({
    method: plantilla ? 'PATCH' : 'POST',
    path: plantilla ? `/admin/templates/${plantilla.id}` : '/admin/templates',
    body: () => ({ name: f.name, title: f.title || f.name, icon: f.icon, mode: f.mode, seIncluye: f.seIncluye, notes: f.notes, active: f.active, items: f.items.map((i) => ({ itemId: i.itemId, qty: i.qty })) }),
    invalidate: [['templates']],
    success: 'Plantilla guardada',
    onSuccess: onCerrar,
  });

  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      ancha
      etiqueta={plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
      titulo={plantilla?.name ?? 'Plantilla'}
      pie={
        <>
          <Boton variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="check" onClick={() => guardar.mutate()} cargando={guardar.isPending} disabled={f.name.trim().length < 2}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <Campo etiqueta="Título en el presupuesto" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={f.name} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="etiqueta text-humo">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {ICONOS.map((i) => (
              <Chip key={i.id} activo={f.icon === i.id} icono={i.id} onClick={() => set('icon', i.id)}>
                {i.t}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip activo={f.mode === 'SUMA'} icono="suma" onClick={() => set('mode', 'SUMA')}>
            Una opción (se suma)
          </Chip>
          <Chip activo={f.mode === 'COMPARATIVA'} icono="columnas" onClick={() => set('mode', 'COMPARATIVA')}>
            Comparativa (cada opción con su precio)
          </Chip>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="etiqueta text-humo">Se incluye</span>
          <div className="flex flex-wrap gap-2">
            {f.seIncluye.map((s) => (
              <span key={s} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-azul/60 bg-azul/15 pl-3.5 pr-1 text-sm">
                <Icono nombre="check" className="size-4 text-info" />
                {s}
                <IconoBoton icono="cerrar" etiqueta={`Quitar ${s}`} className="size-9" onClick={() => set('seIncluye', f.seIncluye.filter((x) => x !== s))} />
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Campo etiqueta="Agregar" value={nuevoIncluye} onChange={(e) => setNuevoIncluye(e.target.value)} placeholder="Garantía oficial de fábrica" className="flex-1" />
            <Boton
              variante="suave"
              icono="mas"
              className="self-end"
              disabled={nuevoIncluye.trim().length < 3}
              onClick={() => {
                set('seIncluye', [...f.seIncluye, nuevoIncluye.trim()]);
                setNuevoIncluye('');
              }}
            >
              Sumar
            </Boton>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="etiqueta text-humo">Aclaraciones de esta plantilla</span>
          <span className="text-sm text-humo">Se suman a las aclaraciones del presupuesto cuando se usa esta plantilla.</span>
          {f.notes.map((s) => (
            <span key={s} className="flex min-h-11 items-center gap-2 rounded-xl border border-linea bg-marino/60 pl-3.5 pr-1 text-sm">
              <span className="flex-1">{s}</span>
              <IconoBoton icono="cerrar" etiqueta={`Quitar ${s}`} className="size-9" onClick={() => set('notes', f.notes.filter((x) => x !== s))} />
            </span>
          ))}
          <div className="flex gap-2">
            <Campo etiqueta="Agregar" value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} placeholder="Los inyectores los provee el cliente." className="flex-1" />
            <Boton
              variante="suave"
              icono="mas"
              className="self-end"
              disabled={nuevaNota.trim().length < 3}
              onClick={() => {
                set('notes', [...f.notes, nuevaNota.trim()]);
                setNuevaNota('');
              }}
            >
              Sumar
            </Boton>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="etiqueta text-humo">Ítems que trae la plantilla</span>
          {f.items.map((i) => (
            <div key={i.itemId} className="flex items-center gap-3 rounded-xl border border-linea bg-marino-2 px-3.5 py-2">
              <span className="flex-1 font-semibold">{i.name}</span>
              <input
                type="number"
                min={1}
                aria-label={`Cantidad de ${i.name}`}
                value={i.qty}
                onChange={(e) => set('items', f.items.map((x) => (x.itemId === i.itemId ? { ...x, qty: Number(e.target.value) || 1 } : x)))}
                className="tabular min-h-10 w-20 rounded-lg border border-linea bg-noche px-2 text-center"
              />
              <IconoBoton icono="cerrar" etiqueta={`Quitar ${i.name}`} onClick={() => set('items', f.items.filter((x) => x.itemId !== i.itemId))} />
            </div>
          ))}
          <Campo etiqueta="Buscar en el catálogo para sumar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="peisa 24" />
          {busca.length >= 2 &&
            resultados.data?.items
              .filter((r) => !f.items.some((x) => x.itemId === r.id))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    set('items', [...f.items, { itemId: r.id, name: r.name, qty: 1 }]);
                    setBusca('');
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-dashed border-linea-2 px-3.5 text-left text-sm hover:border-celeste/50"
                >
                  <span>
                    <Icono nombre="mas" className="mr-2 inline size-4 text-info" />
                    {r.name}
                  </span>
                  <span className="tabular text-humo">{pesos(r.price.ars)}</span>
                </button>
              ))}
        </div>
        {plantilla && <Interruptor activo={f.active} onCambio={(v) => set('active', v)} etiqueta="Plantilla activa" />}
      </div>
    </Hoja>
  );
}
