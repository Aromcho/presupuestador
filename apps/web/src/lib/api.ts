'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { del, get, patch, post } from './client-api';
import type { Dolar, User } from './types';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => get<{ user: User }>('/auth/me').then((r) => r.user), retry: false, staleTime: 5 * 60_000 });
}

export function useDolar() {
  return useQuery({ queryKey: ['dolar'], queryFn: () => get<Dolar>('/exchange'), staleTime: 5 * 60_000 });
}

export function useApi<T>(key: QueryKey, path: string, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key, queryFn: () => get<T>(path), ...opts });
}

type Method = 'POST' | 'PATCH' | 'DELETE';

/** Mutación con aviso de éxito/error e invalidación de consultas */
export function useAccion<TVars = unknown, TRes = unknown>(opts: {
  method: Method;
  path: string | ((v: TVars) => string);
  body?: (v: TVars) => unknown;
  invalidate?: QueryKey[];
  success?: string | ((res: TRes) => string);
  onSuccess?: (res: TRes, vars: TVars) => void;
}) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TVars>({
    mutationFn: (vars) => {
      const path = typeof opts.path === 'function' ? opts.path(vars) : opts.path;
      const body = opts.body ? opts.body(vars) : vars;
      if (opts.method === 'POST') return post<TRes>(path, body);
      if (opts.method === 'PATCH') return patch<TRes>(path, body);
      return del<TRes>(path);
    },
    onSuccess: (res, vars) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(res) : opts.success);
      opts.onSuccess?.(res, vars);
    },
    onError: (err) => toast.error(err.message),
  });
}
