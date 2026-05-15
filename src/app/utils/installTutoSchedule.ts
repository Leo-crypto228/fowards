const KEY = "ff:ios-tuto-last-shown";
const MIN_DAYS = 2;

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export type BrowserType = "safari" | "chrome" | "google";

export function detectBrowser(): BrowserType {
  const ua = navigator.userAgent;
  if (/GSA\//.test(ua)) return "google";
  if (/CriOS\//.test(ua)) return "chrome";
  return "safari";
}

/** True si le tuto doit être affiché maintenant (jamais vu, ou vu il y a ≥ 2 jours) */
export function shouldShowInstallTuto(): boolean {
  if (!isIOS() || isStandalone()) return false;
  try {
    const last = localStorage.getItem(KEY);
    if (!last) return true;
    const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= MIN_DAYS;
  } catch {
    return true;
  }
}

/** Enregistre que le tuto a été affiché aujourd'hui */
export function markInstallTutoShown(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString().slice(0, 10));
  } catch {}
}
