'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Boton, Cabecera, Campo, Tarjeta } from '@/components/ui';
import { useMe } from '@/lib/api';
import { post } from '@/lib/client-api';

export default function CuentaPage() {
  const me = useMe();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cambiar() {
    if (nueva.length < 8) return toast.error('La contraseña nueva tiene que tener al menos 8 caracteres.');
    if (nueva !== repetir) return toast.error('Las dos contraseñas nuevas no coinciden.');
    setGuardando(true);
    try {
      await post('/auth/password', { currentPassword: actual, newPassword: nueva });
      toast.success('Listo, cambiaste tu contraseña.');
      setActual('');
      setNueva('');
      setRepetir('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Cabecera etiqueta="Mi cuenta" titulo={me.data?.name ?? 'Mi cuenta'} bajada={me.data ? `${me.data.email} · ${me.data.role === 'ADMIN' ? 'Administrador' : 'Ventas'}` : undefined} />
      <Tarjeta className="flex max-w-lg flex-col gap-3">
        <p className="titular-medio text-xl">Cambiar la contraseña</p>
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} ayuda="Al menos 8 caracteres." />
        <Campo etiqueta="Repetí la nueva" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        <Boton icono="check" cargando={guardando} onClick={cambiar} disabled={!actual || !nueva || !repetir}>
          Guardar contraseña
        </Boton>
      </Tarjeta>
    </>
  );
}
