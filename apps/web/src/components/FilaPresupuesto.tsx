'use client';

import Link from 'next/link';
import { Pastilla } from '@/components/ui';
import { ESTADOS, fecha, pesos } from '@/lib/format';
import type { QuoteRow } from '@/lib/types';

export function FilaPresupuesto({ r }: { r: QuoteRow }) {
  const est = ESTADOS[r.status];
  return (
    <Link href={`/presupuestos/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-linea bg-marino px-4 py-3.5 transition hover:border-celeste/40">
      <span className="tabular grid h-12 min-w-16 place-items-center rounded-xl bg-noche px-2 font-bold text-celeste">{r.numberLabel}</span>
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <span className="truncate font-semibold">{r.client?.name ?? 'Sin cliente'}</span>
        <span className="truncate text-sm text-humo">
          {r.title}
          {r.client?.zone ? ` · ${r.client.zone}` : ''}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="tabular font-bold">{r.total != null ? pesos(r.total) : r.groups.map((g) => pesos(g.total)).join(' / ')}</span>
        <span className="flex items-center gap-2 text-xs text-humo">
          <Pastilla tono={est.tono}>{est.texto}</Pastilla>
          {fecha(r.createdAt)}
        </span>
      </span>
    </Link>
  );
}
