import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Maximize2, Crosshair } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import {
  chartPriceFormat,
  intervalSeconds,
  snapCandleTime,
  tradePositionModel,
  visibleRangeForTrade,
} from "@/lib/tradePreviewMarketData";

// Canvas cannot resolve CSS variables, so tokens are read once per mount.
function readTokens() {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    pos: pick("--ds-pos", "#7ddc6b"),
    neg: pick("--ds-neg", "#f2555f"),
    text: pick("--ds-text", "#e8ecf5"),
    text2: pick("--ds-text2", "#9099b2"),
    text3: pick("--ds-text3", "#868ea5"),
    line: pick("--ds-line", "rgba(255,255,255,0.07)"),
    grid: pick("--ds-s2", "rgba(255,255,255,0.035)"),
    fontFamily: pick("--font-sans", "Manrope, system-ui, sans-serif"),
  };
}

function withAlpha(color, alpha) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return `rgba(242, 85, 95, ${alpha})`;
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function chartOptions(tokens) {
  return {
    autoSize: true, // lightweight-charts observes the host with its own ResizeObserver
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: tokens.text3,
      fontFamily: tokens.fontFamily,
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: tokens.grid },
      horzLines: { color: tokens.grid },
    },
    rightPriceScale: { borderColor: tokens.line },
    timeScale: { borderColor: tokens.line, timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Normal },
  };
}

// Only prices that exist on the trade become lines.
function levelLines(model, tokens) {
  return [
    { price: model.entry, color: tokens.text2, title: "Entry" },
    { price: model.sl, color: tokens.neg, title: "Stop" },
    { price: model.tp, color: tokens.pos, title: "TP" },
    { price: model.exit, color: tokens.text, title: "Exit" },
  ].filter((line) => Number.isFinite(line.price));
}

function tradeMarkers(candles, model, step, tokens) {
  const markers = [];
  const entryTime = snapCandleTime(candles, model.entryTime, step);
  const exitTime = model.exit != null ? snapCandleTime(candles, model.exitTime, step) : null;
  if (entryTime != null) {
    markers.push({
      time: entryTime,
      position: model.isLong ? "belowBar" : "aboveBar",
      shape: model.isLong ? "arrowUp" : "arrowDown",
      color: tokens.text2,
      text: "Entry",
    });
  }
  if (exitTime != null) {
    markers.push({ time: exitTime, position: "inBar", shape: "circle", color: tokens.text, text: "Exit" });
  }
  return markers.sort((a, b) => a.time - b.time);
}

// Series primitive: drawn on the chart canvas, so it stays aligned when the price axis is dragged or zoomed.
class RiskZonePrimitive {
  constructor(zone, tokens) {
    this.zone = zone;
    this.tokens = tokens;
    this.chart = null;
    this.series = null;
    this.view = {
      zOrder: () => "bottom",
      renderer: () => ({ draw: (target) => this.draw(target) }),
    };
  }

  attached({ chart, series }) {
    this.chart = chart;
    this.series = series;
  }

  detached() {
    this.chart = null;
    this.series = null;
  }

  paneViews() {
    return [this.view];
  }

  draw(target) {
    if (!this.chart || !this.series) return;
    const { entry, stop, from, to } = this.zone;
    const y1 = this.series.priceToCoordinate(entry);
    const y2 = this.series.priceToCoordinate(stop);
    const x1 = this.chart.timeScale().timeToCoordinate(from);
    if (y1 == null || y2 == null || x1 == null) return;
    const x2 = to != null ? this.chart.timeScale().timeToCoordinate(to) : null;
    target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      const left = Math.max(0, x1 * hr);
      const right = Math.min(bitmapSize.width, x2 != null ? x2 * hr : bitmapSize.width);
      const top = Math.min(y1, y2) * vr;
      const height = Math.max(1, Math.abs(y1 - y2) * vr);
      if (right <= left) return;
      context.fillStyle = withAlpha(this.tokens.neg, 0.12);
      context.fillRect(left, top, right - left, height);
      context.strokeStyle = withAlpha(this.tokens.neg, 0.4);
      context.lineWidth = Math.max(1, Math.round(hr));
      context.setLineDash([4 * hr, 4 * hr]);
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(right, top);
      context.moveTo(left, top + height);
      context.lineTo(right, top + height);
      context.stroke();
    });
  }
}

