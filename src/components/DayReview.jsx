import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Sparkline from "@/components/Sparkline";
import ImageViewer from "@/components/common/ImageViewer";
import { DISCIPLINE_FORMULA, computeDisciplineScore, computeSessionDiscipline } from "@/lib/disciplineInsights";
import { tradeMistakes } from "@/lib/calendarAggregates";
import { getTradeScreenshots } from "@/lib/tradePreviewStats";
import { firstNoteLine, stripNoteMarkdown } from "@/lib/noteMarkdown";
import { getTradeRealizedPL } from "@/lib/utils";

export const INK = "var(--ds-text)";
export const MUTED = "var(--ds-text2)";
export const LINE = "var(--ds-line)";
export const NEST_BG = "var(--ds-s2)";
const PROFIT = "var(--ds-pos)";
const LOSS = "var(--ds-neg)";
const WARN = "var(--ds-warn)";
const FAINT = "var(--ds-text3)";
const GLOW_TONES = new Set([PROFIT, LOSS, WARN]);
const PANEL_STYLE = { background: NEST_BG, border: `1px solid ${LINE}`, boxShadow: "var(--ds-inset)" };
const MICRO_LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.1em]";

export function tone(value) {
  if (value == null || !Number.isFinite(value) || value === 0) return MUTED;
  return value > 0 ? PROFIT : LOSS;
}

function textGlow(color) {
  return GLOW_TONES.has(color) ? `0 0 18px color-mix(in srgb, ${color} 25%, transparent)` : undefined;
}

export function tradeCountLabel(count, plText) {
  if (!plText) return `${count} ${count === 1 ? "trade" : "trades"}`;
  if (count === 1) return "1 transakcja";
  const lastTwo = count % 100;
  const last = count % 10;
  return `${count} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "transakcje" : "transakcji"}`;
}

export function tagEntries(trades) {
  const seen = new Map();
  (trades || []).forEach((trade) => {
    const add = (list, kind) => (Array.isArray(list) ? list : []).forEach((raw) => {
      const tag = String(raw || "").trim();
      if (tag && !seen.has(tag)) seen.set(tag, kind);
    });
    add(trade?.mistakes, "mistake");
    add(trade?.psychology_tags, "mind");
  });
  return [...seen.entries()].map(([tag, kind]) => ({ tag, kind }));
}

const asList = (value) => (Array.isArray(value) ? value : []);

// Display-only grouping: which of the day's trades carry each existing tag.
export function tagTradeGroups(trades) {
  return tagEntries(trades).map(({ tag, kind }) => ({
    tag,
    kind,
    trades: (trades || []).filter((trade) => [...asList(trade?.mistakes), ...asList(trade?.psychology_tags)]
      .some((raw) => String(raw || "").trim() === tag)),
  }));
}

// pnl: usePnlDisplay() result; only formats sums of existing realized results.
export function buildTagFindings(trades, pnl, plText) {
  return tagTradeGroups(trades).map((group) => {
    const sum = group.trades.reduce((acc, trade) => acc + (getTradeRealizedPL(trade) ?? 0), 0);
    return {
      id: group.tag,
      title: group.tag,
      kind: group.kind,
      count: tradeCountLabel(group.trades.length, plText),
      result: pnl.formatTrades(group.trades),
      resultColor: tone(sum),
    };
  });
}

// Cumulative realized P&L in time order; null when there is not enough data for a line.
export function dayEquityValues(trades, timeKey) {
  const points = (trades || [])
    .map((trade) => ({ key: timeKey(trade) || "", value: getTradeRealizedPL(trade) }))
    .filter((point) => point.value != null && Number.isFinite(point.value))
    .sort((a, b) => a.key.localeCompare(b.key));
  if (points.length < 2) return null;
  let running = 0;
  return points.map((point) => (running += point.value));
}

