export default function Sparkline({ values = [], className = "" }) {
  if (!values.length) return null;

  const w = 72;
  const h = 28;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = values[values.length - 1];
  const color = last >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polygon points={area} fill={color} opacity="0.16" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
