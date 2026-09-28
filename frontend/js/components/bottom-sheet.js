/** Bottom sheet on mobile, centered modal on desktop. Built on <dialog> for focus trapping and Esc handling. */
export function openSheet({ title, content, onClose }) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `<div class="sheet-grab" aria-hidden="true"></div>
    <header class="sheet-head"><h2 class="h3 mb-0"></h2><button type="button" class="btn-close" aria-label="Close"></button></header>
    <div class="sheet-body"></div>`;
  dlg.querySelector("h2").textContent = title;
  const body = dlg.querySelector(".sheet-body");
  typeof content === "string" ? (body.innerHTML = content) : content && body.append(content);
  document.body.append(dlg);

  const close = () => dlg.open && dlg.close();
  dlg.addEventListener("close", () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });   // click on the backdrop
  dlg.querySelector(".btn-close").addEventListener("click", close);
  dlg.showModal();
  return { el: dlg, body, close };
}

/** Promise<boolean>. Destructive actions always go through this. */
export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.innerHTML = `<p class="mb-4"></p><div class="d-flex gap-2 justify-content-end">
      <button type="button" class="btn btn-outline-secondary" data-act="no">Cancel</button>
      <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="yes"></button></div>`;
    box.querySelector("p").textContent = message;
    box.querySelector('[data-act="yes"]').textContent = confirmLabel;
    let answer = false;
    const sheet = openSheet({ title, content: box, onClose: () => resolve(answer) });
    box.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act) { answer = act === "yes"; sheet.close(); }
    });
  });
}
