import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHART_INTERVALS,
  tradePriceLevels,
  tradingViewEmbedSrc,
  tradingViewSymbol,
} from "@/lib/tradePreviewMarketData";

function intervalFromTrade(trade) {
  const tf = String(trade?.timeframe || "").toUpperCase().replace(/\s/g, "");
  if (["1M", "M1", "1MIN"].includes(tf)) return "1m";
  if (["5M", "M5"].includes(tf)) return "5m";
  if (["15M", "M15"].includes(tf)) return "15m";
  if (["30M", "M30"].includes(tf)) return "30m";
  if (["1H", "H1", "60M"].includes(tf)) return "1H";
  if (["4H", "H4"].includes(tf)) return "4H";
  if (["1D", "D1", "D"].includes(tf)) return "1D";
  return "15m";
}

function LevelChip({ label, value, tone }) {
  if (value == null) return null;
  const cls =
    tone === "profit" ? "text-profit bg-profit/10 border-profit/20"
      : tone === "loss" ? "text-loss bg-loss/10 border-loss/20"
        : "text-muted-foreground bg-white/5 border-white/10";
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-md border tabular-nums", cls)}>
      {label} {value}
    </span>
  );
}

function loadTvScript() {
  if (window.TradingView?.widget) return Promise.resolve();
  if (window.__aikeepTvPromise) return window.__aikeepTvPromise;
  window.__aikeepTvPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-aikeep-tv]");
    if (existing && window.TradingView?.widget) {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.dataset.aikeepTv = "1";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.__aikeepTvPromise;
}

function waitForBox(el, isCancelled, { minW = 480, minH = 180, maxMs = 700 } = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (isCancelled()) {
        resolve(false);
        return;
      }
      const wideEnough = el.clientWidth >= minW;
      const tallEnough = el.clientHeight >= minH;
      const timedOut = performance.now() - started >= maxMs;
      if ((wideEnough && tallEnough) || (timedOut && el.clientWidth > 40 && el.clientHeight > 40)) {
        resolve(true);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function mountIframeFallback(el, symbol, intervalId) {
  el.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.title = "TradingView";
  iframe.src = tradingViewEmbedSrc(symbol, intervalId);
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("scrolling", "no");
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
  el.appendChild(iframe);
}

export default function TradePreviewChart({ trade }) {
  const hostId = `tv_${useId().replace(/:/g, "")}`;
  const hostRef = useRef(null);
  const [interval, setIntervalId] = useState(() => intervalFromTrade(trade));
  const [reloadTick, setReloadTick] = useState(0);
  const levels = tradePriceLevels(trade);
  const tvSymbol = tradingViewSymbol(trade?.symbol);

  useEffect(() => {
    setIntervalId(intervalFromTrade(trade));
  }, [trade?.id, trade?.symbol]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    let cancelled = false;
    const spec = CHART_INTERVALS.find((item) => item.id === interval) || CHART_INTERVALS[0];

    const start = async () => {
      const ready = await waitForBox(el, () => cancelled);
      if (!ready || cancelled) return;
      el.innerHTML = "";
      try {
        await loadTvScript();
        if (cancelled || !window.TradingView?.widget) {
          mountIframeFallback(el, trade?.symbol, interval);
          return;
        }
        // eslint-disable-next-line no-new
        new window.TradingView.widget({
          autosize: true,
          width: el.clientWidth,
          height: el.clientHeight,
          symbol: tvSymbol,
          interval: spec.tv,
          timezone: "Europe/Warsaw",
          theme: "dark",
          style: "1",
          locale: "pl",
          toolbar_bg: "#0b1220",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_side_toolbar: false,
          hide_legend: false,
          withdateranges: true,
          allow_symbol_change: false,
          save_image: true,
          hideideas: true,
          details: false,
          hotlist: false,
          calendar: false,
          studies: [],
          show_popup_button: true,
          popup_width: "1200",
          popup_height: "750",
          container_id: hostId,
        });
      } catch {
        if (!cancelled) mountIframeFallback(el, trade?.symbol, interval);
      }
    };

    start();
    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, [hostId, tvSymbol, trade?.symbol, interval, reloadTick]);

  const entryTone = levels.isLong ? "profit" : "loss";
  const exitTone = levels.isLong ? "loss" : "profit";

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 shrink-0">
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5 min-w-max">
          {CHART_INTERVALS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIntervalId(item.id)}
              className={cn(
                "h-7 px-2 rounded-md text-[11px] font-medium",
                interval === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/[0.04]"
          onClick={() => setReloadTick((n) => n + 1)}
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />
          Reset
        </button>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
          target="_blank"
          rel="noreferrer"
          className="h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/[0.04] inline-flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
          Pełny TV
        </a>
      </div>

      <div className="flex flex-wrap gap-1.5 shrink-0">
        <LevelChip label="ENTRY" value={levels.entry} tone={entryTone} />
        <LevelChip label="EXIT" value={levels.exit} tone={exitTone} />
        <LevelChip label="SL" value={levels.sl} tone="loss" />
        <LevelChip label="TP" value={levels.tp} tone="profit" />
        {levels.executions.filter((e) => e.kind === "EXEC").map((e) => (
          <LevelChip key={e.id} label="EXEC" value={e.price} tone="neutral" />
        ))}
      </div>

      <div className="relative flex-1 min-h-0 rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
        <div
          id={hostId}
          ref={hostRef}
          className="absolute inset-0 [&_iframe]:!h-full [&_iframe]:!w-full [&_iframe]:block"
        />
      </div>
    </div>
  );
}
