// Małe elementy wizualne strony "Dzień": buźki nastroju, pierścień, krzywa dnia, medale.
import { useId } from "react";
import { MOODS, fmtMoney } from "@/lib/dayFlow";

export function MoodFace({ level, color }) {
  const mood = MOODS[level];
  return (
    <svg viewBox="0 0 24 24" className="ico" style={{ strokeWidth: 1.6, ...(color ? { color } : null) }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r=".6" fill="currentColor" />
      <circle cx="15" cy="10" r=".6" fill="currentColor" />
      <path d={mood?.mouth || MOODS[2].mouth} />
    </svg>
  );
}

const toneColor = (score) => (score >= 80 ? "var(--win)" : score >= 50 ? "var(--warn)" : "var(--loss)");

export function ScoreRing({ score, size = 76, stroke = 7, fontSize = 16, label }) {
  const r = size / 2 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Dyscyplina ${score == null ? "brak" : score + "%"}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      {score != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor(value)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray .4s" }}
        />
      )}
      <text x={size / 2} y={size / 2 + fontSize / 3} textAnchor="middle" fill="var(--fg)" fontFamily="JetBrains Mono,monospace" fontSize={fontSize}>
        {label ?? (score == null ? "—" : `${score}%`)}
      </text>
    </svg>
  );
}

export { toneColor };

/** Krzywa dnia (SVG). points: [{ label, value }] zaczynające się od 0. */
export function DayCurve({ points, width = 640, height = 190, small = false, colors }) {
  const gid = useId().replace(/:/g, "");
  const pts = points && points.length > 1 ? points : [{ label: "", value: 0 }, { label: "", value: 0 }];
  const pl = small ? 6 : 58;
  const pr = small ? 6 : 16;
  const pt = small ? 8 : 16;
  const pb = small ? 8 : 26;
  const ys = pts.map((p) => p.value);
  const mx = Math.max(100, ...ys);
  const mn = Math.min(-100, ...ys);
  const X = (i) => pl + (i * (width - pl - pr)) / (pts.length - 1);
  const Y = (v) => pt + ((mx - v) * (height - pt - pb)) / (mx - mn);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const win = colors?.win || "var(--win)";
  const loss = colors?.loss || "var(--loss)";
  const mute = colors?.mute || "var(--mute)";
  const lc = last.value >= 0 ? win : loss;
  const step = small ? 0 : niceStep((mx - mn) / 4);
  const ticks = [];
  if (step) for (let v = Math.ceil(mn / step) * step; v <= mx; v += step) ticks.push(v);
  const showLabels = !small && pts.length <= 14;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Skumulowany wynik w ciągu dnia">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lc} stopOpacity=".28" />
          <stop offset="1" stopColor={lc} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={width - pr} y1={Y(v)} y2={Y(v)} stroke={mute} strokeOpacity={v === 0 ? 0.45 : 0.15} strokeDasharray={v === 0 ? "4 4" : undefined} />
          <text x={pl - 8} y={Y(v) + 4} textAnchor="end" fill={mute} fontSize="11" fontFamily="JetBrains Mono,monospace">
            {v === 0 ? "$0" : fmtMoney(v)}
          </text>
        </g>
      ))}
      {small && <line x1={pl} x2={width - pr} y1={Y(0)} y2={Y(0)} stroke={mute} strokeOpacity=".35" strokeDasharray="3 3" />}
      <path d={`${line} L${X(pts.length - 1)},${Y(0)} L${X(0)},${Y(0)} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={lc} strokeWidth={small ? 1.8 : 2.2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={X(i)}
            cy={Y(p.value)}
            r={i === pts.length - 1 ? (small ? 3.5 : 5) : small ? 2.2 : 3.5}
            fill={i === pts.length - 1 ? lc : "var(--ds-bg, #0b1122)"}
            stroke={lc}
            strokeWidth="1.8"
          />
          {showLabels && p.label ? (
            <text x={X(i)} y={height - 6} textAnchor="middle" fill={mute} fontSize="11" fontFamily="JetBrains Mono,monospace">
              {p.label}
            </text>
          ) : null}
        </g>
      ))}
      {!small && points && points.length > 1 && (
        <text x={X(pts.length - 1) - 10} y={Y(last.value) - 10} textAnchor="end" fill={lc} fontSize="12" fontFamily="JetBrains Mono,monospace">
          {fmtMoney(last.value)}
        </text>
      )}
    </svg>
  );
}

function niceStep(raw) {
  if (!(raw > 0)) return 0;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const MEDAL_COLORS = [
  ["#ffd36b", "#d08a1f"],
  ["#9fb0ff", "#4b5ee0"],
  ["#8ee58a", "#3d9b48"],
  ["#ff9da1", "#c2444b"],
  ["#7fe0e6", "#2f8f9a"],
  ["#d7b3ff", "#7c4fd1"],
];

export function Medal({ earned, index }) {
  const id = useId().replace(/:/g, "");
  const cols = MEDAL_COLORS[index % MEDAL_COLORS.length];
  return (
    <svg viewBox="0 0 44 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={earned ? cols[0] : "#2a3248"} />
          <stop offset="1" stopColor={earned ? cols[1] : "#171d2e"} />
        </linearGradient>
      </defs>
      <path d="M22 2 40 12v22L22 46 4 34V12z" fill={`url(#${id})`} stroke={earned ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.12)"} strokeWidth="1.2" />
      <path d="M22 10 32 16v14l-10 6-10-6V16z" fill="none" stroke={earned ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.08)"} strokeWidth="1.2" />
      {earned ? (
        <path d="m16.5 23.5 4 4 7.5-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <rect x="17" y="22" width="10" height="8" rx="1.5" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
          <path d="M19 22v-2.5a3 3 0 0 1 6 0V22" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

export function discColor(v) {
  if (v == null) return "var(--dim)";
  return v >= 4 ? "var(--win)" : v >= 3 ? "var(--warn)" : "var(--loss)";
}

export function Check({ item, onToggle }) {
  if (item.auto) {
    return (
      <div className={`ci auto ${item.ok ? "ok" : item.bad === false ? "" : "bad"}`}>
        <span className="bx" />
        <span className="tx">
          <b>{item.title}</b>
          <small>{item.hint}</small>
        </span>
        <span className="tag auto">auto</span>
      </div>
    );
  }
  return (
    <button type="button" className={`ci${item.ok ? " on" : ""}`} onClick={onToggle} aria-pressed={item.ok}>
      <span className="bx" />
      <span className="tx">
        <b>{item.title}</b>
        <small>{item.hint}</small>
      </span>
    </button>
  );
}
