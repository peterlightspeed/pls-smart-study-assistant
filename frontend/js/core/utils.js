export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.flush = (...a) => { clearTimeout(t); return fn(...a); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => ymd(a) === ymd(b);

/** ISO string -> value for <input type="datetime-local"> in the user's local time. */
export function toInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromInputValue = (v) => (v ? new Date(v).toISOString() : null);

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtDay = (d) => new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

/** Friendly deadline text, e.g. "Today, 5:00 PM", "Tomorrow", "Thu 26 Sep". */
export function dueLabel(iso, now = new Date()) {
  if (!iso) return { text: "", overdue: false };
  const d = new Date(iso);
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const time = fmtTime(iso);
  const text = days === 0 ? `Today, ${time}` : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : fmtDay(d);
  return { text, overdue: d < now };
}

export function fmtBytes(n) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = Object.assign(document.createElement("script"), { src, onload: resolve, onerror: () => reject(new Error(`Failed to load ${src}`)) });
    document.head.append(s);
  });
}
export function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
}
