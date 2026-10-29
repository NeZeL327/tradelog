import { useEffect, useRef, useState } from "react";
import { motionScale } from "@/lib/motion";

// "1,274.22" → { value: 1274.22, decimals: 2, decimalSep: ".", groupSep: "," }
function parseNumericToken(token) {
  const separators = [...token.matchAll(/[^\d]/g)];
  const last = separators[separators.length - 1];
  const tail = last ? token.length - last.index - 1 : 0;
  const decimals = last && tail !== 3 ? tail : 0;
  const decimalSep = decimals ? last[0] : "";
  const groupSep = separators.find((match) => match.index !== last?.index || !decimals)?.[0] || "";
  const digits = token.replace(/\D/g, "");
  return { value: Number(digits) / 10 ** decimals, decimals, decimalSep, groupSep };
}

function formatLike(value, { decimals, decimalSep, groupSep }) {
  const [whole, fraction] = value.toFixed(decimals).split(".");
  const grouped = groupSep ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep) : whole;
  return fraction ? `${grouped}${decimalSep}${fraction}` : grouped;
}

/**
 * Pierwsza liczba w tekście "dobiega" do wartości raz, przy pierwszym wyrenderowaniu (~550 ms).
 * Ostatnia klatka to zawsze oryginalny tekst. Późniejsze zmiany (np. filtr) bez odliczania,
 * tylko szybkie przejście opacity. Tylko wyświetlanie — nie używać w tabelach.
 */
export default function CountUpText({ text }) {
  const [shown, setShown] = useState(text);
  const textRef = useRef(text);
  const mountedRef = useRef(false);
  const [swapKey, setSwapKey] = useState(0);
  textRef.current = text;

  useEffect(() => {
    const scale = motionScale();
    const match = /\d[\d.,   ]*\d|\d/.exec(textRef.current);
    if (!match || scale <= 0) return undefined;
    const original = textRef.current;
    const parsed = parseNumericToken(match[0].trim());
    if (!parsed.value) return undefined;
    const before = original.slice(0, match.index);
    const after = original.slice(match.index + match[0].trim().length);
    const start = performance.now();
    const duration = 550 * scale;
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      if (progress >= 1 || textRef.current !== original) {
        setShown(textRef.current);
        return;
      }
      const eased = 1 - (1 - progress) ** 3;
      setShown(`${before}${formatLike(parsed.value * eased, parsed)}${after}`);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setShown(text);
    setSwapKey((key) => key + 1);
  }, [text]);

  return swapKey ? <span key={swapKey} className="motion-value-swap">{shown}</span> : shown;
}
