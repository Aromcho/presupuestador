'use client';

import { useState } from 'react';
import { Boton, Cabecera, Campo, Cargando, Chip, Hoja, Interruptor, Pastilla } from '@/components/ui';
import { useAccion, useApi, useMe } from '@/lib/api';
import { fechaHora } from '@/lib/format';
import type { Role, User } from '@/lib/types';

export default function Usuarios() {
  const me = useMe();
  const usuarios = useApi<User[]>(['users'], '/admin/users');
  const [editando, setEditando] = useState<User | 'nuevo' | null>(null);
  return (
    <>
      <Cabecera
        volver={{ href: '/admin', texto: 'Administración' }}
        etiqueta="Usuarios y permisos"
        titulo="Usuarios"
        bajada="El administrador ve costos, márgenes y Administración. Ventas arma y manda presupuestos con el precio final."
        acciones={
          <Boton icono="mas" onClick={() => setEditando('nuevo')}>
            Nuevo usuario
          </Boton>
        }
      />
      {usuarios.isLoading ? (
        <Cargando />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {usuarios.data?.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => setEditando(u)} className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-linea bg-marino p-4 text-left hover:border-celeste/40">
                <span className="titular-medio grid size-11 place-items-center rounded-full bg-noche">{u.name.slice(0, 1)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">
                    {u.name}
                    {u.id === me.data?.id && <span className="ml-2 text-sm font-normal text-humo">(vos)</span>}
                  </span>
                  <span className="text-sm text-humo">{u.email}</span>
                </span>
                <Pastilla tono={u.role === 'ADMIN' ? 'rojo' : 'azul'}>{u.role === 'ADMIN' ? 'Administrador' : 'Ventas'}</Pastilla>
                {!u.active && <Pastilla>Sin acceso</Pastilla>}
                <span className="text-sm text-humo">Último ingreso: {fechaHora(u.lastLoginAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editando && <EditarUsuario usuario={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </>
  );
}

function EditarUsuario({ usuario, onCerrar }: { usuario: User | null; onCerrar: () => void }) {
  const [f, setF] = useState({ name: usuario?.name ?? '', email: usuario?.email ?? '', role: usuario?.role ?? ('VENTAS' as Role), active: usuario?.active ?? true, password: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useAccion<void>({
    method: usuario ? 'PATCH' : 'POST',
    path: usuario ? `/admin/users/${usuario.id}` : '/admin/users',
    body: () => (usuario ? { name: f.name, role: f.role, active: f.active, ...(f.password && { password: f.password }) } : f),
    invalidate: [['users']],
    success: 'Usuario guardado',
    onSuccess: onCerrar,
  });
  return (
    <Hoja
      abierta
      onCerrar={onCerrar}
      etiqueta={usuario ? 'Editar usuario' : 'Nuevo usuario'}
      titulo={usuario?.name ?? 'Usuario'}
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
        <Campo etiqueta="Nombre" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <Campo etiqueta="Email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={!!usuario} />
        <div className="flex flex-wrap gap-2">
          <Chip activo={f.role === 'VENTAS'} onClick={() => set('role', 'VENTAS')}>
            Ventas
          </Chip>
          <Chip activo={f.role === 'ADMIN'} onClick={() => set('role', 'ADMIN')}>
            Administrador
          </Chip>
        </div>
        <Campo etiqueta={usuario ? 'Contraseña nueva (opcional)' : 'Contraseña'} type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} ayuda="Al menos 8 caracteres." />
        {usuario && <Interruptor activo={f.active} onCambio={(v) => set('active', v)} etiqueta="Puede ingresar" />}
      </div>
    </Hoja>
  );
}
