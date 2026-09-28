import { setTokenProvider } from "./api.js";
import { clearOfflineData } from "./offline.js";
import { supabase } from "./supabase.js";

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace("/auth.html"); return null; }
  if (!session.user.email_confirmed_at) { location.replace("/auth.html?view=verify"); return null; }

  setTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
  supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("/auth.html"); });
  window.addEventListener("pls:unauthorized", async () => {
    // Token rejected: try one refresh, otherwise sign out.
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) signOut();
  }, { once: true });
  return session;
}

export async function signOut() {
  clearOfflineData();
  await supabase.auth.signOut();
  location.replace("/auth.html");
}
