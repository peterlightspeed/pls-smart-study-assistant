import { api } from "../../core/api.js";
import { categoryMap, getCategories } from "../../core/store.js";
import { addDays, esc } from "../../core/utils.js";
import { toast } from "../../components/toast.js";
import { openGoalSheet } from "./form.js";
import { emptyGoals, goalRow } from "./row.js";

const FILTERS = [["all", "All"], ["today", "Today"], ["week", "This week"], ["done", "Done"]];

export async function render(outlet) {
  outlet.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3"><h1 class="mb-0">Goals</h1></div>
    <label class="visually-hidden" for="goal-search">Search goals</label>
    <input id="goal-search" class="form-control mb-3" type="search" placeholder="Search goals" autocomplete="off">
    <div class="chips" id="filters" role="group" aria-label="Filter goals"></div>
    <div class="chips" id="cats" role="group" aria-label="Filter by category"></div>
    <section class="pls-card" id="list" aria-live="polite"><div class="skeleton" style="height:48px"></div><div class="skeleton mt-2" style="height:48px"></div><div class="skeleton mt-2" style="height:48px"></div></section>
    <button class="fab" id="add" type="button" aria-label="Add goal"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>`;

  let goals = [], categories = [], cats = new Map();
  let filter = "all", catFilter = null, query = "";
  const pendingDeletes = new Set();
  const $list = outlet.querySelector("#list");

  const visible = () => {
    const now = new Date(), eod = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1), week = addDays(now, 7);
    return goals.filter((g) => {
      const active = g.status === "active", due = g.due_at ? new Date(g.due_at) : null;
      if (filter === "done" && g.status !== "completed") return false;
      if (filter === "today" && !(active && ((due && due < eod) || (g.scope === "daily" && !due)))) return false;
      if (filter === "week" && !(active && (g.scope === "weekly" || (due && due < week)))) return false;
      if (catFilter && g.category_id !== catFilter) return false;
      return !query || g.title.toLowerCase().includes(query);
    });
  };

  function paint() {
    outlet.querySelector("#filters").innerHTML = FILTERS.map(([v, l]) => `<button class="chip" type="button" data-filter="${v}" aria-pressed="${filter === v}">${l}</button>`).join("");
    outlet.querySelector("#cats").innerHTML = categories.map((c) =>
      `<button class="chip" type="button" data-cat="${esc(c.id)}" aria-pressed="${catFilter === c.id}"><i class="dot me-1" style="background:${esc(c.color)}"></i>${esc(c.name)}</button>`).join("");
    const rows = visible();
    $list.innerHTML = rows.length ? rows.map((g) => goalRow(g, cats)).join("")
      : emptyGoals(goals.length ? "No goals match this filter." : "No goals yet. Tap + to add your first one.");
  }

  async function load() {
    try {
      [goals, categories] = await Promise.all([api.get("/goals", { params: { limit: 200 } }), getCategories()]);
      cats = categoryMap(categories);
      paint();
    } catch (err) {
      $list.innerHTML = `<div class="empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>${esc(err.message)}</p><button class="btn btn-primary" id="retry">Try again</button></div>`;
      $list.querySelector("#retry").addEventListener("click", load);
    }
  }

  async function toggle(id) {
    const g = goals.find((x) => x.id === id);
    if (!g || g.pending) return;
    const before = { status: g.status, completed_at: g.completed_at };
    const done = g.status !== "completed";
    Object.assign(g, { status: done ? "completed" : "active", completed_at: done ? new Date().toISOString() : null });
    paint();
    try {
      const res = await api.post(`/goals/${id}/${done ? "complete" : "reopen"}`, undefined, { queue: true });
      if (res && !res.queued) Object.assign(g, res);
      if (res?.queued) toast("Saved offline. It will sync when you're back online.");
    } catch (err) {
      Object.assign(g, before); paint(); toast(err.message, { type: "error" });
    }
  }

  function remove(goal) {
    goals = goals.filter((g) => g.id !== goal.id);
    paint();
    const entry = { goal };
    entry.timer = setTimeout(async () => {
      pendingDeletes.delete(entry);
      try { await api.delete(`/goals/${goal.id}`, { queue: true }); } catch (err) { goals.push(goal); paint(); toast(err.message, { type: "error" }); }
    }, 5000);
    pendingDeletes.add(entry);
    toast("Goal deleted", { actionLabel: "Undo", duration: 5000, onAction: () => {
      clearTimeout(entry.timer); pendingDeletes.delete(entry); goals.push(goal); load();
    } });
  }

  const openForm = (goal = null) => openGoalSheet({
    goal, categories,
    onSaved: (res) => {
      if (res.queued) {
        goals.unshift({ id: `tmp_${Date.now()}`, status: "active", completed_at: null, description: null, category_id: null, due_at: null, ...res.payload, pending: true });
        paint(); toast("Saved offline. It will sync when you're back online.");
      } else { load(); }
    },
    onDelete: remove,
  });

  outlet.addEventListener("click", (e) => {
    const row = e.target.closest(".task"), chip = e.target.closest(".chip");
    if (chip?.dataset.filter) { filter = chip.dataset.filter; paint(); }
    else if (chip?.dataset.cat) { catFilter = catFilter === chip.dataset.cat ? null : chip.dataset.cat; paint(); }
    else if (e.target.closest("#add")) openForm();
    else if (row && e.target.closest("[data-toggle]")) toggle(row.dataset.id);
    else if (row && e.target.closest("[data-edit]")) openForm(goals.find((g) => g.id === row.dataset.id));
  });
  outlet.querySelector("#goal-search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); paint(); });
  const onSynced = () => load();
  window.addEventListener("pls:synced", onSynced);

  await load();
  return () => {
    window.removeEventListener("pls:synced", onSynced);
    for (const p of pendingDeletes) { clearTimeout(p.timer); api.delete(`/goals/${p.goal.id}`, { queue: true }).catch(() => {}); }  // commit deletions if the user navigates away
  };
}
