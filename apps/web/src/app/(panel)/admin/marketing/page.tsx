'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Icono } from '@/components/Icono';
import { Markdown } from '@/components/Markdown';
import { Boton, BotonLink, Cabecera, Campo, Cargando, Chip, Etiqueta, Hoja, IconoBoton, Interruptor, Pastilla, Selector, Tarjeta, Vacio } from '@/components/ui';
import { useAccion, useApi } from '@/lib/api';
import { upload } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { fechaHora } from '@/lib/format';
import type { EstadoPendiente, EstadoPieza, MarketingData, PendienteMkt, Pieza, RecursoMkt, TablaMkt } from '@/lib/types';

const ESTADOS: EstadoPieza[] = ['idea', 'para producir', 'en edición', 'programado', 'publicado'];
const TONO: Record<EstadoPieza, 'gris' | 'azul' | 'verde' | 'rojo'> = { idea: 'gris', 'para producir': 'azul', 'en edición': 'azul', programado: 'verde', publicado: 'verde' };

type Pestania = 'calendario' | 'plan' | 'pendientes' | 'recursos' | 'series' | 'hilo' | 'rutina';

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Hoy en Buenos Aires, AAAA-MM-DD */
const hoyBA = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fechaLarga = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const mesTitulo = (ym: string) => {
  const t = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const diaCorto = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

function copiar(texto: string, aviso = 'Copiado') {
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error('No se pudo copiar'),
  );
}

export default function Marketing() {
  const q = useApi<MarketingData>(['marketing'], '/admin/marketing');
  const [pestania, setPestania] = useState<Pestania>('calendario');
  const [abierta, setAbierta] = useState<string | null>(null);
  const data = q.data;

  if (q.isLoading) return <Cargando texto="Abriendo el plan de marketing…" />;

  const vacio = !data?.posts.length;
  const abiertos = data?.pending.filter((p) => p.status !== 'Resuelto').length ?? 0;
  const pestanias: { id: Pestania; t: string; n?: number }[] = [
    { id: 'calendario', t: 'Calendario', n: data?.posts.length },
    { id: 'plan', t: 'Plan' },
    { id: 'pendientes', t: 'Pendientes', n: abiertos },
    { id: 'recursos', t: 'Recursos', n: data?.resourcesCount },
    { id: 'series', t: 'Series' },
    { id: 'hilo', t: 'Hilo' },
    { id: 'rutina', t: 'Rutina' },
  ];

  return (
    <>
      <Cabecera
        volver={{ href: '/admin', texto: 'Administración' }}
        etiqueta="Marketing y redes"
        titulo="Plan de marketing"
        bajada={
          vacio
            ? 'El calendario de publicaciones, los ganchos, los recursos de los álbumes y los pendientes, en un solo lugar.'
            : `Cargado ${fechaHora(data!.importedAt)}${data!.importedBy ? ` por ${data!.importedBy}` : ''}${data!.fileName ? ` · ${data!.fileName}` : ''}. El estado de cada publicación se cambia acá y no se pisa al volver a importar.`
        }
        acciones={
          <>
            <Importar />
            {!vacio && (
              <BotonLink href="/api/admin/marketing/export.xlsx" variante="contorno" icono="excel">
                Exportar a Excel
              </BotonLink>
            )}
          </>
        }
      />

      {vacio ? (
        <Vacio
          icono="megafono"
          titulo="Todavía no hay un plan cargado"
          texto="Importá el Excel del plan (con las hojas Calendario, Recursos, Pendientes y las demás) y queda todo acá."
          accion={<Importar />}
        />
      ) : (
        <>
          <Numeros data={data!} />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones del plan">
            {pestanias.map((p) => (
              <Chip key={p.id} role="tab" aria-selected={pestania === p.id} activo={pestania === p.id} onClick={() => setPestania(p.id)}>
                {p.t}
                {p.n != null && <span className="tabular text-xs text-humo">{p.n}</span>}
              </Chip>
            ))}
          </div>
          {pestania === 'calendario' && (
            <>
              <LoQueViene piezas={data!.posts} onAbrir={setAbierta} />
              <Calendario piezas={data!.posts} onAbrir={setAbierta} />
            </>
          )}
          {pestania === 'plan' && <Plan secciones={data!.plan} />}
          {pestania === 'pendientes' && <Pendientes pendientes={data!.pending} />}
          {pestania === 'recursos' && <Recursos onAbrir={(code) => setAbierta(data!.posts.find((p) => p.code === code)?.id ?? null)} />}
          {pestania === 'series' && <TablaSimple tabla={data!.series} vacio="No hay series cargadas." />}
          {pestania === 'hilo' && <TablaSimple tabla={data!.hilo} vacio="No hay hilo cargado." />}
          {pestania === 'rutina' && <TablaSimple tabla={data!.rutina} vacio="No hay rutina cargada." />}
          {abierta && <Detalle piezas={data!.posts} id={abierta} onCambiar={setAbierta} onCerrar={() => setAbierta(null)} />}
        </>
      )}
    </>
  );
}

