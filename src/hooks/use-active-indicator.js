import { useLayoutEffect } from "react";

const BASE_WIDTH = 100;

/**
 * Przesuwa jeden wskaźnik (podkreślenie zakładki / pasek docka) pod aktywny element.
 * Tylko transform: x → translateX + scaleX, y → translateY. Kontener musi mieć position: relative.
 * Pierwsze ustawienie bez animacji; potem płynnie (CSS .motion-indicator).
 */
export function useActiveIndicator(containerRef, indicatorRef, selector, axis = "x") {
  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return undefined;
    let frame = 0;

    const place = () => {
      frame = 0;
      const active = container.querySelector(selector);
      if (!active) {
        indicator.dataset.ready = "false";
        return;
      }
      if (axis === "x") {
        indicator.style.width = `${BASE_WIDTH}px`;
        indicator.style.transformOrigin = "0 0";
        indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth / BASE_WIDTH})`;
      } else {
        const y = active.offsetTop + active.offsetHeight / 2 - indicator.offsetHeight / 2;
        indicator.style.transform = `translateY(${y}px)`;
      }
      if (indicator.dataset.ready !== "true") {
        // Pierwsze położenie: bez przejazdu z pozycji 0.
        indicator.style.transition = "none";
        indicator.getBoundingClientRect();
        indicator.style.transition = "";
        indicator.dataset.ready = "true";
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    const mutations = new MutationObserver(schedule);
    mutations.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "data-active"],
    });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resize?.observe(container);
    return () => {
      mutations.disconnect();
      resize?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, indicatorRef, selector, axis]);
}
