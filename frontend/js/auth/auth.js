// Auth screens: login, signup, forgot, reset, verify, verified. Talks to Supabase Auth directly.
import { CONFIG } from "../core/config.js";
import { esc } from "../core/utils.js";

const root = document.getElementById("auth-root");
const view = new URLSearchParams(location.search).get("view") || "login";
const origin = location.origin;
const EMAIL_KEY = "pls-auth-email";
const remember = (e) => { try { sessionStorage.setItem(EMAIL_KEY, e); } catch { /* ignore */ } };
const recall = () => { try { return sessionStorage.getItem(EMAIL_KEY) || ""; } catch { return ""; } };

if ([CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY].some((v) => v.includes("YOUR-"))) {
  root.innerHTML = `<h1 class="h3">Almost there</h1><p class="mb-0">Add your Supabase URL and anon key in <code>frontend/js/core/config.js</code>, then reload. See TODO.md.</p>`;
} else {
  const { supabase } = await import("../core/supabase.js");
  init(supabase);
}

const field = (id, label, type, extra = "") => `
  <div class="mb-3"><label class="form-label" for="${id}">${label}</label>
  <input class="form-control" id="${id}" name="${id}" type="${type}" required ${extra}></div>`;
const passwordField = (id, label, autocomplete) => `
  <div class="mb-3"><label class="form-label" for="${id}">${label}</label>
  <div class="input-group"><input class="form-control" id="${id}" type="password" required minlength="8" autocomplete="${autocomplete}">
  <button class="btn btn-outline-secondary" type="button" data-toggle="${id}" aria-label="Show password"><i class="bi bi-eye" aria-hidden="true"></i></button></div></div>`;
const alertBox = `<div id="msg" class="alert d-none" role="alert"></div>`;

function friendly(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "EMAIL_NOT_CONFIRMED";
  if (m.includes("rate limit") || err?.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("same password")) return "Choose a password you haven't used before.";
  if (m.includes("password") && m.includes("weak")) return "That password is too easy to guess. Try a longer one.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your connection.";
  return err?.message || "Something went wrong. Please try again.";
}

function show(kind, text) {
  const el = document.getElementById("msg");
  el.className = `alert alert-${kind}`;
  el.textContent = text;
}

async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Please wait…";
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}

function wireToggles() {
  root.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const input = document.getElementById(b.dataset.toggle);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    b.firstElementChild.className = `bi bi-eye${show ? "-slash" : ""}`;
  }));
}

