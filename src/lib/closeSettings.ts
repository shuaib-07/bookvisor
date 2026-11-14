export type AppCloseBehavior = "ask" | "background" | "quit";

const STORAGE_KEY = "bookvisor_close_behavior";

export function getStoredCloseBehavior(): AppCloseBehavior {
  if (typeof window === "undefined") return "ask";
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "background" || val === "quit") {
    return val;
  }
  return "ask";
}

export function setStoredCloseBehavior(behavior: AppCloseBehavior): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, behavior);
  window.dispatchEvent(
    new CustomEvent("bookvisor-close-behavior-changed", { detail: behavior })
  );
}

export function resetStoredCloseBehavior(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent("bookvisor-close-behavior-changed", { detail: "ask" })
  );
}

