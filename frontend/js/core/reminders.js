// Daily study reminder. Runs when the app is open. True background push (app closed) needs a server job: see TODO.md.
import { api } from "./api.js";
import { getUserContext, whenReady } from "./store.js";

export async function checkReminder() {
  await whenReady();
  const s = getUserContext()?.settings;
  if (!s?.notifications_enabled || !s.reminder_time || !("Notification" in window) || Notification.permission !== "granted") return;
  const today = new Date().toDateString();
  try { if (localStorage.getItem("pls-reminded") === today) return; } catch { return; }
  const [h, m] = s.reminder_time.split(":").map(Number);
  const due = new Date(); due.setHours(h, m, 0, 0);
  if (new Date() < due) return;
  try {
    const sum = await api.get("/dashboard/summary", { cache: false });
    if (sum.completed_today > 0) return;                       // already studied today: don't nag
    const reg = await navigator.serviceWorker?.getRegistration();
    const title = sum.streak_days ? `Keep your ${sum.streak_days}-day streak going` : "Time to study";
    const opts = { body: "Complete a goal or study session today.", icon: "/assets/icons/icon-192.png", tag: "pls-daily" };
    reg ? await reg.showNotification(title, opts) : new Notification(title, opts);
    localStorage.setItem("pls-reminded", today);
  } catch { /* best effort */ }
}
