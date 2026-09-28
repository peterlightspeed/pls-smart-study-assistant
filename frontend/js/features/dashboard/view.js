import { api } from "../../core/api.js";
import { categoryMap, getCategories, getUserContext, whenReady } from "../../core/store.js";
import { dueLabel, esc, greeting } from "../../core/utils.js";
import { progressRing } from "../../components/progress-ring.js";
import { toast } from "../../components/toast.js";
import { openGoalSheet } from "../goals/form.js";
import { goalRow } from "../goals/row.js";

const bar = (done, total) => `<div class="pbar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>`;

export async function render(outlet) {
  outlet.innerHTML = `<header class="mb-4 d-flex align-items-start justify-content-between gap-3">
      <div><h1 class="mb-1" id="hello">${greeting()}</h1><p class="text-caption mb-0" id="date">${new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p></div>
      <div id="streak"></div></header>
    <div id="body"><div class="skeleton" style="height:120px"></div><div class="skeleton mt-3" style="height:200px"></div></div>`;
  const $body = outlet.querySelector("#body");
  let data = null, cats = new Map(), categories = [];

  whenReady().then(() => {
    const name = getUserContext()?.profile?.full_name?.split(" ")[0];
    if (name) outlet.querySelector("#hello").textContent = `${greeting()}, ${name}`;
  });

  function paint() {
    const d = data, delta = d.productivity_score - d.previous_score;
    outlet.querySelector("#streak").innerHTML = `<span class="streak" title="Study streak"><i class="bi bi-fire" aria-hidden="true"></i>${d.streak_days}-day streak</span>`;
    $body.innerHTML = `
      <section class="pls-card d-flex align-items-center gap-3" aria-labelledby="score-h">
        ${progressRing(d.productivity_score)}
        <div><h2 class="h3 mb-1" id="score-h">Productivity this week</h2>
          <p class="mb-0 ${delta >= 0 ? "delta-up" : "delta-down"}">${delta === 0 ? "Same as last week" : `${delta > 0 ? "+" : ""}${delta} vs last week`}</p>
          <p class="text-caption mb-0">Goals, study time and consistency.</p></div></section>

      <section class="pls-card" aria-labelledby="today-h">
        <div class="d-flex justify-content-between align-items-baseline mb-2"><h2 class="h3 mb-0" id="today-h">Today's goals</h2>
          <span class="text-caption">${d.today_progress.completed} / ${d.today_progress.total}</span></div>
        ${bar(d.today_progress.completed, d.today_progress.total)}
        <div class="mt-2" id="today-list">${d.today_goals.length ? d.today_goals.map((g) => goalRow(g, cats)).join("") : '<p class="text-caption my-3">Nothing planned for today.</p>'}</div>
        <button class="btn btn-ghost w-100 mt-1" type="button" id="add"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add goal</button></section>

      <section class="pls-card" aria-labelledby="week-h">
        <div class="d-flex justify-content-between align-items-baseline mb-2"><h2 class="h3 mb-0" id="week-h">Weekly goals</h2>
          <span class="text-caption">${d.weekly_goals.completed} / ${d.weekly_goals.total}</span></div>${bar(d.weekly_goals.completed, d.weekly_goals.total)}</section>

      <section class="pls-card" aria-labelledby="up-h"><h2 class="h3 mb-2" id="up-h">Upcoming deadlines</h2>
        ${d.upcoming_deadlines.length ? d.upcoming_deadlines.map((g) => `<div class="d-flex justify-content-between gap-3 py-2"><span class="text-truncate">${esc(g.title)}</span><span class="text-caption flex-none">${esc(dueLabel(g.due_at).text)}</span></div>`).join("")
          : '<p class="text-caption mb-0">No deadlines coming up.</p>'}</section>

      <section class="pls-card d-flex justify-content-between align-items-center"><span><strong>${d.completed_today}</strong> completed today</span><a href="#/goals">View goals</a></section>`;
  }

  async function load() {
    try {
      [data, categories] = await Promise.all([api.get("/dashboard/summary"), getCategories()]);
      cats = categoryMap(categories);
      paint();
    } catch (err) {
      $body.innerHTML = `<div class="pls-card empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>${esc(err.message)}</p><button class="btn btn-primary" id="retry">Try again</button></div>`;
      $body.querySelector("#retry").addEventListener("click", load);
    }
  }

  outlet.addEventListener("click", async (e) => {
    if (e.target.closest("#add")) return openGoalSheet({ categories, onSaved: (r) => (r.queued ? toast("Saved offline. It will sync when you're back online.") : load()) });
    const row = e.target.closest(".task");
    if (!row) return;
    const g = data.today_goals.find((x) => x.id === row.dataset.id);
    if (!g) return;
    if (e.target.closest("[data-toggle]")) {
      try { await api.post(`/goals/${g.id}/${g.status === "completed" ? "reopen" : "complete"}`, undefined, { queue: true }); load(); } catch (err) { toast(err.message, { type: "error" }); }
    } else if (e.target.closest("[data-edit]")) {
      openGoalSheet({ goal: g, categories, onSaved: load, onDelete: async (goal) => { try { await api.delete(`/goals/${goal.id}`); load(); } catch (err) { toast(err.message, { type: "error" }); } } });
    }
  });
  const onSynced = () => load();
  window.addEventListener("pls:synced", onSynced);
  await load();
  return () => window.removeEventListener("pls:synced", onSynced);
}
