import { formatChartPrice } from "@/lib/tradePreviewMarketData";

const HEIGHT = 168;
const PAD = 18;

// SVG presentation attributes need literal colors, not CSS vars.
const LEVEL_STYLES = {
  exit: { stroke: "#E8ECF5", label: "Exit" },
  sl: { stroke: "#F2555F", label: "Stop" },
  entry: { stroke: "#5C647C", label: "Entry" },
};

function levelList(levels) {
  return ["exit", "sl", "entry"]
    .map((id) => ({ id, price: levels?.[id], ...LEVEL_STYLES[id] }))
    .filter((item) => Number.isFinite(item.price));
}

export function TradeLevelsDiagram({ levels, title }) {
  const items = levelList(levels);
  if (items.length < 2) return null;
  const prices = items.map((item) => item.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const span = max - min || Math.abs(max) * 0.001 || 1;
  const y = (price) => PAD + ((max - price) / span) * (HEIGHT - PAD * 2);
  const hasZone = Number.isFinite(levels?.entry) && Number.isFinite(levels?.sl);

  return (
    <div className="rounded-[16px] border border-ds-line bg-ds-s2 p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3">{title}</p>
      <svg className="mt-2 block w-full" height={HEIGHT} role="img" aria-label={title}>
        {hasZone ? (
          <rect
            x="0"
            width="100%"
            y={Math.min(y(levels.entry), y(levels.sl))}
            height={Math.max(2, Math.abs(y(levels.entry) - y(levels.sl)))}
            fill="rgba(242, 85, 95, 0.12)"
          />
        ) : null}
        {items.map((item) => (
          <g key={item.id}>
            <line x1="0" x2="100%" y1={y(item.price)} y2={y(item.price)} stroke={item.stroke} strokeWidth="1" strokeDasharray="4 4" />
            <text x="2" y={item.id === "sl" ? y(item.price) + 13 : y(item.price) - 5} fill={item.stroke} fontSize="10.5" fontFamily="var(--font-sans)">
              {item.label} {formatChartPrice(item.price)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// rows: [{ label, value, color? }] — rows with empty values are dropped.
export function PlanVsActual({ title, rows }) {
  const visible = rows.filter((row) => row.value != null && row.value !== "");
  if (!visible.length) return null;
  return (
    <div className="rounded-[16px] border border-ds-line bg-ds-s2 p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3">{title}</p>
      <div className="mt-2 overflow-hidden rounded-[12px] border border-ds-line">
        {visible.map((row, index) => (
          <div key={row.label} className={`flex items-center justify-between gap-3 px-3 py-2 text-[12px] ${index ? "border-t border-ds-line" : ""}`}>
            <span className="text-ds-text2">{row.label}</span>
            <span className="truncate text-right tabular-nums" style={{ color: row.color || "var(--ds-text)" }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
