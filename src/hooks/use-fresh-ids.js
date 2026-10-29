import { useEffect, useRef, useState } from "react";

const FRESH_MS = 1300;

/**
 * Id rekordów, które pojawiły się od poprzedniej wersji listy (np. po dodaniu lub imporcie).
 * Pierwsze załadowanie niczego nie oznacza. Po ~1,3 s zbiór się czyści. Tylko odczyt listy.
 */
export function useFreshIds(items) {
  const knownRef = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());

  useEffect(() => {
    // null = lista w trakcie ładowania: nie ruszamy zapamiętanych id.
    if (!items) return undefined;
    const ids = new Set(items.map((item) => String(item?.id)));
    const known = knownRef.current;
    knownRef.current = ids;
    if (!known || ids.size === 0) return undefined;
    const added = [...ids].filter((id) => !known.has(id));
    if (!added.length) return undefined;
    setFresh(new Set(added));
    const timer = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, [items]);

  return fresh;
}
