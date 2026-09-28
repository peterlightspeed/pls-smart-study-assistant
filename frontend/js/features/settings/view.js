import { api } from "../../core/api.js";
import { getUserContext, setProfile, setSettings, whenReady } from "../../core/store.js";
import { setTheme } from "../../core/theme.js";
import { esc } from "../../core/utils.js";
import { confirmDialog, openSheet } from "../../components/bottom-sheet.js";
import { toast } from "../../components/toast.js";

const THEMES = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
const zones = () => { try { return Intl.supportedValuesOf("timeZone"); } catch { return ["UTC", "Africa/Lagos", "Europe/London", "America/New_York", "Asia/Kolkata"]; } };

export async function render(outlet) {
  await whenReady();
  const ctx = getUserContext();
  if (!ctx) { outlet.innerHTML = '<h1 class="mb-3">Settings</h1><div class="pls-card empty-state"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>Settings need a connection to load. Try again in a moment.</p></div>'; return; }
  const { profile, settings } = ctx;
  const tzList = zones(), tz = tzList.includes(profile.timezone) ? profile.timezone : "UTC";

  outlet.innerHTML = `<h1 class="mb-3">Settings</h1>
    <form class="pls-card" id="f-profile" aria-labelledby="h-profile"><h2 class="h3 mb-3" id="h-profile">Profile</h2>
      <div class="mb-3"><label class="form-label" for="name">Full name</label><input class="form-control" id="name" maxlength="100" autocomplete="name" value="${esc(profile.full_name)}"></div>
      <div class="mb-3"><label class="form-label" for="tz">Timezone</label><select class="form-select" id="tz">${tzList.map((z) => `<option ${z === tz ? "selected" : ""}>${esc(z)}</option>`).join("")}</select>
        <p class="text-caption mt-1 mb-0">Used to decide when your day starts, for streaks and analytics.</p></div>
      <button class="btn btn-primary" type="submit">Save profile</button></form>

    <section class="pls-card" aria-labelledby="h-theme"><h2 class="h3 mb-3" id="h-theme">Appearance</h2>
      <div class="segmented" id="theme" role="group" aria-label="Theme">${THEMES.map(([v, l]) => `<button type="button" data-theme="${v}" aria-pressed="${settings.theme === v}">${l}</button>`).join("")}</div></section>

    <form class="pls-card" id="f-study" aria-labelledby="h-study"><h2 class="h3 mb-3" id="h-study">Study</h2>
      <div class="mb-3"><label class="form-label" for="target">Weekly study target (hours)</label>
        <input class="form-control" id="target" type="number" inputmode="decimal" min="0.5" max="100" step="0.5" value="${settings.weekly_study_target_minutes / 60}"></div>
      <div class="mb-3"><span class="form-label d-block">Week starts on</span><div class="radio-row" style="max-width:260px">
        ${[[1, "Monday"], [7, "Sunday"]].map(([v, l]) => `<label><input type="radio" name="wso" value="${v}" ${settings.week_starts_on === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
      <button class="btn btn-primary" type="submit">Save study settings</button></form>

    <form class="pls-card" id="f-notif" aria-labelledby="h-notif"><h2 class="h3 mb-3" id="h-notif">Notifications</h2>
      <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="notif-on" ${settings.notifications_enabled ? "checked" : ""}>
        <label class="form-check-label" for="notif-on">Daily study reminder</label></div>
      <div class="mb-3"><label class="form-label" for="notif-time">Remind me at</label><input class="form-control" style="max-width:180px" id="notif-time" type="time" value="${(settings.reminder_time || "18:00").slice(0, 5)}"></div>
      <p class="text-caption">Reminders appear when the app is open or running in the background on your device.</p>
      <button class="btn btn-primary" type="submit">Save reminders</button></form>

    <section class="pls-card" aria-labelledby="h-acct"><h2 class="h3 mb-3" id="h-acct">Account</h2>
      <div class="d-grid gap-2"><button class="btn btn-outline-secondary" id="pw" type="button">Change password</button>
      <button class="btn btn-outline-secondary" id="out" type="button">Sign out</button>
      <button class="btn btn-outline-secondary text-danger" id="delete" type="button">Delete account</button></div></section>`;

  const save = async (fn, ok) => { try { await fn(); toast(ok); } catch (err) { toast(err.message, { type: "error" }); } };
  const $ = (s) => outlet.querySelector(s);

  $("#f-profile").addEventListener("submit", (e) => { e.preventDefault(); save(async () => setProfile(await api.patch("/me", { full_name: $("#name").value.trim() || null, timezone: $("#tz").value })), "Profile saved"); });

  $("#theme").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]"); if (!b) return;
    setTheme(b.dataset.theme);
    $("#theme").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    api.patch("/me/settings", { theme: b.dataset.theme }).then(setSettings).catch(() => {});
  });

  $("#f-study").addEventListener("submit", (e) => {
    e.preventDefault();
    const hours = Number($("#target").value);
    if (!(hours >= 0.5 && hours <= 100)) return toast("Enter a weekly target between 0.5 and 100 hours.", { type: "error" });
    save(async () => setSettings(await api.patch("/me/settings", { weekly_study_target_minutes: Math.round(hours * 60), week_starts_on: Number(outlet.querySelector('input[name="wso"]:checked').value) })), "Study settings saved");
  });

  $("#f-notif").addEventListener("submit", (e) => {
    e.preventDefault();
    save(async () => {
      const on = $("#notif-on").checked;
      if (on && "Notification" in window && Notification.permission !== "granted") {
        if ((await Notification.requestPermission()) !== "granted") { $("#notif-on").checked = false; throw new Error("Notifications are blocked. Allow them in your browser settings first."); }
      }
      if (on && !("Notification" in window)) throw new Error("This browser doesn't support notifications.");
      setSettings(await api.patch("/me/settings", { notifications_enabled: on, reminder_time: $("#notif-time").value || null }));
    }, "Reminder settings saved");
  });

  $("#out").addEventListener("click", async () => (await import("../../core/session.js")).signOut());

  $("#pw").addEventListener("click", () => {
    const form = document.createElement("form");
    form.innerHTML = `<div id="err" class="alert alert-danger d-none" role="alert"></div><label class="form-label" for="np">New password</label>
      <input class="form-control mb-1" id="np" type="password" minlength="8" autocomplete="new-password" required><p class="text-caption mb-4">At least 8 characters.</p>
      <div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-outline-secondary" id="cancel">Cancel</button><button class="btn btn-primary" type="submit">Update password</button></div>`;
    const sheet = openSheet({ title: "Change password", content: form });
    form.querySelector("#cancel").addEventListener("click", sheet.close);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const { supabase } = await import("../../core/supabase.js");
      const { error } = await supabase.auth.updateUser({ password: form.querySelector("#np").value });
      if (error) { const el = form.querySelector("#err"); el.textContent = error.message; el.classList.remove("d-none"); return; }
      sheet.close(); toast("Password updated");
    });
  });

  $("#delete").addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Delete your account?", message: "This permanently deletes your goals, sessions, notes and gallery. It can't be undone.", confirmLabel: "Continue", danger: true }))) return;
    const form = document.createElement("form");
    form.innerHTML = `<div id="err" class="alert alert-danger d-none" role="alert"></div><label class="form-label" for="typed">Type <strong>DELETE</strong> to confirm</label>
      <input class="form-control mb-4" id="typed" autocomplete="off"><div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-outline-secondary" id="cancel">Cancel</button>
      <button class="btn btn-danger" id="go" type="submit" disabled>Delete everything</button></div>`;
    const sheet = openSheet({ title: "Confirm deletion", content: form });
    const typed = form.querySelector("#typed"), go = form.querySelector("#go");
    typed.addEventListener("input", () => { go.disabled = typed.value.trim() !== "DELETE"; });
    form.querySelector("#cancel").addEventListener("click", sheet.close);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); go.disabled = true; go.textContent = "Deleting…";
      try {
        await api.delete("/me");
        const { clearOfflineData } = await import("../../core/offline.js"); clearOfflineData();
        const { supabase } = await import("../../core/supabase.js"); await supabase.auth.signOut().catch(() => {});
        location.replace("/auth.html?view=signup");
      } catch (err) { const el = form.querySelector("#err"); el.textContent = err.message; el.classList.remove("d-none"); go.disabled = false; go.textContent = "Delete everything"; }
    });
  });
}
