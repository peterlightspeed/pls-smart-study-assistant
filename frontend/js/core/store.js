// Small shared state: the signed-in user's profile/settings and the category list.
import { api } from "./api.js";
import { setTheme } from "./theme.js";

let ctx = null;
let categories = null;
let readyResolve;
const ready = new Promise((r) => { readyResolve = r; });

export async function loadUserContext() {
  try {
    const [profile, settings] = await Promise.all([api.get("/me"), api.get("/me/settings")]);
    ctx = { profile, settings };
    setTheme(settings.theme);
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (profile.timezone === "UTC" && deviceTz && deviceTz !== "UTC") {   // first run: adopt the device timezone silently
      ctx.profile = await api.patch("/me", { timezone: deviceTz }).catch(() => profile);
    }
  } catch (err) {
    console.warn("Couldn't load user context", err);
  } finally {
    readyResolve(ctx);
  }
}

export const whenReady = () => ready;
export const getUserContext = () => ctx;
export const setSettings = (s) => { if (ctx) ctx.settings = s; };
export const setProfile = (p) => { if (ctx) ctx.profile = p; };

export async function getCategories(force = false) {
  if (!categories || force) categories = await api.get("/categories");
  return categories;
}
export const categoryMap = (list) => new Map(list.map((c) => [c.id, c]));
