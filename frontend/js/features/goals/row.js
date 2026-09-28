import { dueLabel, esc } from "../../core/utils.js";

const PRIORITY = { low: "Low", medium: "Medium", high: "High" };

export function goalRow(g, cats) {
  const cat = cats.get(g.category_id);
  const done = g.status === "completed";
  const due = dueLabel(g.due_at);
  return `<div class="task ${done ? "done" : ""} ${g.pending ? "pending" : ""}" data-id="${esc(g.id)}">
    <button class="check" type="button" role="checkbox" aria-checked="${done}" data-toggle ${g.pending ? "disabled" : ""}
      aria-label="${done ? "Mark as not done" : "Mark as done"}: ${esc(g.title)}"><span><i class="bi bi-check-lg" aria-hidden="true"></i></span></button>
    <button class="task-body" type="button" data-edit ${g.pending ? "disabled" : ""}>
      <div class="task-title">${esc(g.title)}</div>
      <div class="task-meta">
        ${cat ? `<span class="d-inline-flex align-items-center gap-1"><i class="dot" style="background:${esc(cat.color)}"></i>${esc(cat.name)}</span>` : ""}
        ${g.due_at ? `<span class="${due.overdue && !done ? "tag-overdue" : ""}">${esc(due.text)}</span>` : ""}
        <span class="tag tag-${esc(g.priority)}">${PRIORITY[g.priority] ?? ""}</span>
        ${g.pending ? '<span class="tag">Waiting to sync</span>' : ""}
      </div></button></div>`;
}

export const emptyGoals = (msg) => `<div class="empty-state"><i class="bi bi-flag" aria-hidden="true"></i><p>${msg}</p></div>`;