function init(supabase) {
  const go = () => location.replace("/app.html");
  const screens = {
    login() {
      root.innerHTML = `<h1 class="mb-1">Welcome back</h1><p class="text-caption mb-4">Sign in to continue.</p>${alertBox}
        <form id="f" novalidate>${field("email", "Email", "email", 'autocomplete="email" inputmode="email"')}
        ${passwordField("password", "Password", "current-password")}
        <div class="text-end mb-3"><a href="?view=forgot">Forgot password?</a></div>
        <button class="btn btn-primary w-100" type="submit">Sign in</button></form>
        <p class="text-center mt-4 mb-0">New here? <a href="?view=signup">Create an account</a></p>`;
      const f = root.querySelector("#f");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const email = f.email.value.trim();
        await busy(f.querySelector("button[type=submit]"), async () => {
          const { error } = await supabase.auth.signInWithPassword({ email, password: f.password.value });
          const msg = error && friendly(error);
          if (msg === "EMAIL_NOT_CONFIRMED") { remember(email); location.replace("?view=verify"); return; }
          msg ? show("danger", msg) : go();
        });
      });
    },

    signup() {
      root.innerHTML = `<h1 class="mb-1">Create your account</h1><p class="text-caption mb-4">It takes under a minute.</p>${alertBox}
        <form id="f" novalidate>${field("name", "Full name", "text", 'autocomplete="name" maxlength="100"')}
        ${field("email", "Email", "email", 'autocomplete="email" inputmode="email"')}
        ${passwordField("password", "Password", "new-password")}
        <p class="text-caption mt-n2 mb-3">At least 8 characters.</p>
        <button class="btn btn-primary w-100" type="submit">Create account</button></form>
        <p class="text-center mt-4 mb-0">Already have an account? <a href="?view=login">Sign in</a></p>`;
      const f = root.querySelector("#f");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const email = f.email.value.trim();
        await busy(f.querySelector("button[type=submit]"), async () => {
          const { data, error } = await supabase.auth.signUp({
            email, password: f.password.value,
            options: { data: { full_name: f.name.value.trim() }, emailRedirectTo: `${origin}/auth.html?view=verified` },
          });
          if (error) return show("danger", friendly(error));
          if (data.user && data.user.identities?.length === 0) return show("warning", "That email already has an account. Try signing in instead.");
          if (data.session) return go();                    // email confirmation disabled in Supabase
          remember(email);
          location.replace("?view=verify");
        });
      });
    },

    forgot() {
      root.innerHTML = `<h1 class="mb-1">Reset your password</h1><p class="text-caption mb-4">We'll email you a link to choose a new one.</p>${alertBox}
        <form id="f" novalidate>${field("email", "Email", "email", 'autocomplete="email" inputmode="email"')}
        <button class="btn btn-primary w-100" type="submit">Send reset link</button></form>
        <p class="text-center mt-4 mb-0"><a href="?view=login">Back to sign in</a></p>`;
      const f = root.querySelector("#f");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        await busy(f.querySelector("button[type=submit]"), async () => {
          const { error } = await supabase.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: `${origin}/auth.html?view=reset` });
          if (error && error.status === 429) return show("danger", friendly(error));
          // Same message whether or not the account exists, so emails can't be probed.
          show("success", "If that email has an account, a reset link is on its way. Check your inbox and spam folder.");
        });
      });
    },

    async reset() {
      root.innerHTML = `<h1 class="mb-1">Choose a new password</h1><p class="text-caption mb-4" id="sub">Checking your link…</p>${alertBox}<div id="slot"></div>`;
      const showForm = () => {
        root.querySelector("#sub").textContent = "Use at least 8 characters.";
        root.querySelector("#slot").innerHTML = `<form id="f" novalidate>${passwordField("password", "New password", "new-password")}
          <button class="btn btn-primary w-100" type="submit">Save password</button></form>`;
        wireToggles();
        const f = root.querySelector("#f");
        f.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!f.reportValidity()) return;
          await busy(f.querySelector("button[type=submit]"), async () => {
            const { error } = await supabase.auth.updateUser({ password: f.password.value });
            if (error) return show("danger", friendly(error));
            show("success", "Password updated. Taking you to your dashboard…");
            setTimeout(go, 1200);
          });
        });
      };
      const expired = () => {
        root.querySelector("#sub").textContent = "";
        show("warning", "This reset link has expired or was already used.");
        root.querySelector("#slot").innerHTML = '<a class="btn btn-primary w-100" href="?view=forgot">Request a new link</a>';
      };
      supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") showForm(); });
      setTimeout(async () => { if (!root.querySelector("#f") && !(await supabase.auth.getSession()).data.session) expired(); }, 3500);
    },

    verify() {
      const email = recall();
      root.innerHTML = `<div class="text-center"><i class="bi bi-envelope-check display-5" style="color:var(--pls-primary)" aria-hidden="true"></i>
        <h1 class="mt-3 mb-2">Check your email</h1>
        <p class="mb-4">We sent a verification link${email ? ` to <strong>${esc(email)}</strong>` : ""}. Open it to activate your account.</p></div>${alertBox}
        <button class="btn btn-primary w-100 mb-2" id="continue" type="button">I've verified my email</button>
        <button class="btn btn-outline-secondary w-100" id="resend" type="button">Resend email</button>
        <p class="text-center mt-4 mb-0"><a href="?view=login">Back to sign in</a></p>`;
      const resend = root.querySelector("#resend");
      resend.addEventListener("click", async () => {
        if (!email) return show("warning", "Enter your email on the sign-up screen to get a new link.");
        const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth.html?view=verified` } });
        if (error) return show("danger", friendly(error));
        show("success", "Sent! It can take a minute to arrive.");
        resend.disabled = true;
        let s = 30;
        const t = setInterval(() => { resend.textContent = s > 0 ? `Resend email (${s--}s)` : "Resend email"; if (s < 0) { clearInterval(t); resend.disabled = false; } }, 1000);
      });
      root.querySelector("#continue").addEventListener("click", async () => {
        const { data } = await supabase.auth.refreshSession();
        if (data.session?.user?.email_confirmed_at) return go();
        show("info", "We haven't seen the verification yet. Open the link in your email, or sign in again after verifying.");
      });
    },

    async verified() {
      root.innerHTML = `<div class="text-center"><i class="bi bi-patch-check display-5" style="color:var(--pls-success)" aria-hidden="true"></i>
        <h1 class="mt-3 mb-2">Email verified</h1><p class="mb-4" id="sub">Finishing sign-in…</p><div id="slot"></div></div>`;
      const { data } = await supabase.auth.getSession();
      root.querySelector("#sub").textContent = data.session ? "You're all set." : "You can now sign in.";
      root.querySelector("#slot").innerHTML = data.session
        ? '<a class="btn btn-primary w-100" href="/app.html">Go to my dashboard</a>'
        : '<a class="btn btn-primary w-100" href="?view=login">Sign in</a>';
    },
  };

  // Already signed in and verified? Skip the login screens.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user?.email_confirmed_at && ["login", "signup", "forgot"].includes(view)) go();
  });
  (screens[view] || screens.login)();
  wireToggles();
}