function Importar() {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);

  const subir = async (file: File | undefined) => {
    if (!file) return;
    setCargando(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await upload<{ publicaciones: number; nuevas: number; borradas: number; estadosRespetados: number; recursos: number | null; pendientes: number | null }>('/admin/marketing/import', fd);
      const partes = [`${r.publicaciones} publicaciones (${r.nuevas} nuevas${r.borradas ? `, ${r.borradas} quitadas` : ''})`];
      if (r.recursos != null) partes.push(`${r.recursos} recursos`);
      if (r.pendientes != null) partes.push(`${r.pendientes} pendientes`);
      toast.success(`Plan cargado: ${partes.join(', ')}`);
      if (r.estadosRespetados) toast.info(`${r.estadosRespetados} publicaciones mantienen el estado que se cambió en el panel.`);
      qc.invalidateQueries({ queryKey: ['marketing'] });
      qc.invalidateQueries({ queryKey: ['marketing-recursos'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <>
      <Boton icono="subir" cargando={cargando} onClick={() => ref.current?.click()}>
        Importar Excel del plan
      </Boton>
      <input ref={ref} type="file" accept=".xlsx" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => subir(e.target.files?.[0])} />
    </>
  );
}

function Numeros({ data }: { data: MarketingData }) {
  const hoy = hoyBA();
  const semana = sumarDias(hoy, 6);
  const piezas = data.posts;
  const publicadas = piezas.filter((p) => p.status === 'publicado').length;
  const estaSemana = piezas.filter((p) => p.date >= hoy && p.date <= semana).length;
  const atrasadas = piezas.filter((p) => p.date < hoy && p.status !== 'publicado').length;
  const abiertos = data.pending.filter((p) => p.status !== 'Resuelto').length;

  const dato = (n: number | string, t: string, tono?: string) => (
    <div className="flex flex-col gap-1 rounded-2xl border border-linea bg-marino p-4">
      <span className={cn('titular text-3xl tabular', tono)}>{n}</span>
      <span className="text-sm text-celeste">{t}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {dato(piezas.length, `publicaciones · ${piezas.filter((p) => sinAcentos(p.base ?? '') === 'extra').length} EXTRA`)}
      {dato(`${publicadas}/${piezas.length}`, 'publicadas', 'text-ok')}
      {dato(estaSemana, atrasadas ? `en los próximos 7 días · ${atrasadas} atrasadas` : 'en los próximos 7 días', atrasadas ? 'text-alerta' : undefined)}
      {dato(abiertos, 'pendientes abiertos', abiertos ? 'text-alerta' : undefined)}
    </div>
  );
}

function LoQueViene({ piezas, onAbrir }: { piezas: Pieza[]; onAbrir: (id: string) => void }) {
  const hoy = hoyBA();
  const proximas = piezas.filter((p) => p.date >= hoy && p.status !== 'publicado').slice(0, 4);
  if (!proximas.length) return null;
  return (
    <Tarjeta className="flex flex-col gap-3">
      <Etiqueta>Lo que viene</Etiqueta>
      <div className="grid gap-2.5 md:grid-cols-2">
        {proximas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onAbrir(p.id)}
            className="flex flex-wrap items-start gap-3 rounded-2xl border border-linea bg-marino-2 p-3 text-left transition hover:border-celeste/40"
          >
            <FechaBloque iso={p.date} />
            <span className="min-w-0 flex-[1_1_160px]">
              <span className="block text-xs text-humo">
                {p.code} · {p.format} {p.time ? `· ${p.time}` : ''}
              </span>
              <span className="mt-0.5 line-clamp-2 block font-semibold leading-snug">{p.hookVoice || p.series}</span>
            </span>
            <Pastilla tono={TONO[p.status]}>{p.status}</Pastilla>
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}

function FechaBloque({ iso, apagada }: { iso: string; apagada?: boolean }) {
  return (
    <span className={cn('flex w-12 shrink-0 flex-col items-center rounded-xl bg-noche py-1.5', apagada && 'opacity-60')}>
      <span className="titular text-xl leading-none tabular">{Number(iso.slice(8, 10))}</span>
      <span className="text-[0.7rem] uppercase text-humo">{diaCorto(iso)}</span>
    </span>
  );
}

function SelectorEstado({ pieza, className }: { pieza: Pieza; className?: string }) {
  const editar = useAccion<{ status: EstadoPieza }>({
    method: 'PATCH',
    path: `/admin/marketing/posts/${pieza.id}`,
    invalidate: [['marketing']],
    success: (r: unknown) => `${pieza.code}: ${(r as { status: string }).status}`,
  });
  return (
    <select
      aria-label={`Estado de ${pieza.code}`}
      value={pieza.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => editar.mutate({ status: e.target.value as EstadoPieza })}
      disabled={editar.isPending}
      className={cn(
        'min-h-10 rounded-xl border px-2.5 text-sm font-semibold outline-none focus:border-azul',
        pieza.status === 'publicado' || pieza.status === 'programado'
          ? 'border-whatsapp/40 bg-whatsapp/10 text-ok'
          : pieza.status === 'idea'
            ? 'border-linea bg-noche text-celeste'
            : 'border-azul/50 bg-azul/15 text-info',
        className,
      )}
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>
          {e}
        </option>
      ))}
    </select>
  );
}

