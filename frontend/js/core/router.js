// Minimal hash router (#/goals, #/notes/<id>). Views export `render(outlet, route, params)`
// and may return a cleanup function.
import { findRoute, loadView } from "./routes.js";

export function startRouter(outlet, onChange) {
  let cleanup = null;
  let navId = 0;

  async function navigate() {
    const id = ++navId;
    const [path, ...params] = (location.hash.replace(/^#\/?/, "").split("?")[0] || "home").split("/");
    const route = findRoute(path) ?? findRoute("home");

    await cleanup?.();
    cleanup = null;
    onChange(route);
    outlet.innerHTML = '<div class="skeleton" style="height:28px;width:55%"></div><div class="skeleton mt-3" style="height:120px"></div>';

    try {
      const view = await loadView(route);
      if (id !== navId) return;
      outlet.innerHTML = "";
      const container = document.createElement("div");   // fresh node per view: its event listeners die with it
      outlet.append(container);
      cleanup = (await view.render(container, route, params)) ?? null;
      outlet.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      if (id !== navId) return;
      outlet.innerHTML = `<div class="pls-card empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i>
        <p>This screen couldn't load. Check your connection and try again.</p>
        <button class="btn btn-primary" id="retry">Try again</button></div>`;
      outlet.querySelector("#retry").addEventListener("click", navigate);
    }
  }

  addEventListener("hashchange", navigate);
  navigate();
}
