import { esc } from "../../core/utils.js";

export function render(outlet, route) {
  outlet.innerHTML = `
    <h1 class="mb-4">${esc(route.label)}</h1>
    <div class="pls-card empty-state">
      <i class="bi bi-${esc(route.icon)}" aria-hidden="true"></i>
      <p>${esc(route.label)} isn't available yet. It's coming soon.</p>
      <a class="btn btn-outline-secondary" href="#/home">Back to Home</a>
    </div>`;
}
