import { api } from "../../core/api.js";
import { fromInputValue, esc, toInputValue } from "../../core/utils.js";
import { confirmDialog, openSheet } from "../../components/bottom-sheet.js";

const radios = (name, options, current) => `<div class="radio-row">${options.map(([v, l]) =>
  `<label><input type="radio" name="${name}" value="${v}" ${v === current ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;

/** Create or edit a goal. onSaved(goal | {queued, payload}); onDelete(goal) is called after the user confirms. */
export function openGoalSheet({ goal = null, categories, onSaved, onDelete }) {
  const editing = !!goal;
  const form = document.createElement("form");
  form.noValidate = true;
  form.innerHTML = `
    <div id="err" class="alert alert-danger d-none" role="alert"></div>
    <div class="mb-3"><label class="form-label" for="g-title">Title</label>
      <input class="form-control" id="g-title" maxlength="200" required autocomplete="off" placeholder="What do you want to get done?" value="${esc(goal?.title)}"></div>
    <div class="mb-3"><label class="form-label" for="g-due">Deadline <span class="text-caption">(optional)</span></label>
      <input class="form-control" id="g-due" type="datetime-local" value="${toInputValue(goal?.due_at)}"></div>
    <div class="mb-3"><span class="form-label d-block">Priority</span>${radios("priority", [["low", "Low"], ["medium", "Medium"], ["high", "High"]], goal?.priority ?? "medium")}</div>
    <div class="mb-3"><label class="form-label" for="g-cat">Category</label>
      <select class="form-select" id="g-cat"><option value="">No category</option>
      ${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === goal?.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="mb-3"><span class="form-label d-block">Type</span>${radios("scope", [["daily", "Daily"], ["weekly", "Weekly"], ["long_term", "Long-term"]], goal?.scope ?? "daily")}</div>
    <div class="mb-4"><label class="form-label" for="g-desc">Notes <span class="text-caption">(optional)</span></label>
      <textarea class="form-control" id="g-desc" rows="2" maxlength="2000">${esc(goal?.description)}</textarea></div>
    <div class="d-flex gap-2">
      ${editing ? '<button type="button" class="btn btn-outline-secondary text-danger" id="del" aria-label="Delete goal"><i class="bi bi-trash" aria-hidden="true"></i></button>' : ""}
      <button type="button" class="btn btn-outline-secondary ms-auto" id="cancel">Cancel</button>
      <button type="submit" class="btn btn-primary" id="save">${editing ? "Save changes" : "Add goal"}</button></div>`;

  const sheet = openSheet({ title: editing ? "Edit goal" : "New goal", content: form });
  form.querySelector("#g-title").focus();
  form.querySelector("#cancel").addEventListener("click", sheet.close);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = form.querySelector("#err");
    const title = form.querySelector("#g-title").value.trim();
    if (!title) { err.textContent = "Give your goal a title."; err.classList.remove("d-none"); return; }
    const payload = {
      title,
      description: form.querySelector("#g-desc").value.trim() || null,
      category_id: form.querySelector("#g-cat").value || null,
      priority: form.priority.value,
      scope: form.scope.value,
      due_at: fromInputValue(form.querySelector("#g-due").value),
    };
    const btn = form.querySelector("#save");
    btn.disabled = true;
    try {
      const res = editing ? await api.patch(`/goals/${goal.id}`, payload, { queue: true }) : await api.post("/goals", payload, { queue: true });
      sheet.close();
      onSaved(res?.queued ? { queued: true, payload } : res);
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove("d-none"); btn.disabled = false;
    }
  });

  form.querySelector("#del")?.addEventListener("click", async () => {
    if (await confirmDialog({ title: "Delete this goal?", message: "It will be removed from your goals and calendar.", confirmLabel: "Delete", danger: true })) {
      sheet.close();
      onDelete(goal);
    }
  });
}
