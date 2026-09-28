import { api } from "../../core/api.js";
import { debounce, esc } from "../../core/utils.js";
import { toast } from "../../components/toast.js";

export async function render(outlet, route, params = []) {
  if (params[0]) return (await import("./editor.js")).renderEditor(outlet, params[0]);

  outlet.innerHTML = `<h1 class="mb-3">Notes</h1>
    <label class="visually-hidden" for="note-search">Search notes</label>
    <input id="note-search" class="form-control mb-3" type="search" placeholder="Search notes" autocomplete="off">
    <section class="pls-card" id="list" aria-live="polite"><div class="skeleton" style="height:48px"></div><div class="skeleton mt-2" style="height:48px"></div></section>
    <button class="fab" id="add" type="button" aria-label="New note"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>`;
  const $list = outlet.querySelector("#list");
  let seq = 0;

  async function load(q = "") {
    const mine = ++seq;
    try {
      const notes = await api.get("/notes", { params: { q } });
      if (mine !== seq) return;
      $list.innerHTML = notes.length ? notes.map((n) => `<a class="note-row" href="#/notes/${esc(n.id)}">
          <div class="note-title">${n.is_pinned ? '<i class="bi bi-pin-angle-fill me-1" style="color:var(--pls-primary)" aria-label="Pinned"></i>' : ""}${esc(n.title)}</div>
          <div class="note-preview">${esc(n.preview) || "No content yet"}</div>
          <div class="text-caption">${new Date(n.updated_at).toLocaleDateString([], { day: "numeric", month: "short" })}</div></a>`).join("")
        : `<div class="empty-state"><i class="bi bi-journal-text" aria-hidden="true"></i><p>${q ? "No notes match your search." : "No notes yet. Tap + to write your first one."}</p></div>`;
    } catch (err) { $list.innerHTML = `<div class="empty-state"><p>${esc(err.message)}</p></div>`; }
  }

  outlet.querySelector("#note-search").addEventListener("input", debounce((e) => load(e.target.value.trim()), 300));
  outlet.querySelector("#add").addEventListener("click", async () => {
    try { const n = await api.post("/notes", { title: "Untitled", content: { ops: [] } }); location.hash = `#/notes/${n.id}`; }
    catch (err) { toast(err.message, { type: "error" }); }
  });
  await load();
}
