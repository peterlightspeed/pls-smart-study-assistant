import { queueSize } from "../core/offline.js";

/** Small banner shown while offline or while queued changes wait to sync. */
export function initOfflineBanner() {
  const el = Object.assign(document.createElement("div"), { className: "offline-banner", hidden: true });
  el.setAttribute("role", "status");
  document.body.append(el);
  const update = () => {
    const pending = queueSize();
    const offline = !navigator.onLine;
    el.hidden = !offline && !pending;
    el.textContent = offline
      ? `You're offline. ${pending ? `${pending} change${pending > 1 ? "s" : ""} will sync when you're back.` : "Showing saved data."}`
      : `Syncing ${pending} change${pending > 1 ? "s" : ""}…`;
  };
  ["online", "offline", "pls:queue-changed", "pls:offline-data"].forEach((e) => window.addEventListener(e, update));
  update();
}
