import { useId } from "react";

export default function Sparkline({ values = [], className = "", width, height, fill, glow = true, endLabel }) {
  const rawId = useId().replace(/:/g, "");
  if (!values.length) return null;

  const w = width || 72;
  const h = height || 28;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / span) * (h - 8) - (endLabel ? 10 : 4);
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = values[values.length - 1];
  const color = last >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))";
  const glowId = `spark-glow-${rawId}`;
  const fillId = `spark-fill-${rawId}`;
  const lastPt = pts[pts.length - 1];

  return (
    <svg
      width={fill ? "100%" : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon points={area} fill={`url(#${fillId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={fill ? "2.6" : "2"}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
        filter={glow ? `url(#${glowId})` : undefined}
      />
      {endLabel && lastPt && (
        <text
          x={Math.max(8, lastPt.x - 4)}
          y={Math.max(12, lastPt.y - 6)}
          textAnchor="end"
          fill={color}
          fontSize="11"
          fontWeight="600"
        >
          {endLabel}
        </text>
      )}
    </svg>
  );
}
