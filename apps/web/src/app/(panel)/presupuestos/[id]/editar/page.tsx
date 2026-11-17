'use client';

import { useParams } from 'next/navigation';
import { Armador } from '@/components/Armador';
import { Cargando, Vacio } from '@/components/ui';
import { useApi } from '@/lib/api';
import type { Quote } from '@/lib/types';

export default function EditarPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<Quote>(['quote', id], `/quotes/${id}`);
  if (q.isError) return <Vacio titulo="No encontramos ese presupuesto" texto={(q.error as Error).message} />;
  if (!q.data) return <Cargando />;
  return <Armador editar={q.data} />;
}
