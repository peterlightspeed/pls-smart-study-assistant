import { api } from "../../core/api.js";
import { getCategories, getUserContext, whenReady } from "../../core/store.js";
import { addDays, dueLabel, esc, fmtTime, sameDay, startOfDay, ymd } from "../../core/utils.js";
import { toast } from "../../components/toast.js";
import { openCompleteSheet, openSessionSheet } from "./form.js";

const MODES = [["month", "Month"], ["week", "Week"], ["day", "Day"]];

export async function render(outlet) {
  await whenReady();
  const sunFirst = getUserContext()?.settings?.week_starts_on === 7;
  const firstDow = sunFirst ? 0 : 1;

  let mode = "month", anchor = startOfDay(new Date());
  let data = { sessions: [], deadlines: [] }, range = null, categories = [], goals = [];

  outlet.innerHTML = `<div class="d-flex align-items-center justify-content-between mb-3"><h1 class="mb-0">Planner</h1>
      <div class="segmented" id="modes" role="group" aria-label="Calendar view">${MODES.map(([v, l]) => `<button type="button" data-mode="${v}">${l}</button>`).join("")}</div></div>
    <section class="pls-card" id="cal"></section>
    <section class="pls-card" id="agenda" aria-live="polite"></section>
    <button class="fab" id="add" type="button" aria-label="Plan a study session"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>`;
  const $cal = outlet.querySelector("#cal"), $agenda = outlet.querySelector("#agenda");

  const weekStart = (d) => addDays(d, -((d.getDay() - firstDow + 7) % 7));
  function computeRange() {
    if (mode === "day") return [anchor, addDays(anchor, 1)];
    if (mode === "week") { const s = weekStart(anchor); return [s, addDays(s, 7)]; }
    const s = weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1)); return [s, addDays(s, 42)];
  }
  const inRange = (d) => range && d >= range[0] && d < range[1];

  async function fetchData() {
    range = computeRange();
    try {
      data = await api.get("/calendar", { params: { from: range[0].toISOString(), to: range[1].toISOString() } });
    } catch (err) { data = { sessions: [], deadlines: [] }; toast(err.message, { type: "error" }); }
    paint();
  }

  const dayItems = (d) => ({
    sessions: data.sessions.filter((s) => sameDay(new Date(s.scheduled_start), d)),
    deadlines: data.deadlines.filter((g) => sameDay(new Date(g.due_at), d)),
  });

  function title() {
    if (mode === "month") return anchor.toLocaleDateString([], { month: "long", year: "numeric" });
    if (mode === "week") { const s = weekStart(anchor), e = addDays(s, 6); return `${s.toLocaleDateString([], { day: "numeric", month: "short" })} – ${e.toLocaleDateString([], { day: "numeric", month: "short" })}`; }
    return anchor.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  }

  function paint() {
    outlet.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const dows = [...Array(7)].map((_, i) => new Date(2024, 0, 7 + ((firstDow + i) % 7)).toLocaleDateString([], { weekday: "narrow" }));
    let grid = "";
    if (mode !== "day") {
      const n = mode === "month" ? 42 : 7, today = new Date();
      grid = `<div class="cal" role="grid">${dows.map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join("")}` +
        [...Array(n)].map((_, i) => {
          const d = addDays(range[0], i), it = dayItems(d);
          const dots = it.sessions.slice(0, 3).map(() => "<i></i>").join("") + (it.deadlines.length ? '<i class="dl"></i>' : "");
          return `<button type="button" class="cal-day ${mode === "month" && d.getMonth() !== anchor.getMonth() ? "muted" : ""} ${sameDay(d, today) ? "today" : ""}"
            data-day="${ymd(d)}" aria-pressed="${sameDay(d, anchor)}" aria-label="${d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}${it.sessions.length ? `, ${it.sessions.length} sessions` : ""}">
            <span>${d.getDate()}</span><span class="cal-dots">${dots}</span></button>`;
        }).join("") + "</div>";
    }
    $cal.innerHTML = `<div class="d-flex align-items-center justify-content-between mb-2">
        <button class="btn btn-ghost" data-nav="-1" type="button" aria-label="Previous"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
        <h2 class="h3 mb-0">${esc(title())}</h2>
        <button class="btn btn-ghost" data-nav="1" type="button" aria-label="Next"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>${grid}`;
    paintAgenda();
  }

  function paintAgenda() {
    const { sessions, deadlines } = dayItems(anchor);
    const items = [
      ...sessions.map((s) => ({ t: new Date(s.scheduled_start), html: sessionHtml(s) })),
      ...deadlines.map((g) => ({ t: new Date(g.due_at), html: `<div class="session"><div class="session-time">${esc(fmtTime(g.due_at))}</div><div class="flex-grow-1">
          <div class="fw-medium"><i class="bi bi-flag me-1" style="color:var(--pls-danger)" aria-hidden="true"></i>${esc(g.title)}</div>
          <div class="text-caption">Goal deadline${g.status === "completed" ? " · done" : dueLabel(g.due_at).overdue ? " · overdue" : ""}</div></div></div>` })),
    ].sort((a, b) => a.t - b.t);
    $agenda.innerHTML = `<h2 class="h3 mb-2">${anchor.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</h2>` +
      (items.length ? items.map((i) => i.html).join("") : `<div class="empty-state py-4"><i class="bi bi-calendar2" aria-hidden="true"></i><p class="mb-0">Nothing planned. Tap + to plan a study session.</p></div>`);
  }

  function sessionHtml(s) {
    const open = s.status === "planned" || s.status === "in_progress";
    const meta = s.status === "completed" ? `Planned ${s.planned_minutes} · actual ${s.actual_minutes} min`
      : s.status === "skipped" ? "Skipped" : `${s.planned_minutes} min${s.status === "in_progress" ? " · in progress" : ""}`;
    return `<div class="session" data-sid="${esc(s.id)}"><div class="session-time">${esc(fmtTime(s.scheduled_start))}</div>
      <div class="flex-grow-1 min-w-0"><button type="button" class="task-body p-0 w-100" data-act="edit"><div class="task-title ${s.status === "skipped" ? "text-decoration-line-through text-muted" : ""}">
        ${s.status === "completed" ? '<i class="bi bi-check-circle-fill me-1" style="color:var(--pls-success)" aria-hidden="true"></i>' : ""}${esc(s.title)}</div>
        <div class="text-caption">${esc(meta)}</div></button>
        ${open ? `<div class="d-flex gap-2 mt-2">
          ${s.status === "planned" ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-act="start">Start</button>' : ""}
          <button type="button" class="btn btn-primary btn-sm" data-act="complete">Complete</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="skip">Skip</button></div>` : ""}</div></div>`;
  }

  const replace = (s) => { data.sessions = data.sessions.some((x) => x.id === s.id) ? data.sessions.map((x) => (x.id === s.id ? s : x)) : [...data.sessions, s]; paint(); };

  async function openForm(session = null) {
    if (!categories.length) [categories, goals] = await Promise.all([getCategories(), api.get("/goals", { params: { status: "active", limit: 200 } }).catch(() => [])]);
    const def = new Date(anchor); def.setHours(Math.max(new Date().getHours() + 1, 8), 0, 0, 0);
    openSessionSheet({ session, defaultStart: def, categories, goals,
      onSaved: (s) => { anchor = startOfDay(new Date(s.scheduled_start)); inRange(anchor) ? replace(s) : fetchData(); },
      onDeleted: (s) => { data.sessions = data.sessions.filter((x) => x.id !== s.id); paint(); } });
  }

  outlet.addEventListener("click", async (e) => {
    const t = e.target;
    const mBtn = t.closest("[data-mode]"), nav = t.closest("[data-nav]"), day = t.closest("[data-day]"), act = t.closest("[data-act]");
    if (mBtn) { mode = mBtn.dataset.mode; await fetchData(); }
    else if (nav) {
      const n = Number(nav.dataset.nav);
      anchor = mode === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1) : addDays(anchor, n * (mode === "week" ? 7 : 1));
      await fetchData();
    } else if (day) { const [y, m, d] = day.dataset.day.split("-").map(Number); anchor = new Date(y, m - 1, d); paint(); }
    else if (t.closest("#add")) openForm();
    else if (act) {
      const s = data.sessions.find((x) => x.id === act.closest("[data-sid]")?.dataset.sid);
      if (!s) return;
      try {
        if (act.dataset.act === "edit") openForm(s);
        else if (act.dataset.act === "start") replace(await api.post(`/study-sessions/${s.id}/start`));
        else if (act.dataset.act === "skip") replace(await api.post(`/study-sessions/${s.id}/skip`));
        else if (act.dataset.act === "complete") openCompleteSheet(s, (done) => { replace(done); toast("Session complete. Nice work!"); });
      } catch (err) { toast(err.message, { type: "error" }); }
    }
  });

  await fetchData();
}
