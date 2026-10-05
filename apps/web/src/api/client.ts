import type { UploadResponse } from '@nail-crm/shared';
import { apiBase } from '@/lib/assets';
import { useAuth } from '@/store/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the automatic re-auth on 401 (used by auth calls themselves). */
  noRetry?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${apiBase}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return apiBase ? url.toString() : `${url.pathname}${url.search}`;
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toError(res: Response, data: unknown): ApiError {
  const body = (data ?? {}) as { error?: { code?: string; message?: string; details?: unknown } };
  return new ApiError(
    res.status,
    body.error?.code ?? 'internal',
    body.error?.message ?? res.statusText,
    body.error?.details,
  );
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { token } = useAuth.getState();
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const data = await parse(res);
  if (res.status === 401 && !opts.noRetry) {
    const refreshed = await useAuth.getState().reauthenticate();
    if (refreshed) return request<T>(path, { ...opts, noRetry: true });
  }
  if (!res.ok) throw toError(res, data);
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function uploadImage(path: string, file: File, kind: string): Promise<UploadResponse> {
  const { token } = useAuth.getState();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(buildUrl(path, { kind }), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await parse(res);
  if (!res.ok) throw toError(res, data);
  return data as UploadResponse;
}
