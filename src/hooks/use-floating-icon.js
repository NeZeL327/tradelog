import { useEffect, useRef } from "react";

// Ile pływających ikon pustych stanów jest w widoku; dopóki > 0, puls kropki sesji czeka
// (zasada: maks. jedna animacja w pętli na ekranie).
let visibleFloats = 0;
const syncLoopOwner = () => {
  if (visibleFloats > 0) document.documentElement.dataset.loopOwner = "empty-state";
  else delete document.documentElement.dataset.loopOwner;
};

/** Ref dla ikony pustego stanu: unosi się (klasa .motion-float) tylko, gdy jest widoczna. */
export function useFloatingIcon() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    let visible = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === visible) return;
      visible = entry.isIntersecting;
      el.dataset.floating = visible ? "true" : "false";
      visibleFloats += visible ? 1 : -1;
      syncLoopOwner();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (visible) {
        visibleFloats -= 1;
        syncLoopOwner();
      }
    };
  }, []);
  return ref;
}
