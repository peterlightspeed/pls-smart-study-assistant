import { api } from "../../core/api.js";
import { debounce, esc, fmtBytes } from "../../core/utils.js";
import { confirmDialog, openSheet } from "../../components/bottom-sheet.js";
import { toast } from "../../components/toast.js";
import { compressImage } from "./compress.js";

const TYPES = [["", "All"], ["certificate", "Certificates"], ["assignment", "Assignments"], ["note", "Notes"], ["image", "Images"]];
const typeOptions = (cur) => TYPES.slice(1).map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l.replace(/s$/, "")}</option>`).join("");
const saved = (i) => (i.original_size_bytes > i.size_bytes ? Math.round((1 - i.size_bytes / i.original_size_bytes) * 100) : 0);

export async function render(outlet) {
  outlet.innerHTML = `<h1 class="mb-3">Gallery</h1>
    <label class="visually-hidden" for="g-search">Search gallery</label>
    <input id="g-search" class="form-control mb-3" type="search" placeholder="Search by title" autocomplete="off">
    <div class="chips" id="types" role="group" aria-label="Filter by type"></div>
    <section class="pls-card" id="grid" aria-live="polite"></section>
    <button class="fab" id="add" type="button" aria-label="Add to gallery"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>`;
  const $grid = outlet.querySelector("#grid");
  let type = "", q = "", items = [], seq = 0;

  const paintChips = () => { outlet.querySelector("#types").innerHTML = TYPES.map(([v, l]) => `<button class="chip" type="button" data-type="${v}" aria-pressed="${type === v}">${l}</button>`).join(""); };

  async function load() {
    const mine = ++seq;
    $grid.innerHTML = '<div class="gallery-grid">' + '<div class="skeleton" style="aspect-ratio:1"></div>'.repeat(6) + "</div>";
    try {
      const res = await api.get("/gallery", { params: { type, q }, cache: false });
      if (mine !== seq) return;
      items = res;
      $grid.innerHTML = items.length
        ? `<div class="gallery-grid">${items.map((i) => `<button class="gallery-tile" type="button" data-id="${esc(i.id)}">
            ${i.thumb_url ? `<img src="${esc(i.thumb_url)}" alt="${esc(i.title)}" loading="lazy">` : ""}<span>${esc(i.title)}</span></button>`).join("")}</div>`
        : '<div class="empty-state"><i class="bi bi-images" aria-hidden="true"></i><p>Nothing here yet. Add certificates, assignment photos and notes.</p></div>';
    } catch (err) { $grid.innerHTML = `<div class="empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>${esc(err.message)}</p></div>`; }
  }

  function openUpload() {
    const form = document.createElement("form");
    form.noValidate = true;
    form.innerHTML = `<div id="err" class="alert alert-danger d-none" role="alert"></div>
      <div class="mb-3"><label class="form-label" for="u-file">Photo</label><input class="form-control" id="u-file" type="file" accept="image/*" required>
        <p class="text-caption mt-2 mb-0" id="info">Photos are compressed before upload to save data.</p></div>
      <div class="mb-3"><label class="form-label" for="u-title">Title</label><input class="form-control" id="u-title" maxlength="120" required autocomplete="off"></div>
      <div class="mb-3"><label class="form-label" for="u-type">Type</label><select class="form-select" id="u-type">${typeOptions("image")}</select></div>
      <div class="mb-4"><label class="form-label" for="u-tags">Tags <span class="text-caption">(comma separated, optional)</span></label><input class="form-control" id="u-tags" maxlength="300"></div>
      <div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-outline-secondary" id="cancel">Cancel</button><button class="btn btn-primary" id="go" type="submit">Upload</button></div>`;
    const sheet = openSheet({ title: "Add to gallery", content: form });
    const err = form.querySelector("#err"), fail = (m) => { err.textContent = m; err.classList.remove("d-none"); };
    let blob = null, name = "photo.webp";
    form.querySelector("#cancel").addEventListener("click", sheet.close);

    form.querySelector("#u-file").addEventListener("change", async (e) => {
      const file = e.target.files[0]; blob = null; err.classList.add("d-none");
      if (!file) return;
      const info = form.querySelector("#info"); info.textContent = "Compressing…";
      try {
        blob = await compressImage(file); name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg");
        info.textContent = `${fmtBytes(file.size)} → ${fmtBytes(blob.size)}${blob.size < file.size ? ` (saved ${Math.round((1 - blob.size / file.size) * 100)}%)` : ""}`;
        const t = form.querySelector("#u-title"); if (!t.value) t.value = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
      } catch (ex) { info.textContent = ""; fail(ex.message); }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!blob) return fail("Choose a photo first.");
      const title = form.querySelector("#u-title").value.trim();
      if (!title) return fail("Give it a title.");
      const fd = new FormData();
      fd.append("file", blob, name); fd.append("title", title); fd.append("item_type", form.querySelector("#u-type").value); fd.append("tags", form.querySelector("#u-tags").value);
      const btn = form.querySelector("#go"); btn.disabled = true; btn.textContent = "Uploading…";
      try { await api.post("/gallery", fd); sheet.close(); toast("Added to your gallery"); load(); }
      catch (ex) { fail(ex.message); btn.disabled = false; btn.textContent = "Upload"; }
    });
  }

  async function openItem(id) {
    let item;
    try { item = await api.get(`/gallery/${id}`, { cache: false }); } catch (err) { return toast(err.message, { type: "error" }); }
    const box = document.createElement("div");
    box.innerHTML = `<img class="lightbox-img mb-3" src="${esc(item.url)}" alt="${esc(item.title)}">
      <p class="text-caption">${item.width}×${item.height} · ${fmtBytes(item.size_bytes)}${saved(item) ? ` · ${saved(item)}% smaller than the original` : ""}</p>
      <div id="err" class="alert alert-danger d-none" role="alert"></div>
      <div class="mb-3"><label class="form-label" for="e-title">Title</label><input class="form-control" id="e-title" maxlength="120" value="${esc(item.title)}"></div>
      <div class="row g-2 mb-4"><div class="col-6"><label class="form-label" for="e-type">Type</label><select class="form-select" id="e-type">${typeOptions(item.item_type)}</select></div>
      <div class="col-6"><label class="form-label" for="e-tags">Tags</label><input class="form-control" id="e-tags" value="${esc(item.tags.join(", "))}"></div></div>
      <div class="d-flex gap-2"><button class="btn btn-outline-secondary text-danger" id="del" type="button" aria-label="Delete"><i class="bi bi-trash" aria-hidden="true"></i></button>
      <button class="btn btn-primary ms-auto" id="save" type="button">Save changes</button></div>`;
    const sheet = openSheet({ title: "Details", content: box });
    const err = box.querySelector("#err");
    box.querySelector("#save").addEventListener("click", async () => {
      try {
        await api.patch(`/gallery/${id}`, { title: box.querySelector("#e-title").value.trim() || item.title, item_type: box.querySelector("#e-type").value,
          tags: box.querySelector("#e-tags").value.split(",").map((t) => t.trim()).filter(Boolean) });
        sheet.close(); load();
      } catch (ex) { err.textContent = ex.message; err.classList.remove("d-none"); }
    });
    box.querySelector("#del").addEventListener("click", async () => {
      if (!(await confirmDialog({ title: "Delete this image?", message: "It will be permanently removed.", confirmLabel: "Delete", danger: true }))) return;
      try { await api.delete(`/gallery/${id}`); sheet.close(); toast("Image deleted"); load(); } catch (ex) { err.textContent = ex.message; err.classList.remove("d-none"); }
    });
  }

  outlet.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-type]"), tile = e.target.closest(".gallery-tile");
    if (chip) { type = chip.dataset.type; paintChips(); load(); }
    else if (tile) openItem(tile.dataset.id);
    else if (e.target.closest("#add")) openUpload();
  });
  outlet.querySelector("#g-search").addEventListener("input", debounce((e) => { q = e.target.value.trim(); load(); }, 300));
  paintChips();
  await load();
}
