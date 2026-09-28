// Offline support: (1) last-good GET responses, (2) a small queue of writes to replay when back online.
// Everything is cleared on sign-out so a shared device never leaks another person's data.
const CACHE = "pls:cache:";
const QUEUE = "pls:queue";

export function cacheGet(key) {
  try { const v = localStorage.getItem(CACHE + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
}
export function cacheSet(key, data) {
  try { const s = JSON.stringify(data); if (s.length < 300_000) localStorage.setItem(CACHE + key, s); } catch { /* storage full or unavailable */ }
}
export function clearOfflineData() {
  try { Object.keys(localStorage).filter((k) => k.startsWith("pls:")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}

const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE) || "[]"); } catch { return []; } };
const writeQueue = (q) => { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch { /* ignore */ } };
export const queueSize = () => readQueue().length;

export function enqueue(job) {
  writeQueue([...readQueue(), { ...job, at: Date.now() }]);
  window.dispatchEvent(new CustomEvent("pls:queue-changed"));
}

let flushing = false;
/** Replays queued writes in order. Stops at the first network failure; drops jobs the server rejects (4xx). */
export async function flushQueue(send) {
  if (flushing) return;
  flushing = true;
  let done = 0;
  try {
    for (let q = readQueue(); q.length; q = readQueue()) {
      try { await send(q[0]); } catch (err) {
        if (err.status === 0 || err.status >= 500) break;   // still offline / server down: try again later
        window.dispatchEvent(new CustomEvent("pls:sync-failed", { detail: err }));
      }
      writeQueue(readQueue().slice(1));
      done++;
    }
  } finally {
    flushing = false;
    window.dispatchEvent(new CustomEvent("pls:queue-changed"));
    if (done) window.dispatchEvent(new CustomEvent("pls:synced"));
  }
}