export function sessionRows(trades, getPl) {
  const map = new Map();
  (trades || []).forEach((trade) => {
    const name = String(trade?.session || "").trim();
    if (!name) return;
    const row = map.get(name) || { name, count: 0, pl: 0 };
    row.count += 1;
    row.pl += getPl(trade) ?? 0;
    map.set(name, row);
  });
  return [...map.values()];
}

export function DayShell({ children }) {
  return (
    <div className="day-shell flex flex-col overflow-hidden rounded-[16px]" style={{ background: "transparent", border: `1px solid ${LINE}` }}>
      {children}
    </div>
  );
}

function centerTile(container, key) {
  if (!container || !key) return;
  const tile = container.querySelector(`[data-day="${key}"]`);
  if (!tile) return;
  const left = tile.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
  container.scrollTo({ left: Math.max(0, left - container.clientWidth / 2 + tile.clientWidth / 2), behavior: "auto" });
}

function tagTone(kind) {
  if (kind === "mistake" || kind === "overtrading") return LOSS;
  if (kind === "mind" || kind === "risk" || kind === "mistakes") return WARN;
  return FAINT;
}

export function TagPill({ tag, kind, className = "" }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase leading-[14px] tracking-[0.08em] ${className}`}
      style={{ borderColor: "var(--ds-pill-line)", color: MUTED }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tagTone(kind) }} />
      <span className="truncate">{tag}</span>
    </span>
  );
}

// days: [{ key, label, valueText, valueColor, countText, tag, tagKind, tagExtra?, barRatio?, barColor? }]
export function DayStripRow({ title, onPrev, onNext, prevLabel, nextLabel, extra, days, selectedKey, onSelect, emptyText }) {
  const scrollerRef = useRef(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => centerTile(scrollerRef.current, selectedKey));
    return () => cancelAnimationFrame(frame);
  }, [selectedKey, days.length, title]);

  return (
    <div className="ds-rise flex min-w-0 items-stretch" style={{ borderBottom: `1px solid ${LINE}`, "--i": 0 }}>
      <div className="flex w-[156px] shrink-0 flex-col justify-center px-5 py-3">
        <p className="whitespace-nowrap text-[14px] font-medium capitalize" style={{ color: INK }}>{title}</p>
        <div className="mt-1.5 flex items-center gap-0.5">
          <button type="button" onClick={onPrev} aria-label={prevLabel} className="rounded-[8px] p-1 transition-colors duration-150 hover:bg-ds-s3" style={{ color: MUTED }}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onNext} aria-label={nextLabel} className="rounded-[8px] p-1 transition-colors duration-150 hover:bg-ds-s3" style={{ color: MUTED }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {extra}
        </div>
      </div>
      <div ref={scrollerRef} className="day-strip flex min-w-0 flex-1 gap-2 overflow-x-auto px-12 py-3" style={{ scrollbarWidth: "none" }}>
        {days.length === 0 ? (
          <p className="px-3 py-4 text-[12px]" style={{ color: MUTED }}>{emptyText}</p>
        ) : days.map((day) => {
          const selected = day.key === selectedKey;
          return (
            <button
              key={day.key}
              type="button"
              data-day={day.key}
              data-selected={selected ? "true" : "false"}
              aria-pressed={selected}
              onClick={() => onSelect(day)}
              className={`day-tile ds-press relative flex min-w-[148px] shrink-0 flex-col overflow-hidden rounded-[12px] border px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px ${
                selected ? "border-ds-frame bg-ds-s3" : "border-transparent bg-ds-s2 hover:bg-ds-s3"
              }`}
              style={{ boxShadow: selected ? "var(--ds-inset)" : "none" }}
            >
              {selected ? <span key={`sheen-${day.key}`} className="day-tile-sheen" aria-hidden="true" /> : null}
              <span className="whitespace-nowrap text-[11px]" style={{ color: selected ? INK : FAINT }}>{day.label}</span>
              <span className="mt-1 whitespace-nowrap text-[12px] tabular-nums">
                <span className="font-medium" style={{ color: day.valueColor }}>{day.valueText}</span>
                {day.countText ? <span style={{ color: selected ? MUTED : FAINT }}> · {day.countText}</span> : null}
              </span>
              <span className="mt-1.5 flex h-[20px] max-w-[200px] items-center gap-1.5">
                {day.tag ? <TagPill tag={day.tag} kind={day.tagKind} className="min-w-0" /> : null}
                {day.tagExtra ? <span className="shrink-0 text-[11px] tabular-nums" style={{ color: FAINT }}>+{day.tagExtra}</span> : null}
              </span>
              {day.barRatio ? (
                <span
                  className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-r-full"
                  style={{ width: `${Math.max(6, Math.round(day.barRatio * 100))}%`, background: day.barColor, opacity: 0.4 }}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

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

// Animates the first number inside text once on mount; the last frame is always the original text.
function CountUpText({ text }) {
  const [shown, setShown] = useState(text);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const match = /\d[\d.,\u00a0\u202f ]*\d|\d/.exec(textRef.current);
    if (!match || prefersReducedMotion()) return undefined;
    const original = textRef.current;
    const parsed = parseNumericToken(match[0].trim());
    if (!parsed.value) return undefined;
    const before = original.slice(0, match.index);
    const after = original.slice(match.index + match[0].trim().length);
    const start = performance.now();
    const duration = 520;
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
    setShown((prev) => (prev === text ? prev : text));
  }, [text]);

  return shown;
}

function scoreGaugeColor(score) {
  if (score >= 80) return PROFIT;
  if (score >= 60) return WARN;
  return LOSS;
}

// 36px ring, 3px stroke; purely visual, drawn from an already computed 0–100 score.
function ScoreGauge({ score }) {
  const radius = 16.5;
  const circumference = 2 * Math.PI * radius;
  const color = scoreGaugeColor(score);
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="pointer-events-none absolute right-3 top-3" aria-hidden="true">
      <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--ds-line)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, Math.max(0, score)) / 100) * circumference} ${circumference}`}
        transform="rotate(-90 18 18)"
        style={{ filter: `drop-shadow(0 0 4px color-mix(in srgb, ${color} 45%, transparent))` }}
      />
    </svg>
  );
}