function Calendario({ piezas, onAbrir }: { piezas: Pieza[]; onAbrir: (id: string) => void }) {
  const [buscar, setBuscar] = useState('');
  const [capitulo, setCapitulo] = useState('');
  const [estado, setEstado] = useState('');
  const [formato, setFormato] = useState('');
  const [sinExtra, setSinExtra] = useState(false);
  const hoy = hoyBA();

  const capitulos = useMemo(() => [...new Set(piezas.map((p) => p.chapter).filter(Boolean))] as string[], [piezas]);
  const formatos = useMemo(() => [...new Set(piezas.map((p) => p.format).filter(Boolean))] as string[], [piezas]);

  const lista = useMemo(() => {
    const t = sinAcentos(buscar.trim());
    return piezas.filter(
      (p) =>
        (!capitulo || p.chapter === capitulo) &&
        (!estado || p.status === estado) &&
        (!formato || p.format === formato) &&
        (!sinExtra || sinAcentos(p.base ?? '') !== 'extra') &&
        (!t || sinAcentos([p.code, p.hookVoice, p.hookScreen, p.series, p.product, p.zone, p.script].join(' ')).includes(t)),
    );
  }, [piezas, buscar, capitulo, estado, formato, sinExtra]);

  const meses = useMemo(() => {
    const m = new Map<string, Pieza[]>();
    lista.forEach((p) => m.set(p.date.slice(0, 7), [...(m.get(p.date.slice(0, 7)) ?? []), p]));
    return [...m.entries()];
  }, [lista]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="R25, piso radiante, Pinamar…" className="flex-[1_1_220px]" />
        <Selector etiqueta="Capítulo" value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className="flex-[1_1_200px]">
          <option value="">Todos</option>
          {capitulos.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Selector>
        <Selector etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="flex-[1_1_150px]">
          <option value="">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </Selector>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip activo={!formato} onClick={() => setFormato('')}>
          Todo
        </Chip>
        {formatos.map((f) => (
          <Chip key={f} activo={formato === f} onClick={() => setFormato(f)}>
            {f}
          </Chip>
        ))}
        <span className="ml-auto">
          <Interruptor activo={sinExtra} onCambio={setSinExtra} etiqueta="Solo la base" ayuda="Oculta lo marcado EXTRA" />
        </span>
      </div>

      {!lista.length ? (
        <Vacio titulo="No hay publicaciones con esos filtros" />
      ) : (
        meses.map(([ym, ps]) => (
          <section key={ym} className="flex flex-col gap-2.5" aria-label={mesTitulo(ym)}>
            <h2 className="titular-medio text-xl">
              {mesTitulo(ym)} <span className="text-sm font-normal text-humo">· {ps.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {ps.map((p) => {
                const atrasada = p.date < hoy && p.status !== 'publicado';
                return (
                  <li key={p.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onAbrir(p.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir(p.id))}
                      className={cn(
                        'flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-linea bg-marino p-3 transition hover:border-celeste/40 md:flex-nowrap',
                        p.date < hoy && p.status === 'publicado' && 'opacity-70',
                      )}
                    >
                      <FechaBloque iso={p.date} />
                      <div className="min-w-0 flex-[1_1_240px]">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-humo">
                          <span className="font-bold text-celeste">{p.code}</span>
                          <span>{p.format}</span>
                          {p.time && <span>{p.time}</span>}
                          {p.series && <span>· {p.series}</span>}
                          {sinAcentos(p.base ?? '') === 'extra' && <Pastilla>EXTRA</Pastilla>}
                          {atrasada && <Pastilla tono="rojo">Atrasada</Pastilla>}
                        </p>
                        <p className="mt-1 font-semibold leading-snug">{p.hookVoice}</p>
                        {p.hookScreen && <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-celeste">{p.hookScreen}</p>}
                      </div>
                      <SelectorEstado pieza={p} className="shrink-0" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** "A06-012 · C:\...\IMG_1.HEIC" → código + ruta; lo que no tiene esa forma va como texto */
function recursosDe(texto: string | undefined) {
  return (texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([A-Z]\d{2}-\d{3}|[A-Z]-\d{2})\s·\s(.+)$/);
      return m ? { code: m[1], ruta: m[2], archivo: m[2].split(/[\\/]/).pop() ?? m[2] } : { code: null, ruta: l, archivo: l };
    });
}

function Bloque({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Etiqueta className="text-humo">{titulo}</Etiqueta>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Detalle({ piezas, id, onCambiar, onCerrar }: { piezas: Pieza[]; id: string; onCambiar: (id: string) => void; onCerrar: () => void }) {
  const p = piezas.find((x) => x.id === id);
  const nota = useAccion<{ note: string }>({ method: 'PATCH', path: `/admin/marketing/posts/${id}`, invalidate: [['marketing']], success: 'Nota guardada' });
  const estado = useAccion<{ status: EstadoPieza }>({ method: 'PATCH', path: `/admin/marketing/posts/${id}`, invalidate: [['marketing']] });
  if (!p) return null;
  const porCodigo = (c?: string) => piezas.find((x) => x.code === c);
  const anterior = porCodigo(p.prev);
  const siguiente = porCodigo(p.next);
  const datos: [string, string | undefined][] = [
    ['Serie', p.series],
    ['Capítulo', p.chapter],
    ['Etapa del arco', p.arc],
    ['Objetivo', p.goal],
    ['Producto o modelo', p.product],
    ['Zona', p.zone],
    ['Base o EXTRA', p.base],
    ['Etiqueta de IA', p.ai],
  ];
  const recursos = recursosDe(p.resources);

  return (
    <Hoja
      abierta
      ancha
      onCerrar={onCerrar}
      etiqueta={`${p.code} · ${p.format ?? ''} · ${fechaLarga(p.date)}${p.time ? ` · ${p.time}` : ''}`}
      titulo={p.hookVoice || p.code}
      pie={
        <>
          <Boton variante="contorno" icono="atras" disabled={!anterior} onClick={() => anterior && onCambiar(anterior.id)}>
            {anterior ? anterior.code : 'Anterior'}
          </Boton>
          <Boton variante="contorno" disabled={!siguiente} onClick={() => siguiente && onCambiar(siguiente.id)}>
            {siguiente ? siguiente.code : 'Siguiente'}
            <Icono nombre="flecha" className="size-[1.1rem]" />
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Bloque titulo="Estado">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <Chip key={e} activo={p.status === e} onClick={() => p.status !== e && estado.mutate({ status: e })}>
                {e === 'publicado' && <Icono nombre="check" className="size-4" />}
                {e}
              </Chip>
            ))}
          </div>
        </Bloque>

        <Bloque titulo={`Gancho · ${p.formula ?? ''}${p.score ? ` · ${p.score}` : ''}`}>
          {p.hookScreen && <p className="titular rounded-2xl border border-linea bg-noche px-4 py-3 text-xl uppercase leading-tight">{p.hookScreen}</p>}
          {[p.optionB, p.optionC].filter(Boolean).length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm text-celeste">
              {[p.optionB, p.optionC].filter(Boolean).map((o, i) => (
                <li key={i} className="rounded-xl bg-marino-2 px-3 py-2">
                  <span className="font-semibold text-humo">Opción {i === 0 ? 'B' : 'C'}: </span>
                  {o}
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        {p.script && (
          <Bloque titulo="Guion corto">
            <p className="leading-relaxed text-[#dce4f7]">{p.script}</p>
            {p.echo && <p className="text-sm text-celeste">Frase antes del llamado: «{p.echo}»</p>}
          </Bloque>
        )}

        {p.toProduce && (
          <p className="rounded-2xl border border-bordo/60 bg-bordo/20 px-4 py-3 text-sm text-alerta">
            <span className="font-bold">Qué falta: </span>
            {p.toProduce}
          </p>
        )}

        {recursos.length > 0 && (
          <Bloque titulo={`Recursos · ${recursos.length}`}>
            <ul className="flex flex-col gap-1.5">
              {recursos.map((r, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-marino-2 py-1 pl-3 pr-1 text-sm">
                  {r.code && <span className="font-bold tabular text-celeste">{r.code}</span>}
                  <span className="min-w-0 flex-1 truncate text-[#dce4f7]" title={r.ruta}>
                    {r.archivo}
                  </span>
                  <IconoBoton icono="copiar" etiqueta="Copiar la ruta" onClick={() => copiar(r.ruta, 'Ruta copiada')} />
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        <div className="grid gap-x-5 gap-y-3 rounded-2xl border border-linea p-4 sm:grid-cols-2">
          {datos
            .filter(([, v]) => v)
            .map(([t, v]) => (
              <div key={t}>
                <p className="text-xs text-humo">{t}</p>
                <p className="text-sm">{v}</p>
              </div>
            ))}
        </div>

        {p.cta && (
          <Bloque titulo="Llamado a la acción">
            <p className="text-[#dce4f7]">{p.cta}</p>
          </Bloque>
        )}

        {p.caption && (
          <Bloque
            titulo="Texto del post"
            accion={
              <Boton variante="texto" icono="copiar" onClick={() => copiar(p.caption!, 'Texto copiado')}>
                Copiar
              </Boton>
            }
          >
            <p className="whitespace-pre-line rounded-2xl bg-marino-2 px-4 py-3 text-sm leading-relaxed text-[#dce4f7]">{p.caption}</p>
          </Bloque>
        )}

        {p.recycle && (
          <Bloque titulo="Qué se recicla">
            <p className="text-sm text-celeste">{p.recycle}</p>
          </Bloque>
        )}

        <Bloque titulo="Nota">
          <textarea
            key={p.id}
            defaultValue={p.note}
            aria-label="Nota de la publicación"
            placeholder="Link del posteo, cambios, lo que respondió Leo…"
            onBlur={(e) => e.target.value !== p.note && nota.mutate({ note: e.target.value })}
            className="min-h-20 w-full rounded-xl border border-linea bg-noche px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-white outline-none placeholder:text-humo focus:border-azul"
          />
        </Bloque>
      </div>
    </Hoja>
  );
}

function Plan({ secciones }: { secciones: MarketingData['plan'] }) {
  if (!secciones.length) return <Vacio icono="doc" titulo="El Excel no traía la hoja «Plan»" texto="Importá el archivo del plan completo para ver el diagnóstico, los mensajes y la pauta." />;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Secciones del plan" className="flex flex-wrap gap-2">
        {secciones.map((s, i) => (
          <a key={i} href={`#plan-${i}`} className="rounded-full border border-linea px-3 py-1.5 text-sm text-celeste transition hover:border-celeste/50 hover:text-white">
            {s.titulo}
          </a>
        ))}
      </nav>
      {secciones.map((s, i) => (
        <Tarjeta key={i} className="flex scroll-mt-24 flex-col gap-3">
          <h2 id={`plan-${i}`} className="titular-medio text-2xl">
            {s.titulo}
          </h2>
          <Markdown md={s.md} />
        </Tarjeta>
      ))}
    </div>
  );
}

function Pendientes({ pendientes }: { pendientes: PendienteMkt[] }) {
  const [ver, setVer] = useState<'abiertos' | 'resueltos' | 'todos'>('abiertos');
  const editar = useAccion<{ id: string; status?: EstadoPendiente; answer?: string }>({
    method: 'PATCH',
    path: (v) => `/admin/marketing/pendientes/${v.id}`,
    body: ({ id: _id, ...rest }) => rest,
    invalidate: [['marketing']],
  });
  const lista = pendientes.filter((p) => ver === 'todos' || (ver === 'resueltos' ? p.status === 'Resuelto' : p.status !== 'Resuelto'));
  const grupos = useMemo(() => {
    const m = new Map<string, PendienteMkt[]>();
    lista.forEach((p) => m.set(p.kind || 'Otros', [...(m.get(p.kind || 'Otros') ?? []), p]));
    return [...m.entries()];
  }, [lista]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['abiertos', `Abiertos · ${pendientes.filter((p) => p.status !== 'Resuelto').length}`],
            ['resueltos', `Resueltos · ${pendientes.filter((p) => p.status === 'Resuelto').length}`],
            ['todos', 'Todos'],
          ] as const
        ).map(([k, t]) => (
          <Chip key={k} activo={ver === k} onClick={() => setVer(k)}>
            {t}
          </Chip>
        ))}
      </div>
      {!lista.length ? (
        <Vacio icono="check" titulo={ver === 'abiertos' ? 'No queda nada pendiente' : 'No hay pendientes acá'} />
      ) : (
        grupos.map(([tipo, ps]) => (
          <section key={tipo} className="flex flex-col gap-2.5">
            <h2 className="titular-medio text-xl">
              {tipo} <span className="text-sm font-normal text-humo">· {ps.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {ps.map((p) => (
                <li key={p.id} className={cn('flex flex-col gap-3 rounded-2xl border border-linea bg-marino p-4', p.status === 'Resuelto' && 'opacity-70')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-[1_1_320px]">
                      <p className="font-bold">{p.topic}</p>
                      {p.detail && <p className="mt-1 text-sm leading-relaxed text-[#dce4f7]">{p.detail}</p>}
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-humo">
                        {p.affects && <span>Afecta a: {p.affects}</span>}
                        {p.owner && <span>Lo resuelve: {p.owner}</span>}
                      </p>
                    </div>
                    <Interruptor activo={p.status === 'Resuelto'} onCambio={(v) => editar.mutate({ id: p.id, status: v ? 'Resuelto' : 'Abierto' })} etiqueta="Resuelto" />
                  </div>
                  <input
                    key={`${p.id}-${p.answer}`}
                    defaultValue={p.answer}
                    aria-label={`Respuesta: ${p.topic}`}
                    placeholder="Respuesta o decisión (por ejemplo, lo que dijo Leo)"
                    onBlur={(e) => e.target.value !== p.answer && editar.mutate({ id: p.id, answer: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-linea bg-noche px-3.5 text-sm text-white outline-none placeholder:text-humo focus:border-azul"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

const USOS = ['Sí', 'Sí, tapando o recortando', 'A confirmar con Leo', 'No'];

function Recursos({ onAbrir }: { onAbrir: (code: string) => void }) {
  const q = useApi<RecursoMkt[]>(['marketing-recursos'], '/admin/marketing/recursos');
  const [buscar, setBuscar] = useState('');
  const [uso, setUso] = useState('');
  const [album, setAlbum] = useState('');
  const [tipo, setTipo] = useState('');
  const [usados, setUsados] = useState(false);
  const [cuantos, setCuantos] = useState(60);
  const todos = q.data ?? [];

  const albumes = useMemo(() => [...new Set(todos.map((r) => r.album).filter(Boolean))] as string[], [todos]);
  const tipos = useMemo(() => [...new Set(todos.map((r) => r.type).filter(Boolean))] as string[], [todos]);
  const lista = useMemo(() => {
    const t = sinAcentos(buscar.trim()).split(/\s+/).filter(Boolean);
    return todos.filter((r) => {
      if (uso && r.usable !== uso) return false;
      if (album && r.album !== album) return false;
      if (tipo && r.type !== tipo) return false;
      if (usados && !r.usedIn) return false;
      if (!t.length) return true;
      const hay = sinAcentos([r.code, r.desc, r.brand, r.model, r.zone, r.category, r.file].join(' '));
      return t.every((w) => hay.includes(w));
    });
  }, [todos, buscar, uso, album, tipo, usados]);

  if (q.isLoading) return <Cargando texto="Cargando recursos…" />;
  if (!todos.length) return <Vacio icono="foto" titulo="El Excel no traía la hoja «Recursos»" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" value={buscar} onChange={(e) => (setBuscar(e.target.value), setCuantos(60))} placeholder="tameco cp-100, radiador negro, Cariló…" className="flex-[1_1_240px]" />
        <Selector etiqueta="¿Se puede usar?" value={uso} onChange={(e) => (setUso(e.target.value), setCuantos(60))} className="flex-[1_1_190px]">
          <option value="">Todos</option>
          {USOS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Selector>
        <Selector etiqueta="Álbum" value={album} onChange={(e) => (setAlbum(e.target.value), setCuantos(60))} className="flex-[1_1_110px]">
          <option value="">Todos</option>
          {albumes.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Selector>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip activo={!tipo} onClick={() => setTipo('')}>
          Todo
        </Chip>
        {tipos.map((t) => (
          <Chip key={t} activo={tipo === t} onClick={() => setTipo(t)}>
            {t}
          </Chip>
        ))}
        <span className="ml-auto">
          <Interruptor activo={usados} onCambio={setUsados} etiqueta="Solo los del calendario" />
        </span>
      </div>
      <p className="text-sm text-celeste">
        {lista.length} de {todos.length} archivos. Tocá el ícono para copiar la ruta y abrirlo en la compu.
      </p>
      <ul className="flex flex-col gap-2">
        {lista.slice(0, cuantos).map((r) => (
          <li key={r.code} className="flex flex-col gap-2 rounded-2xl border border-linea bg-marino p-3">
            <div className="flex flex-wrap items-start gap-3 md:flex-nowrap">
              <span className="w-[4.6rem] shrink-0 pt-0.5 font-bold tabular text-celeste">{r.code}</span>
              <div className="min-w-0 flex-[1_1_260px]">
                <p className="leading-snug">{r.desc}</p>
                <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-humo">
                  <span>
                    {r.type}
                    {r.duration ? ` · ${r.duration} s` : ''}
                    {r.orientation ? ` · ${r.orientation.toLowerCase()}` : ''}
                  </span>
                  {(r.brand || r.model) && <span>{[r.brand, r.model].filter(Boolean).join(' ')}</span>}
                  {r.zone && r.zone !== 'Sin dato' && <span>{r.zone}</span>}
                  {r.quality && <span>Calidad {r.quality.toLowerCase()}</span>}
                  <span className="truncate" title={r.path}>
                    {r.file}
                  </span>
                </p>
                {r.usedIn && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-humo">
                    Usado en
                    {r.usedIn.split(/,\s*/).map((c) => (
                      <button key={c} type="button" onClick={() => onAbrir(c)} className="rounded-full bg-azul/20 px-2 py-0.5 font-semibold text-info hover:bg-azul/35">
                        {c}
                      </button>
                    ))}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pastilla tono={r.usable === 'Sí' ? 'verde' : r.usable === 'No' ? 'rojo' : r.usable?.startsWith('Sí') ? 'azul' : 'gris'}>{r.usable ?? '—'}</Pastilla>
                {r.path && <IconoBoton icono="copiar" etiqueta="Copiar la ruta" onClick={() => copiar(r.path!, 'Ruta copiada')} />}
              </div>
            </div>
            {r.condition && <p className="text-xs text-alerta md:pl-[5.35rem]">{r.condition}</p>}
          </li>
        ))}
      </ul>
      {lista.length > cuantos && (
        <Boton variante="suave" className="self-center" onClick={() => setCuantos((n) => n + 120)}>
          Ver más ({lista.length - cuantos})
        </Boton>
      )}
    </div>
  );
}

function TablaSimple({ tabla, vacio }: { tabla: TablaMkt | null; vacio: string }) {
  if (!tabla?.rows.length) return <Vacio icono="doc" titulo={vacio} />;
  return (
    <div className="overflow-x-auto rounded-3xl border border-linea bg-marino">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead className="bg-marino-2">
          <tr>
            {tabla.headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold text-celeste">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.rows.map((r, i) => (
            <tr key={i} className="border-t border-linea align-top">
              {tabla.headers.map((_, j) => (
                <td key={j} className={cn('px-4 py-3 leading-relaxed', j === 0 ? 'font-semibold' : 'text-[#dce4f7]')}>
                  {r[j]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
