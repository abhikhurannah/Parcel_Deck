import type { RowError } from '../../shared/types';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public rows: RowError[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}
export type Api = <T>(
  path: string,
  options?: RequestInit & { onProgress?: (percent: number) => void },
  body?: unknown,
) => Promise<T>;
export function createApi(csrf: string | undefined, onUnauthorized: () => void): Api {
  return async <T>(
    path: string,
    options: RequestInit & { onProgress?: (percent: number) => void } = {},
    body?: unknown,
  ): Promise<T> => {
    const headers = new Headers(options.headers);
    headers.set('X-Requested-With', 'ParcelDesk');
    if (csrf) headers.set('X-CSRF-Token', csrf);
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      options = { ...options, body: JSON.stringify(body) };
    }
    if (options.onProgress && options.body instanceof Blob) {
      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method ?? 'POST', '/api' + path);
        xhr.withCredentials = true;
        headers.forEach((value, key) => xhr.setRequestHeader(key, value));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) options.onProgress?.(Math.round((100 * e.loaded) / e.total));
        };
        xhr.onerror = () => reject(new Error('Network failure. Retry the same operation.'));
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
            else {
              if (xhr.status === 401) onUnauthorized();
              reject(new ApiError(data.error ?? 'Upload failed.', xhr.status, data.errors));
            }
          } catch {
            reject(new Error('Unreadable server response.'));
          }
        };
        xhr.send(options.body as Blob);
      });
    }
    const response = await fetch('/api' + path, {
      ...options,
      headers,
      credentials: 'same-origin',
    });
    const data = await response
      .json()
      .catch(() => ({ error: 'Unreadable server response. Retry the same operation.' }));
    if (!response.ok) {
      if (response.status === 401 && path !== '/login') onUnauthorized();
      throw new ApiError(
        data.error ?? 'Request failed.',
        response.status,
        data.errors,
        response.headers.get('X-Request-ID') ?? undefined,
      );
    }
    return data as T;
  };
}
