// Theme: "light" | "dark" | "system". Persisted locally now; synced to user_settings in Phase 8.
const KEY = "pls-theme";
const media = matchMedia("(prefers-color-scheme: dark)");

export const getTheme = () => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } };

function apply(theme) {
  const dark = theme === "dark" || (theme === "system" && media.matches);
  document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#171A21" : "#4F6BED");
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable: still apply for this session */ }
  apply(theme);
}

export function initTheme() {
  apply(getTheme());
  media.addEventListener("change", () => getTheme() === "system" && apply("system"));
}
