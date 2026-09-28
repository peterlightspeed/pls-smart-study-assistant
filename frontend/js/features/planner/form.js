import { api } from "../../core/api.js";
import { esc, fromInputValue, toInputValue } from "../../core/utils.js";
import { confirmDialog, openSheet } from "../../components/bottom-sheet.js";

/** Create/edit a study session. onSaved(session), onDeleted(session). */
export function openSessionSheet({ session = null, defaultStart, categories, goals, onSaved, onDeleted }) {
  const editing = !!session;
  const form = document.createElement("form");
  form.noValidate = true;
  form.innerHTML = `
    <div id="err" class="alert alert-danger d-none" role="alert"></div>
    <div class="mb-3"><label class="form-label" for="s-title">What will you study?</label>
      <input class="form-control" id="s-title" maxlength="200" required autocomplete="off" placeholder="e.g. Calculus revision" value="${esc(session?.title)}"></div>
    <div class="mb-3"><label class="form-label" for="s-start">Starts</label>
      <input class="form-control" id="s-start" type="datetime-local" required value="${toInputValue(session?.scheduled_start ?? defaultStart.toISOString())}"></div>
    <div class="mb-3"><label class="form-label" for="s-min">Planned time (minutes)</label>
      <input class="form-control mb-2" id="s-min" type="number" inputmode="numeric" min="5" max="720" step="5" required value="${session?.planned_minutes ?? 60}">
      <div class="chips" role="group" aria-label="Quick durations">${[25, 45, 60, 90, 120].map((m) => `<button type="button" class="chip" data-min="${m}">${m} min</button>`).join("")}</div></div>
    <div class="mb-3"><label class="form-label" for="s-goal">Link to a goal <span class="text-caption">(optional)</span></label>
      <select class="form-select" id="s-goal"><option value="">No goal</option>
      ${goals.map((g) => `<option value="${esc(g.id)}" ${g.id === session?.goal_id ? "selected" : ""}>${esc(g.title)}</option>`).join("")}</select></div>
    <div class="mb-4"><label class="form-label" for="s-cat">Category <span class="text-caption">(optional)</span></label>
      <select class="form-select" id="s-cat"><option value="">No category</option>
      ${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === session?.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="d-flex gap-2">
      ${editing ? '<button type="button" class="btn btn-outline-secondary text-danger" id="del" aria-label="Delete session"><i class="bi bi-trash" aria-hidden="true"></i></button>' : ""}
      <button type="button" class="btn btn-outline-secondary ms-auto" id="cancel">Cancel</button>
      <button type="submit" class="btn btn-primary" id="save">${editing ? "Save changes" : "Add session"}</button></div>`;

  const sheet = openSheet({ title: editing ? "Edit session" : "Plan a study session", content: form });
  form.querySelector("#s-title").focus();
  form.querySelector("#cancel").addEventListener("click", sheet.close);
  form.querySelectorAll("[data-min]").forEach((b) => b.addEventListener("click", () => { form.querySelector("#s-min").value = b.dataset.min; }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = form.querySelector("#err"), fail = (m) => { err.textContent = m; err.classList.remove("d-none"); };
    const title = form.querySelector("#s-title").value.trim(), start = fromInputValue(form.querySelector("#s-start").value);
    const minutes = Number(form.querySelector("#s-min").value);
    if (!title) return fail("Give the session a title.");
    if (!start) return fail("Choose when it starts.");
    if (!(minutes >= 5 && minutes <= 720)) return fail("Planned time must be between 5 and 720 minutes.");
    const payload = { title, scheduled_start: start, planned_minutes: minutes, goal_id: form.querySelector("#s-goal").value || null, category_id: form.querySelector("#s-cat").value || null };
    const btn = form.querySelector("#save");
    btn.disabled = true;
    try {
      const res = editing ? await api.patch(`/study-sessions/${session.id}`, payload) : await api.post("/study-sessions", payload);
      sheet.close(); onSaved(res);
    } catch (ex) { fail(ex.message); btn.disabled = false; }
  });

  form.querySelector("#del")?.addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Delete this session?", message: "It will be removed from your planner.", confirmLabel: "Delete", danger: true }))) return;
    try { await api.delete(`/study-sessions/${session.id}`); sheet.close(); onDeleted(session); } catch (ex) { fail(ex.message); }
  });
}

/** Asks how long you actually studied, then completes the session. */
export function openCompleteSheet(session, onDone) {
  const form = document.createElement("form");
  form.innerHTML = `<div id="err" class="alert alert-danger d-none" role="alert"></div>
    <p class="mb-3">${esc(session.title)}</p>
    <label class="form-label" for="c-min">Minutes studied</label>
    <input class="form-control mb-4" id="c-min" type="number" inputmode="numeric" min="0" max="1440" required value="${session.planned_minutes}">
    <div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-outline-secondary" id="cancel">Cancel</button><button class="btn btn-primary" type="submit">Mark complete</button></div>`;
  const sheet = openSheet({ title: "Finish session", content: form });
  form.querySelector("#cancel").addEventListener("click", sheet.close);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { const res = await api.post(`/study-sessions/${session.id}/complete`, { actual_minutes: Number(form.querySelector("#c-min").value) }); sheet.close(); onDone(res); }
    catch (ex) { const err = form.querySelector("#err"); err.textContent = ex.message; err.classList.remove("d-none"); }
  });
}
