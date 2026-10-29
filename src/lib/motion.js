// Tryb animacji: tylko localStorage + html[data-motion]; parametry ruchu są w index.css (--motion-*).
export const MOTION_STORAGE_KEY = "motion-mode";
export const MOTION_MODES = ["full", "subtle", "off"];
export const DEFAULT_MOTION_MODE = "subtle";
const MOTION_SCALE = { full: 1.3, subtle: 1, off: 0 };

export function getStoredMotionMode() {
  try {
    const saved = localStorage.getItem(MOTION_STORAGE_KEY);
    return MOTION_MODES.includes(saved) ? saved : DEFAULT_MOTION_MODE;
  } catch {
    return DEFAULT_MOTION_MODE;
  }
}

export function applyMotionMode(mode = getStoredMotionMode()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = MOTION_MODES.includes(mode) ? mode : DEFAULT_MOTION_MODE;
}

export function setMotionMode(mode) {
  const next = MOTION_MODES.includes(mode) ? mode : DEFAULT_MOTION_MODE;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, next);
  } catch {
    // Prywatne okno / zablokowany storage: tryb działa do przeładowania.
  }
  applyMotionMode(next);
}

/** Aktualny mnożnik czasu: 0 gdy tryb "off" albo system prosi o ograniczenie ruchu. */
export function motionScale() {
  if (typeof window === "undefined") return 0;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
  const mode = document.documentElement.dataset.motion || DEFAULT_MOTION_MODE;
  return MOTION_SCALE[mode] ?? 1;
}

export const motionEnabled = () => motionScale() > 0;