function GlassButton({ label, onClick, pressed, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="inline-flex w-fit items-center justify-center rounded-ds-sm border border-ds-line bg-ds-glass p-1.5 text-ds-text2 backdrop-blur-md transition-colors hover:text-ds-text aria-pressed:text-ds-text"
    >
      {children}
    </button>
  );
}

// onError lets the parent fall back to the TradingView widget if the chart cannot be built.
export default function TradeCandleChart({ candles, trade, interval, onError }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const tokensRef = useRef(null);
  const [mounted, setMounted] = useState(0);
  const [showLevels, setShowLevels] = useState(true);
  const step = intervalSeconds(interval);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !candles?.length) return undefined;
    let chart = null;
    try {
      const model = tradePositionModel(trade);
      const tokens = readTokens();
      tokensRef.current = tokens;
      chart = createChart(host, chartOptions(tokens));
      const series = chart.addSeries(CandlestickSeries, {
        upColor: tokens.pos,
        downColor: tokens.neg,
        borderVisible: false,
        wickUpColor: tokens.pos,
        wickDownColor: tokens.neg,
        priceFormat: chartPriceFormat(trade?.symbol, [model?.entry, model?.exit, candles[candles.length - 1].close]),
      });
      series.setData(candles);
      if (model) createSeriesMarkers(series, tradeMarkers(candles, model, step, tokens));
      const range = visibleRangeForTrade(candles, trade, step);
      if (range) chart.timeScale().setVisibleRange(range);
      chartRef.current = chart;
      seriesRef.current = series;
      setMounted((n) => n + 1);
    } catch (err) {
      console.warn("Candle chart failed:", err?.message);
      chart?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      onError?.();
      return undefined;
    }
    return () => {
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, [candles, trade?.id, step]);

  // Levels and zone live in their own effect so the toggle only changes the view.
  useEffect(() => {
    const series = seriesRef.current;
    const tokens = tokensRef.current;
    const model = tradePositionModel(trade);
    if (!series || !tokens || !model || !showLevels) return undefined;
    const lines = levelLines(model, tokens).map((line) =>
      series.createPriceLine({ ...line, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true }));
    const from = snapCandleTime(candles, model.entryTime, step);
    const to = model.exit != null ? snapCandleTime(candles, model.exitTime, step) : null;
    const zone = model.sl != null && from != null ? new RiskZonePrimitive({ entry: model.entry, stop: model.sl, from, to }, tokens) : null;
    if (zone) series.attachPrimitive(zone);
    return () => {
      lines.forEach((line) => series.removePriceLine(line));
      if (zone) series.detachPrimitive(zone);
    };
  }, [mounted, showLevels, trade?.id, step]);

  const focusTrade = () => {
    const range = visibleRangeForTrade(candles, trade, step);
    if (range) chartRef.current?.timeScale().setVisibleRange(range);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute left-2 top-2 z-10 flex w-fit gap-1">
        <GlassButton label="Focus on trade" onClick={focusTrade}><Crosshair className="h-3.5 w-3.5" /></GlassButton>
        <GlassButton label="Fit all candles" onClick={() => chartRef.current?.timeScale().fitContent()}><Maximize2 className="h-3.5 w-3.5" /></GlassButton>
        <GlassButton label={showLevels ? "Hide levels" : "Show levels"} pressed={showLevels} onClick={() => setShowLevels((v) => !v)}>
          {showLevels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </GlassButton>
      </div>
    </div>
  );
}
