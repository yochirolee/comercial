/**
 * Prefetch cache — stores API results in memory for a short TTL.
 * Pages consume the cache via cacheWrap(); the Sidebar triggers
 * prefetchRoute() on hover so data is already in-flight (or ready)
 * by the time the user clicks.
 */

import {
  clientesApi,
  productosApi,
  ofertasClienteApi,
  ofertasImportadoraApi,
  ofertasGeneralesApi,
  facturasApi,
  operationsApi,
  importadorasApi,
  unidadesApi,
} from "@/lib/api";

const CACHE_TTL = 60_000; // 1 minute

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, CacheEntry<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<string, Promise<any>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

/** Remove one or more keys from the cache so the next cacheWrap fetches fresh data. */
export function cacheDelete(...keys: string[]): void {
  for (const key of keys) {
    store.delete(key);
    pending.delete(key);
  }
}

/**
 * Wraps a fetcher with cache + in-flight deduplication.
 * - If cached: returns cached value instantly.
 * - If already fetching: returns the same promise (no duplicate request).
 * - Otherwise: starts the fetch, caches the result.
 */
export function cacheWrap<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return Promise.resolve(cached);

  const inFlight = pending.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  const promise = fetcher()
    .then((data) => {
      cacheSet(key, data);
      pending.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      pending.delete(key);
      throw err;
    });

  pending.set(key, promise);
  return promise;
}

/** Trigger prefetch for all APIs needed by a given route. Fire-and-forget. */
const routePrefetchMap: Record<string, () => void> = {
  "/": () => {
    cacheWrap("clientes", () => clientesApi.getAll());
    cacheWrap("productos", () => productosApi.getAll());
    cacheWrap("ofertas-cliente", () => ofertasClienteApi.getAll());
    cacheWrap("ofertas-importadora", () => ofertasImportadoraApi.getAll());
    cacheWrap("ofertas-generales", () => ofertasGeneralesApi.getAll());
    cacheWrap("facturas", () => facturasApi.getAll());
    cacheWrap("operaciones", () => operationsApi.getAll());
  },
  "/ofertas/cliente": () => {
    cacheWrap("ofertas-cliente", () => ofertasClienteApi.getAll());
    cacheWrap("ofertas-generales", () => ofertasGeneralesApi.getAll());
    cacheWrap("clientes", () => clientesApi.getAll());
    cacheWrap("productos", () => productosApi.getAll());
    cacheWrap("unidades", () => unidadesApi.getAll());
  },
  "/ofertas/importadora": () => {
    cacheWrap("ofertas-importadora", () => ofertasImportadoraApi.getAll());
    cacheWrap("ofertas-cliente", () => ofertasClienteApi.getAll());
    cacheWrap("clientes", () => clientesApi.getAll());
    cacheWrap("importadoras", () => importadorasApi.getAll());
    cacheWrap("productos", () => productosApi.getAll());
    cacheWrap("unidades", () => unidadesApi.getAll());
  },
  "/facturas": () => {
    cacheWrap("facturas", () => facturasApi.getAll());
    cacheWrap("ofertas-cliente", () => ofertasClienteApi.getAll());
    cacheWrap("ofertas-importadora", () => ofertasImportadoraApi.getAll());
    cacheWrap("importadoras", () => importadorasApi.getAll());
    cacheWrap("productos", () => productosApi.getAll());
    cacheWrap("unidades", () => unidadesApi.getAll());
  },
  "/operations": () => {
    cacheWrap("operaciones", () => operationsApi.getAll());
    cacheWrap("importadoras", () => importadorasApi.getAll());
    cacheWrap("ofertas-cliente", () => ofertasClienteApi.getAll());
  },
};

export function prefetchRoute(href: string): void {
  routePrefetchMap[href]?.();
}
