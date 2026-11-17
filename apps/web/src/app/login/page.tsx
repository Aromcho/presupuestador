'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Llama } from '@/components/Llama';
import { Boton, Campo } from '@/components/ui';
import { post } from '@/lib/client-api';
import type { User } from '@/lib/types';

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { user } = await post<{ user: User }>('/auth/login', { email, password });
      qc.setQueryData(['me'], user);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-10 opacity-20 md:right-10">
        <Llama className="h-[420px] w-auto" modo="viva" brillo />
      </div>
      <div className="relative w-full max-w-md">
        <img src="/brand/gesetec-logo.svg" alt="Gesetec Calderas" className="mb-10 h-14 w-auto" />
        <p className="etiqueta text-celeste">Presupuestador</p>
        <h1 className="titular mt-3 text-5xl">
          Hola de <span className="degrade-llama">nuevo.</span>
        </h1>
        <p className="mt-3 text-celeste">Ingresá para armar y mandar presupuestos.</p>
        <form onSubmit={entrar} className="mt-8 flex flex-col gap-4 rounded-3xl border border-linea bg-marino p-6">
          <Campo etiqueta="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && (
            <p role="alert" className="rounded-xl bg-bordo/40 px-3.5 py-2.5 text-sm text-alerta">
              {error}
            </p>
          )}
          <Boton type="submit" grande cargando={enviando} className="mt-2 w-full">
            Ingresar
          </Boton>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
