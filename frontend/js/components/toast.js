/** Toast with optional action (e.g. Undo). Returns a dismiss function. */
export function toast(message, { actionLabel, onAction, duration = 5000, type = "info" } = {}) {
  let stack = document.getElementById("toasts");
  if (!stack) {
    stack = Object.assign(document.createElement("div"), { id: "toasts", className: "toast-stack" });
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.append(stack);
  }
  const el = document.createElement("div");
  el.className = `pls-toast pls-toast-${type}`;
  const text = Object.assign(document.createElement("span"), { textContent: message });
  el.append(text);
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  if (actionLabel) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-link p-0", textContent: actionLabel });
    b.addEventListener("click", () => { dismiss(); onAction?.(); });
    el.append(b);
  }
  stack.append(el);
  const timer = setTimeout(dismiss, duration);
  return dismiss;
}
