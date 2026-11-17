'use client';

/** Cliente HTTP del navegador: misma origin (Next reescribe /api → NestJS), cookies incluidas */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

type Init = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit | null };

export async function http<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      accept: 'application/json',
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = (data as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join('. ') : raw || defaultMessage(res.status);
    throw new HttpError(res.status, message, data);
  }
  return data as T;
}

function defaultMessage(status: number) {
  if (status === 401) return 'Tu sesión venció. Volvé a ingresar.';
  if (status === 403) return 'No tenés permisos para esta acción.';
  if (status === 404) return 'No encontramos lo que buscabas.';
  if (status === 429) return 'Demasiados intentos. Esperá un momento y probá de nuevo.';
  if (status >= 500) return 'El servidor no respondió. Probá de nuevo en unos segundos.';
  return 'No se pudo completar la acción.';
}

export const get = <T,>(path: string) => http<T>(path);
export const post = <T,>(path: string, json?: unknown) => http<T>(path, { method: 'POST', json });
export const patch = <T,>(path: string, json?: unknown) => http<T>(path, { method: 'PATCH', json });
export const put = <T,>(path: string, json?: unknown) => http<T>(path, { method: 'PUT', json });
export const del = <T,>(path: string) => http<T>(path, { method: 'DELETE' });

/** Subida de archivos (multipart): fotos y listas de Excel */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form, credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = (data as { message?: string | string[] } | null)?.message;
    throw new HttpError(res.status, Array.isArray(raw) ? raw.join('. ') : raw || 'No se pudo subir el archivo', data);
  }
  return data as T;
}
