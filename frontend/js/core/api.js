// Thin fetch wrapper for the FastAPI backend: auth header, timeouts, one error shape,
// last-good GET cache and an offline write queue (opt in per call with { queue: true }).
import { CONFIG } from "./config.js";
import { cacheGet, cacheSet, enqueue, flushQueue } from "./offline.js";

const TIMEOUT_MS = 20000;
let tokenProvider = async () => null;

export const setTokenProvider = (fn) => { tokenProvider = fn; };

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

async function send(method, path, { body, params, signal, auth = true } = {}) {
  const url = new URL(CONFIG.API_ORIGIN + path);
  Object.entries(params ?? {}).forEach(([k, v]) => v != null && v !== "" && url.searchParams.set(k, v));

  const headers = { Accept: "application/json" };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => timeout.abort(), { once: true });

  let res;
  try {
    res = await fetch(url, { method, headers, signal: timeout.signal, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, "network_error", "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    if (res.status === 401) window.dispatchEvent(new CustomEvent("pls:unauthorized"));
    throw new ApiError(res.status, e.code ?? "unknown_error", e.message ?? "Something went wrong.", e.details);
  }
  return data;
}

async function get(path, opts = {}) {
  const key = path + "?" + new URLSearchParams(opts.params ?? {}).toString();
  try {
    const data = await send("GET", path, opts);
    if (opts.cache !== false) cacheSet(key, data);
    return data;
  } catch (err) {
    if (err.status === 0 && opts.cache !== false) {
      const hit = cacheGet(key);
      if (hit !== undefined) { window.dispatchEvent(new CustomEvent("pls:offline-data")); return hit; }
    }
    throw err;
  }
}

async function write(method, path, body, opts = {}) {
  try {
    return await send(method, path, { body, ...opts });
  } catch (err) {
    if (err.status === 0 && opts.queue) { enqueue({ method, path, body }); return { queued: true }; }
    throw err;
  }
}

const v1 = (p) => CONFIG.API_PREFIX + p;

export const api = {
  health: (opts) => send("GET", "/health", { auth: false, ...opts }),
  get: (p, opts) => get(v1(p), opts),
  post: (p, body, opts) => write("POST", v1(p), body, opts),
  patch: (p, body, opts) => write("PATCH", v1(p), body, opts),
  delete: (p, opts) => write("DELETE", v1(p), undefined, opts),
};

export const syncQueue = () => flushQueue((j) => send(j.method, j.path, { body: j.body }));
