import { api } from "../../core/api.js";
import { debounce, esc, loadScript, loadStyle } from "../../core/utils.js";
import { confirmDialog } from "../../components/bottom-sheet.js";
import { toast } from "../../components/toast.js";

const QUILL = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist";

export async function renderEditor(outlet, id) {
  loadStyle(`${QUILL}/quill.snow.css`);
  const [note] = await Promise.all([api.get(`/notes/${id}`, { cache: false }), loadScript(`${QUILL}/quill.js`)]);

  outlet.innerHTML = `<div class="d-flex align-items-center gap-2 mb-2">
      <a class="btn btn-ghost" href="#/notes" aria-label="Back to notes"><i class="bi bi-chevron-left" aria-hidden="true"></i></a>
      <span class="text-caption me-auto" id="status" role="status">Saved</span>
      <button class="btn btn-ghost" id="pin" type="button" aria-pressed="${note.is_pinned}" aria-label="Pin note"><i class="bi bi-pin${note.is_pinned ? "-fill" : ""}" aria-hidden="true"></i></button>
      <button class="btn btn-ghost" id="del" type="button" aria-label="Delete note"><i class="bi bi-trash" aria-hidden="true"></i></button></div>
    <label class="visually-hidden" for="title">Title</label>
    <input class="note-title-input" id="title" maxlength="200" placeholder="Untitled" value="${note.title === "Untitled" ? "" : esc(note.title)}">
    <div id="editor"></div>`;

  const quill = new window.Quill(outlet.querySelector("#editor"), {
    theme: "snow",
    placeholder: "Start writing…",
    modules: { toolbar: [[{ header: [1, 2, 3, false] }], ["bold", "italic"], [{ list: "ordered" }, { list: "bullet" }, { list: "check" }]] },
  });
  if (note.content?.ops?.length) quill.setContents(note.content, "silent");

  const $status = outlet.querySelector("#status"), $title = outlet.querySelector("#title");
  let dirty = false, saving = null, deleted = false;

  async function save() {
    if (!dirty || deleted) return;
    dirty = false;
    $status.textContent = "Saving…";
    try {
      await api.patch(`/notes/${id}`, { title: $title.value.trim() || "Untitled", content: quill.getContents() });
      $status.textContent = dirty ? "Editing…" : "Saved";
    } catch (err) {
      dirty = true;
      $status.textContent = err.status === 0 ? "Offline. Will save when you're back." : "Couldn't save. Retrying…";
      if (err.status !== 0) setTimeout(autosave, 5000);
    }
  }
  const autosave = debounce(() => { saving = save(); }, 1500);
  const touch = () => { dirty = true; $status.textContent = "Editing…"; autosave(); };

  quill.on("text-change", (_d, _o, source) => source === "user" && touch());
  $title.addEventListener("input", touch);
  const onOnline = () => dirty && autosave.flush();
  window.addEventListener("online", onOnline);

  outlet.querySelector("#pin").addEventListener("click", async (e) => {
    const btn = e.currentTarget, next = btn.getAttribute("aria-pressed") !== "true";
    try {
      await api.patch(`/notes/${id}`, { is_pinned: next });
      btn.setAttribute("aria-pressed", String(next));
      btn.firstElementChild.className = `bi bi-pin${next ? "-fill" : ""}`;
    } catch (err) { toast(err.message, { type: "error" }); }
  });

  outlet.querySelector("#del").addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Delete this note?", message: "This can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    try { await api.delete(`/notes/${id}`); deleted = true; location.hash = "#/notes"; } catch (err) { toast(err.message, { type: "error" }); }
  });

  return async () => {                       // leaving the screen: never lose unsaved edits
    window.removeEventListener("online", onOnline);
    autosave.cancel();
    await saving;
    if (dirty) await save();
  };
}
