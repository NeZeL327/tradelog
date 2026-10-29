import { useEffect } from "react";

const CANDIDATE = ".bg-card, [data-reveal-target]";
const MAX_CASCADE = 6;
const STAGGER_MS = 40;
const LONG_LIST = 12;

// Karta ma się pojawić tylko raz: pomijamy tabele, długie listy, okna i karty zagnieżdżone w innych kartach.
function isCandidate(el, root) {
  if (!(el instanceof HTMLElement) || el.dataset.reveal || el.closest("[data-reveal-skip], [role='dialog']")) return false;
  if (el.querySelector("table")) return false;
  const parentCard = el.parentElement?.closest(CANDIDATE);
  if (parentCard && root.contains(parentCard)) return false;
  if ((el.parentElement?.children.length || 0) > LONG_LIST) return false;
  return true;
}

/**
 * Karty w obrębie rootRef wchodzą z fade + 8px przy pierwszym pojawieniu w widoku
 * (kaskada 40 ms, maks. 6). Tylko atrybuty data-* — React nie nadpisuje ich przy renderze.
 */
export function useRevealOnView(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;

    const finish = (event) => {
      const el = event.currentTarget;
      if (event.target !== el) return;
      el.removeEventListener("animationend", finish);
      el.dataset.reveal = "done";
      el.style.removeProperty("--reveal-delay");
    };

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      visible.forEach((entry, index) => {
        const el = entry.target;
        io.unobserve(el);
        el.style.setProperty("--reveal-delay", `${Math.min(index, MAX_CASCADE - 1) * STAGGER_MS}ms`);
        el.addEventListener("animationend", finish);
        el.dataset.reveal = "in";
      });
    }, { threshold: 0.05 });

    const mark = (el) => {
      if (!isCandidate(el, root)) return;
      el.dataset.reveal = "pending";
      io.observe(el);
    };
    const scan = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(CANDIDATE)) mark(node);
      node.querySelectorAll(CANDIDATE).forEach(mark);
    };

    scan(root);
    // Callback MutationObservera działa przed malowaniem, więc nowa karta nie mignie przed ukryciem.
    const mo = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(scan));
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [rootRef]);
}
