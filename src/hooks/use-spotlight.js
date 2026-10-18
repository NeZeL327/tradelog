import { useEffect } from "react";

const SPOT_SELECTOR = ".ds-spot";

// One document-level pointermove handler, throttled to one rAF per frame.
// It only writes CSS variables on the hovered .ds-spot element, so React never re-renders on move.
export function useSpotlight() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia?.("(pointer: fine)").matches) return undefined;
    let frame = 0;
    let lastEvent = null;

    const paint = () => {
      frame = 0;
      const target = lastEvent?.target;
      const el = target instanceof Element ? target.closest(SPOT_SELECTOR) : null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${lastEvent.clientX - rect.left}px`);
      el.style.setProperty("--spot-y", `${lastEvent.clientY - rect.top}px`);
    };

    const onMove = (event) => {
      lastEvent = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