// Decorative: the same numbers are already in the cell's hint text.
function MeterTrack({ children }) {
  return (
    <div className="mt-2 flex h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--ds-line)" }} aria-hidden="true">
      {children}
    </div>
  );
}

// wl: { wins, losses, total } — shares of the day's trades; breakeven trades stay as empty track.
function WinLossBar({ wl }) {
  const share = (value) => `${(value / wl.total) * 100}%`;
  return (
    <MeterTrack>
      <span style={{ width: share(wl.wins), background: PROFIT }} />
      <span className="ml-auto" style={{ width: share(wl.losses), background: LOSS }} />
    </MeterTrack>
  );
}

function ProgressBar({ value }) {
  return (
    <MeterTrack>
      <span className="rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: "var(--ds-text2)" }} />
    </MeterTrack>
  );
}

// metrics: [{ label, value, color, hint, hintTitle?, spark?, gauge?, wl?, progress? }]
// dayKey remounts the grid so a new day cross-fades and counts up once.
export function DayStatsSection({ title, action, metrics, dayKey = "", children }) {
  const columns = metrics.length > 5 ? "2xl:grid-cols-6" : "xl:grid-cols-5";
  return (
    <section className="px-5 py-6" style={{ borderBottom: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[18px] font-medium" style={{ color: INK }}>{title}</p>
        {action}
      </div>
      <div className="ds-rise" style={{ "--i": 1 }}>
        <div key={dayKey} className={`ds-fade mt-4 grid grid-cols-1 overflow-hidden rounded-[16px] min-[400px]:grid-cols-2 md:grid-cols-3 ${columns}`} style={PANEL_STYLE}>
          {metrics.map((metric) => {
            const corner = metric.spark || metric.gauge != null;
            return (
              <div
                key={metric.label}
                className="ds-spot relative min-w-0 px-3 py-4 transition-colors duration-150 hover:bg-ds-s2 sm:px-4"
                style={{ boxShadow: `-1px 0 0 ${LINE}, 0 -1px 0 ${LINE}` }}
              >
                {metric.spark ? (
                  <Sparkline values={metric.spark} width={56} height={28} glow={false} className="pointer-events-none absolute right-3 top-3 opacity-70" />
                ) : null}
                {metric.gauge != null ? <ScoreGauge score={metric.gauge} /> : null}
                <p className={`line-clamp-2 break-words sm:truncate ${corner ? "pr-12" : ""} ${MICRO_LABEL}`} style={{ color: FAINT }}>{metric.label}</p>
                <p
                  className={`mt-2.5 truncate whitespace-nowrap text-[26px] font-semibold leading-none tracking-[-0.01em] tabular-nums xl:text-[28px] ${corner ? "pr-10" : ""}`}
                  style={{ color: metric.color || INK, textShadow: textGlow(metric.color) }}
                >
                  {typeof metric.value === "string" ? <CountUpText text={metric.value} /> : metric.value}
                </p>
                <p className="mt-2 line-clamp-2 min-h-[15px] text-[11px] leading-[15px] sm:truncate" style={{ color: FAINT }} title={metric.hintTitle || undefined}>{metric.hint}</p>
                {metric.wl?.total ? <WinLossBar wl={metric.wl} /> : null}
                {metric.progress != null ? <ProgressBar value={metric.progress} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {children ? <div key={dayKey} className="ds-fade ds-stagger mt-4 grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">{children}</div> : null}
    </section>
  );
}

export function NestPanel({ title, children }) {
  return (
    <div className="ds-spot flex min-h-[150px] flex-col rounded-[16px] px-5 py-4" style={PANEL_STYLE}>
      <p className={MICRO_LABEL} style={{ color: FAINT }}>{title}</p>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function QuoteText({ children, className = "" }) {
  return (
    <div className={`border-l-2 pl-3.5 text-[14px] leading-[1.6] ${className}`} style={{ borderColor: "color-mix(in srgb, var(--ds-text3) 55%, transparent)", color: MUTED }}>
      {children}
    </div>
  );
}

function MicroValue({ label, value }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className={MICRO_LABEL} style={{ color: FAINT }}>{label}:</span>
      <span className="text-[13px] font-medium tabular-nums" style={{ color: INK }}>{value}</span>
    </p>
  );
}

export function DaySummary({ notes, scoreLabel, scoreValue, tags, emptyText }) {
  return (
    <>
      <QuoteText>
        {notes.length ? (
          <div className="space-y-2">
            {notes.slice(0, 3).map((row) => (
              <p key={row.id} className="line-clamp-4">
                <span style={{ color: INK }}>{row.symbol || "—"}. </span>{stripNoteMarkdown(row.notes)}
              </p>
            ))}
          </div>
        ) : <p>{emptyText}</p>}
      </QuoteText>
      {scoreValue ? <div className="mt-4"><MicroValue label={scoreLabel} value={scoreValue} /></div> : null}
      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((entry) => <TagPill key={entry.tag} tag={entry.tag} kind={entry.kind} />)}
        </div>
      ) : null}
    </>
  );
}

function ShotThumbs({ urls, label, onOpen, large = false }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url, index) => (
        <button
          key={url}
          type="button"
          onClick={() => onOpen(url)}
          aria-label={`${label} ${index + 1}`}
          className={`${large ? "aspect-[8/5] w-[160px] max-w-full" : "h-12 w-[72px]"} ds-press shrink-0 overflow-hidden rounded-[8px] border transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ds-frame`}
          style={{ borderColor: LINE, background: NEST_BG }}
        >
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// describe(trade) → { title, meta, result, resultColor }; screenshots are read-only.
export function JournalPreview({ rows, describe, onOpenTrade, emptyText, noShotsText, shotLabel }) {
  const [viewer, setViewer] = useState("");
  const preview = (rows || []).slice(0, 3);
  if (!preview.length) return <p className="text-[12px]" style={{ color: MUTED }}>{emptyText}</p>;
  const shots = new Map(preview.map((trade) => [trade.id, getTradeScreenshots(trade).slice(0, 3)]));
  const shotCount = [...shots.values()].reduce((sum, list) => sum + list.length, 0);
  const anyShots = shotCount > 0;
  return (
    <div className="space-y-3">
      {preview.map((trade) => {
        const info = describe(trade);
        const noteLine = firstNoteLine(trade.notes);
        return (
          <div key={trade.id}>
            <button type="button" onClick={() => onOpenTrade(trade)} className="-mx-2 block w-[calc(100%+16px)] rounded-[10px] px-2 py-1 text-left transition-colors duration-150 hover:bg-ds-s3">
              <span className="flex items-center justify-between gap-2 text-[13px]">
                <span className="font-medium" style={{ color: INK }}>{info.title}</span>
                <span className="tabular-nums" style={{ color: info.resultColor }}>{info.result}</span>
              </span>
              <span className="mt-0.5 block truncate text-[11px]" style={{ color: FAINT }}>{info.meta || "—"}</span>
              {noteLine ? <span className="mt-1 block truncate text-[12px]" style={{ color: MUTED }}>{noteLine}</span> : null}
            </button>
            {shots.get(trade.id).length ? <ShotThumbs urls={shots.get(trade.id)} label={shotLabel} onOpen={setViewer} large={shotCount <= 2} /> : null}
          </div>
        );
      })}
      {anyShots ? null : <p className="text-[11px]" style={{ color: FAINT }}>{noShotsText}</p>}
      <ImageViewer open={Boolean(viewer)} onOpenChange={(open) => { if (!open) setViewer(""); }} imageUrl={viewer} />
    </div>
  );
}

function sortRows(rows, column, dir) {
  if (!column?.sortValue || !dir) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = column.sortValue(a);
    const right = column.sortValue(b);
    if (left === right) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return left > right ? sign : -sign;
  });
}

function SortHeader({ col, dir, onToggle }) {
  const Icon = dir === "desc" ? ChevronDown : ChevronUp;
  return (
    <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 uppercase tracking-[0.1em] transition-colors duration-200 hover:text-ds-text2">
      {col.label}
      <Icon className={`h-3 w-3 ${dir ? "opacity-100" : "opacity-50"}`} strokeWidth={2} />
    </button>
  );
}

// columns: [{ key, label, align, muted, render(trade), sortValue?(trade) }]
// Selection and sort order are view-only state; they never touch trade data.
export function TradesSection({ title, rows, columns, onOpen, empty, minWidth = 560 }) {
  const [selected, setSelected] = useState(() => new Set());
  const [sort, setSort] = useState({ key: columns.find((col) => col.sortValue)?.key, dir: null });
  const sortColumn = columns.find((col) => col.key === sort.key);
  const visibleRows = sortRows(rows, sortColumn, sort.dir);
  const allSelected = rows.length > 0 && rows.every((trade) => selected.has(trade.id));

  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((trade) => trade.id)));
  const toggleSort = (key) => setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));

  return (
    <section className="ds-rise flex-1 px-5 py-6" style={{ "--i": 4 }}>
      <p className="flex items-center gap-2 text-[18px] font-medium" style={{ color: INK }}>
        {title}
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium leading-none tabular-nums" style={{ background: "var(--ds-s3)", color: MUTED }}>{rows.length}</span>
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="day-trades w-full text-left" style={{ minWidth }}>
          <thead>
            <tr>
              <th className="w-10 py-1.5 pl-4 pr-0">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={!rows.length} aria-label="Zaznacz wszystkie" />
              </th>
              {columns.map((col) => (
                <th key={col.key} className={`whitespace-nowrap px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${col.align === "right" ? "text-right" : ""}`} style={{ color: FAINT }}>
                  {col.sortValue ? <SortHeader col={col} dir={sort.key === col.key ? sort.dir : null} onToggle={() => toggleSort(col.key)} /> : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-[13px]" style={{ color: MUTED }}>{empty}</td></tr>
            ) : visibleRows.map((trade) => {
              const isSelected = selected.has(trade.id);
              return (
                <tr key={trade.id} onClick={() => onOpen(trade)} data-row-selected={isSelected ? "true" : "false"} className="ds-spot cursor-pointer">
                  <td className="w-10 py-3 pl-4 pr-0" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(trade.id)} aria-label={`Zaznacz ${trade.symbol || ""}`} />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-[13px] ${col.align === "right" ? "text-right tabular-nums" : ""}`} style={{ color: col.muted ? MUTED : INK }}>
                      {col.render(trade)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// tabs: [{ id, label, content }]
// Tracks the active tab's box so one indicator can slide between tabs.
function useTabIndicator(listRef, activeId) {
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const measure = () => {
      const tab = list.querySelector(`[data-tab-id="${activeId}"]`);
      if (tab) setBox({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(list);
    return () => observer?.disconnect();
  }, [listRef, activeId]);
  return box;
}

export function ReviewAside({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) || tabs[0];
  const listRef = useRef(null);
  const indicator = useTabIndicator(listRef, current?.id);
  return (
    <aside className="ds-rise min-w-0 lg:border-l" style={{ borderColor: LINE, "--i": 2 }}>
      <div ref={listRef} className="relative flex gap-1 px-3" role="tablist" style={{ borderBottom: `1px solid ${LINE}` }}>
        {tabs.map((tab) => {
          const on = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-state={on ? "active" : "inactive"}
              data-tab-id={tab.id}
              onClick={() => setActive(tab.id)}
              className="aside-tab ds-press -mb-px rounded-t-[8px] px-2.5 py-3.5 text-[13px] transition-colors duration-150 hover:bg-ds-s2 hover:text-ds-text"
              style={{ color: on ? INK : FAINT, fontWeight: on ? 500 : 400 }}
            >
              {tab.label}
            </button>
          );
        })}
        {indicator ? (
          <span
            className="aside-tab-indicator pointer-events-none absolute -bottom-px left-0 h-[2px] rounded-full"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, background: INK }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="px-5 py-6">{current?.content}</div>
    </aside>
  );
}

export function AsideHeading({ children, className = "" }) {
  return <p className={`text-[15px] font-medium ${className}`} style={{ color: INK }}>{children}</p>;
}

export function KeyValueTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-[12px]" style={PANEL_STYLE}>
      {rows.map((row, index) => (
        <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]" style={{ borderTop: index ? `1px solid ${LINE}` : "none" }}>
          <span style={{ color: MUTED }}>{row.label}</span>
          <span className="truncate text-right tabular-nums" style={{ color: row.color || INK }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function FindingTitle({ index, title, kind, badge }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK }}>
      <span className="tabular-nums" style={{ color: FAINT }}>{index}.</span>
      {kind ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagTone(kind) }} /> : null}
      <span className="min-w-0 break-words">{title}</span>
      {badge}
    </p>
  );
}

// Tags sharing the same trade count and result collapse into one block instead of repeating identical rows.
export function groupFindings(findings) {
  const groups = new Map();
  (findings || []).forEach((finding) => {
    const key = `${finding.count}|${finding.result}`;
    const group = groups.get(key);
    if (group) group.tags.push(finding);
    else groups.set(key, { id: key, count: finding.count, result: finding.result, resultColor: finding.resultColor, tags: [finding] });
  });
  return [...groups.values()];
}

function FindingGroup({ group, index }) {
  const single = group.tags.length === 1 ? group.tags[0] : null;
  return (
    <li className="px-3 py-2.5" style={{ borderTop: index ? `1px solid ${LINE}` : "none" }}>
      {single ? (
        <FindingTitle index={index + 1} title={single.title} kind={single.kind} />
      ) : (
        <div className="flex gap-2">
          <span className="pt-[3px] text-[11px] font-semibold tabular-nums" style={{ color: FAINT }}>{index + 1}.</span>
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {group.tags.map((tag) => <TagPill key={tag.id} tag={tag.title} kind={tag.kind} />)}
          </span>
        </div>
      )}
      <p className="mt-1.5 flex items-baseline justify-between gap-3 pl-[18px] text-[12px] tabular-nums">
        <span style={{ color: MUTED }}>{group.count}</span>
        <span style={{ color: group.resultColor }}>{group.result}</span>
      </p>
    </li>
  );
}

// findings: [{ id, title, kind, count, result, resultColor }] from existing tags; items: [{ id, title, badge, badgeKind, rows, note, onOpen, openLabel }]
export function DayFindings({ summaryTitle, summary, findingsTitle, items, emptyText, tagsTitle, findings = [] }) {
  const groups = groupFindings(findings);
  return (
    <div className="space-y-6">
      <div>
        <AsideHeading>{summaryTitle}</AsideHeading>
        <QuoteText className="mt-2.5 text-[13px]">{summary}</QuoteText>
      </div>
      {groups.length ? (
        <div>
          <AsideHeading>{tagsTitle}</AsideHeading>
          <ol className="ds-spot mt-3 overflow-hidden rounded-[12px]" style={PANEL_STYLE}>
            {groups.map((group, index) => <FindingGroup key={group.id} group={group} index={index} />)}
          </ol>
        </div>
      ) : null}
      {items.length ? (
        <div>
          <AsideHeading>{findingsTitle}</AsideHeading>
          <div className="mt-3 space-y-6">
            {items.map((item, index) => (
              <div key={item.id}>
                <FindingTitle index={index + 1} title={item.title} badge={item.badge ? <TagPill tag={item.badge} kind={item.badgeKind} /> : null} />
                {item.note ? <p className="mt-1.5 line-clamp-3 text-[12px] leading-[18px]" style={{ color: MUTED }}>{stripNoteMarkdown(item.note)}</p> : null}
                <div className="mt-2"><KeyValueTable rows={item.rows} /></div>
                <button
                  type="button"
                  onClick={item.onOpen}
                  className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
                  style={{ borderColor: LINE, color: MUTED }}
                >
                  {item.openLabel}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: MUTED }}>{emptyText}</p>
      )}
    </div>
  );
}

function scoreTone(score) {
  if (score >= 80) return { bg: "var(--ds-pos-tint)", fg: "var(--ds-pos)" };
  if (score >= 60) return { bg: "var(--ds-warn-tint)", fg: "var(--ds-warn)" };
  return { bg: "var(--ds-neg-tint)", fg: "var(--ds-neg)" };
}

export function DisciplineTooltip({ children, title, formula, reasons = [], skipped = [], emptyReasonsText }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] rounded-[12px] border border-ds-frame bg-popover px-3 py-2.5 text-[11px] leading-[16px] text-ds-text2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <p className="font-semibold text-ds-text">{title}</p>
          <p className="mt-1">{formula}</p>
          <ul className="mt-1.5 space-y-0.5">
            {reasons.length ? reasons.map((reason) => (
              <li key={reason.code} style={{ color: "var(--ds-neg)" }}>{reason.points} · {reason.label}</li>
            )) : <li>{emptyReasonsText}</li>}
            {skipped.map((item) => <li key={item} className="text-ds-text3">— {item}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// result: computeDisciplineScore() output
export function DisciplineBadge({ result, tooltip }) {
  if (result?.score == null) return <span style={{ color: MUTED }}>—</span>;
  const colors = scoreTone(result.score);
  return (
    <DisciplineTooltip {...tooltip} reasons={result.reasons} skipped={result.skipped}>
      <span
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-6 w-8 cursor-help items-center justify-center rounded-[6px] text-[11px] font-semibold tabular-nums"
        style={{ background: colors.bg, color: colors.fg, boxShadow: `0 0 12px color-mix(in srgb, ${colors.fg} 22%, transparent)` }}
      >
        {result.score}
      </span>
    </DisciplineTooltip>
  );
}

// labels: { overtrading, risk, mistakes, none }. One compact pill per row; full tags live in the summary and aside.
export function ViolationFlags({ result, labels, mistakeCount = 0 }) {
  if (result?.score == null) return <span style={{ color: MUTED }}>—</span>;
  if (!result.flags.length) return <span style={{ color: MUTED }}>{labels.none}</span>;
  if (mistakeCount > 0) return <TagPill tag={`${labels.mistakes} · ${mistakeCount}`} kind="mistakes" />;
  const [first, ...rest] = result.flags;
  return (
    <span className="inline-flex items-center gap-1">
      <TagPill tag={labels[first]} kind={first} />
      {rest.length ? <span className="text-[11px] tabular-nums" style={{ color: FAINT }}>+{rest.length}</span> : null}
    </span>
  );
}

function disciplineText(pl) {
  return {
    title: pl ? "Dyscyplina (orientacyjnie)" : "Discipline (indicative)",
    formula: DISCIPLINE_FORMULA,
    emptyReasonsText: pl ? "Brak potrąceń." : "No deductions.",
  };
}

// Read-only columns for TradesSection; scores come from disciplineInsights and are never saved.
// rows may span several days; each trade is scored only against trades from its own date.
export function disciplineColumns(rows, pl) {
  const byDay = new Map();
  (rows || []).forEach((trade) => {
    const key = String(trade.date || "").slice(0, 10);
    byDay.set(key, [...(byDay.get(key) || []), trade]);
  });
  const results = new Map((rows || []).map((trade) => [trade.id, computeDisciplineScore(trade, byDay.get(String(trade.date || "").slice(0, 10)))]));
  const tooltip = disciplineText(pl);
  const labels = pl
    ? { overtrading: "Overtrading", risk: "Ryzyko > mediana", mistakes: "Błędy", none: "Brak" }
    : { overtrading: "Overtrading", risk: "Risk > median", mistakes: "Mistakes", none: "None" };
  return [
    {
      key: "discipline",
      label: pl ? "Dyscyplina" : "Discipline",
      render: (trade) => <DisciplineBadge result={results.get(trade.id)} tooltip={tooltip} />,
      sortValue: (trade) => results.get(trade.id)?.score ?? null,
    },
    {
      key: "violations",
      label: pl ? "Naruszenia" : "Violations",
      render: (trade) => <ViolationFlags result={results.get(trade.id)} labels={labels} mistakeCount={tradeMistakes(trade).length} />,
    },
  ];
}

export function sessionDisciplineMetric(dayTrades, pl) {
  const session = computeSessionDiscipline(dayTrades);
  const label = pl ? "Dyscyplina sesji" : "Session discipline";
  if (session.average == null) return { label, value: "—", color: MUTED, hint: pl ? "brak danych" : "no data", hintTitle: pl ? "Orientacyjnie · brak danych" : "Indicative · no data" };
  const tooltip = disciplineText(pl);
  const hint = `${pl ? "orientacyjnie" : "indicative"} · min ${session.min} · max ${session.max} · ${pl ? "oznaczone" : "flagged"}: ${session.flaggedCount}`;
  return {
    label,
    value: (
      <DisciplineTooltip
        {...tooltip}
        reasons={[]}
        skipped={[pl ? `Średnia z ${session.scoredCount} transakcji` : `Average of ${session.scoredCount} trades`]}
        emptyReasonsText={pl ? `Oznaczone transakcje: ${session.flaggedCount}` : `Flagged trades: ${session.flaggedCount}`}
      >
        <span tabIndex={0} className="cursor-help">{session.average} / 100</span>
      </DisciplineTooltip>
    ),
    color: scoreTone(session.average).fg,
    hint: `min ${session.min} · max ${session.max}`,
    hintTitle: hint,
    gauge: session.average,
  };
}
