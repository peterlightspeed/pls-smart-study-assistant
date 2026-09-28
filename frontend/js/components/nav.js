import { ROUTES, MORE } from "../core/routes.js";

const link = (r, cls = "nav-item") =>
  `<a class="${cls}" href="#/${r.path}" data-path="${r.path}"><i class="bi bi-${r.icon}" aria-hidden="true"></i><span>${r.label}</span></a>`;

export function renderNav() {
  document.getElementById("sidebar-nav").innerHTML = ROUTES.map((r) => link(r)).join("");
  document.getElementById("bottom-nav").innerHTML = [...ROUTES.filter((r) => r.tab), MORE].map((r) => link(r)).join("");
}

export function setActiveNav(route) {
  const inTabs = ROUTES.some((r) => r.tab && r.path === route.path);
  // Gallery, Analytics and Settings live under "More" on mobile.
  document.querySelectorAll("#sidebar-nav a").forEach((a) => toggle(a, a.dataset.path === route.path));
  document.querySelectorAll("#bottom-nav a").forEach((a) => toggle(a, inTabs ? a.dataset.path === route.path : a.dataset.path === MORE.path));
}

function toggle(a, on) { on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); }
