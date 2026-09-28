import { api } from "../../core/api.js";
import { esc, loadScript } from "../../core/utils.js";

const CHARTJS = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
const RANGES = [["week", "Week"], ["month", "Month"], ["year", "Year"]];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const fmtLabel = (l, range) => {
  if (/^\d{4}-\d{2}$/.test(l)) return new Date(`${l}-01T12:00`).toLocaleDateString([], { month: "short" });
  const d = new Date(`${l}T12:00`);
  return range === "week" ? d.toLocaleDateString([], { weekday: "short" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

export async function render(outlet) {
  outlet.innerHTML = `<div class="d-flex align-items-center justify-content-between mb-3"><h1 class="mb-0">Analytics</h1>
      <div class="segmented" id="ranges" role="group" aria-label="Range">${RANGES.map(([v, l]) => `<button type="button" data-range="${v}">${l}</button>`).join("")}</div></div>
    ${[["hours", "Study hours"], ["goals", "Goals completed"], ["weekly", "Weekly progress"], ["monthly", "Monthly progress"]].map(([id, t]) =>
      `<section class="pls-card" aria-labelledby="${id}-h"><h2 class="h3 mb-3" id="${id}-h">${t}</h2><div class="chart-box"><canvas id="${id}" role="img" aria-label="${t} chart"></canvas></div><p class="text-caption mt-2 mb-0 d-none" id="${id}-empty">No data yet. Complete a goal or study session to see it here.</p></section>`).join("")}`;

  await loadScript(CHARTJS);
  const { Chart } = window;
  Chart.defaults.font.family = css("--pls-font");
  Chart.defaults.color = css("--pls-muted");
  Chart.defaults.borderColor = css("--pls-border");
  const charts = {};
  let range = "week";

  function draw(id, type, labels, datasets, opts = {}) {
    charts[id]?.destroy();
    const empty = datasets.every((d) => d.data.every((v) => !v));
    outlet.querySelector(`#${id}-empty`).classList.toggle("d-none", !empty);
    charts[id] = new Chart(outlet.querySelector(`#${id}`), {
      type, data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        plugins: { legend: { display: datasets.length > 1, position: "bottom" } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ...opts.y } } },
    });
  }
  const primary = () => css("--pls-primary"), success = () => css("--pls-success");
  const ds = (label, data, color, type) => ({ label, data, backgroundColor: color, borderColor: color, borderRadius: 6, tension: .35, ...(type === "line" ? { fill: false, pointRadius: 3 } : {}) });

  async function loadRange() {
    outlet.querySelectorAll("#ranges button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === range)));
    const [h, g] = await Promise.all([api.get("/analytics/study-hours", { params: { range } }), api.get("/analytics/goals-completed", { params: { range } })]);
    const labels = h.labels.map((l) => fmtLabel(l, range));
    draw("hours", "bar", labels, [ds("Hours", h.values, primary())]);
    draw("goals", "line", labels, [ds("Goals", g.values, success(), "line")], { y: { ticks: { precision: 0 } } });
  }

  try {
    const [w, m] = await Promise.all([api.get("/analytics/progress", { params: { period: "weekly" } }), api.get("/analytics/progress", { params: { period: "monthly" } })]);
    draw("weekly", "line", w.labels.map((l) => fmtLabel(l, "month")), [ds("Score", w.score, primary(), "line")], { y: { max: 100 } });
    draw("monthly", "bar", m.labels.map((l) => fmtLabel(l, "year")), [ds("Goals completed", m.goals_completed, success()), ds("Study hours", m.study_hours, primary())]);
    await loadRange();
  } catch (err) {
    outlet.insertAdjacentHTML("beforeend", `<div class="pls-card empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>${esc(err.message)}</p></div>`);
  }

  outlet.querySelector("#ranges").addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (b) { range = b.dataset.range; loadRange().catch(() => {}); }
  });
  return () => Object.values(charts).forEach((c) => c.destroy());
}
