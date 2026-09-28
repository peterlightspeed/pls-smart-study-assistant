import { CONFIG } from "./core/config.js";
import { initTheme } from "./core/theme.js";

initTheme();
const main = document.getElementById("main");
const notConfigured = [CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, CONFIG.API_ORIGIN].some((v) => v.includes("YOUR-"));

async function boot() {
  const { requireSession } = await import("./core/session.js");
  if (!(await requireSession())) return;

  const [{ renderNav, setActiveNav }, { startRouter }, { loadUserContext }, { syncQueue }, { initOfflineBanner }] = await Promise.all([
    import("./components/nav.js"), import("./core/router.js"), import("./core/store.js"), import("./core/api.js"), import("./components/banner.js"),
  ]);
  renderNav();
  initOfflineBanner();
  loadUserContext();                                   // background: theme, timezone, settings
  startRouter(main, setActiveNav);

  syncQueue();
  import("./core/reminders.js").then((m) => m.checkReminder());
  addEventListener("online", syncQueue);
}

if (notConfigured) {
  main.innerHTML = `<div class="pls-card"><h1 class="h3">Almost there</h1>
    <p class="mb-2">Add your Supabase URL, anon key and backend URL in <code>frontend/js/core/config.js</code>, then reload.</p>
    <p class="text-caption mb-0">See TODO.md for where to find each value.</p></div>`;
} else {
  boot().catch((e) => { console.error(e); main.innerHTML = '<div class="pls-card"><p class="mb-0">Something went wrong while starting the app. Reload to try again.</p></div>'; });
}

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW registration failed", e)));
}
