'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Armador } from '@/components/Armador';

function Nuevo() {
  const params = useSearchParams();
  return <Armador plantillaInicial={params.get('plantilla')} clienteInicial={params.get('cliente')} />;
}

export default function NuevoPage() {
  return (
    <Suspense>
      <Nuevo />
    </Suspense>
  );
}
