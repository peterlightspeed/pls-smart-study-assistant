import { api } from "../../core/api.js";
import { ROUTES } from "../../core/routes.js";
import { getTheme, setTheme } from "../../core/theme.js";

const THEMES = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];

export function render(outlet) {
  const items = ROUTES.filter((r) => !r.tab)
    .map((r) => `<a class="list-link" href="#/${r.path}"><i class="bi bi-${r.icon} fs-5" aria-hidden="true"></i><span class="flex-grow-1">${r.label}</span><i class="bi bi-chevron-right text-muted" aria-hidden="true"></i></a>`).join("");

  outlet.innerHTML = `<h1 class="mb-4">More</h1>
    <section class="pls-card" aria-label="Sections">${items}</section>
    <section class="pls-card" aria-labelledby="appearance"><h2 class="h3 mb-3" id="appearance">Appearance</h2>
      <div class="segmented" role="group" aria-label="Theme">${THEMES.map(([v, l]) => `<button type="button" data-theme="${v}" aria-pressed="${getTheme() === v}">${l}</button>`).join("")}</div></section>
    <button class="btn btn-outline-secondary w-100 mt-2" id="out" type="button"><i class="bi bi-box-arrow-right me-1" aria-hidden="true"></i>Sign out</button>`;

  outlet.querySelector(".segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-theme]");
    if (!btn) return;
    setTheme(btn.dataset.theme);
    api.patch("/me/settings", { theme: btn.dataset.theme }).catch(() => {});
    outlet.querySelectorAll(".segmented button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  });
  outlet.querySelector("#out").addEventListener("click", async () => (await import("../../core/session.js")).signOut());
}
