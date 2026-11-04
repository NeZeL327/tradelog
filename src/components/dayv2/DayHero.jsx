// Pasek "Dziś": data, status rynku na żywo, trzy liczby, następny krok i oś dnia 00–24.
import { Check, ChevronRight, Smartphone } from "lucide-react";
import { fmtMoney, fmtR, marketStatus } from "@/lib/dayFlow";
import { hhmmOf } from "@/lib/daySessions";
import { toneColor } from "./parts";

const pct = (minutes) => `${((Math.max(0, Math.min(1440, minutes)) / 1440) * 100).toFixed(2)}%`;
const onAxis = (minutes) => `calc(66px + (100% - 66px) * ${Math.max(0, Math.min(1440, minutes)) / 1440})`;

export default function DayHero({ dateLabel, isToday, nowMin, sessions, selectedId, views, stats, limit, discipline, news, next, onNext, onWork }) {
  const status = marketStatus({ minutes: nowMin, sessions, news, isToday });
  const dotLane = selectedId || "london";
  const dots = views.filter((v) => v.minutes != null);
  return (
    <section className="hero" aria-label="Dziś">
      <div className="htop">
        <div>
          <div className="hdate">{dateLabel}</div>
          <div className={`hstat${status.tone === "warn" ? " warn" : ""}`}>
            <span className={`ldot${status.tone === "warn" ? " warn" : status.tone === "live" ? "" : " off"}`} />
            <span>{status.parts.map((p, i) => (p.strong ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}</span>
          </div>
        </div>
        <div className="hnums">
          <div>
            <span className="l">Wynik dziś</span>
            <b className={stats.net >= 0 ? "pos" : "neg"}>{stats.closed ? fmtMoney(stats.net) : "$0"}</b>
            <small>{stats.rCount ? fmtR(stats.r) : "—"}</small>
          </div>
          <div>
            <span className="l">Transakcje</span>
            <b>
              {stats.n}
              <em> / {limit}</em>
            </b>
            <small>{stats.n >= limit ? "limit osiągnięty" : `zostało ${limit - stats.n}`}</small>
          </div>
          <div>
            <span className="l">Dyscyplina</span>
            <b style={{ color: toneColor(discipline.score) }}>{discipline.score}%</b>
            <small>
              {discipline.done} z {discipline.total} zasad
            </small>
          </div>
        </div>
        <div className="hcta">
          <span>Następny krok</span>
          <button type="button" className={`btn${next.disabled ? "" : " pri"}`} disabled={next.disabled} onClick={() => onNext(next.action)}>
            {next.disabled ? <Check className="ico" style={{ color: "var(--win)" }} /> : null}
            {next.label}
            {next.disabled ? null : <ChevronRight className="ico" />}
          </button>
          <button type="button" className="btn sm" onClick={onWork}>
            <Smartphone className="ico" />
            Tryb w pracy
          </button>
        </div>
      </div>

      <div className="tl">
        {isToday ? (
          <div className="now" style={{ left: onAxis(nowMin) }}>
            <b>{hhmmOf(nowMin)}</b>
          </div>
        ) : null}
        {news
          .filter((n) => n.impact === "high")
          .map((n, i) => (
            <span key={`nl${i}`} className="nline" style={{ left: onAxis(n.minutes) }} />
          ))}
        {sessions.map((s) => (
          <div key={s.id} className={`lane${selectedId === s.id ? " on" : ""}`}>
            <em>{s.name}</em>
            <span className="bar" style={{ left: pct(s.from), width: pct(s.to - s.from) }} title={`${s.name} ${s.label}`} />
            {s.killZone ? (
              <span
                className="kz"
                style={{ left: pct(s.killZone.from), width: pct(s.killZone.to - s.killZone.from) }}
                title={`Kill zone ${hhmmOf(s.killZone.from)}–${hhmmOf(s.killZone.to)}`}
              />
            ) : null}
            {dotLane === s.id
              ? dots.map((v) => (
                  <span
                    key={v.id}
                    className={`tdot ${(v.net ?? 0) >= 0 ? "w" : "l"}`}
                    style={{ left: pct(v.minutes) }}
                    title={`${v.time} ${v.symbol} ${v.dir === "L" ? "Long" : "Short"} ${fmtR(v.r)} (${fmtMoney(v.net)})`}
                  />
                ))
              : null}
          </div>
        ))}
        <div className="lane news">
          <em>Newsy</em>
          {news.map((n, i) => (
            <span
              key={`n${i}`}
              className={`nw ${n.impact}`}
              style={{ left: pct(n.minutes) }}
              title={`${n.time} ${n.cur} ${n.name}${n.impact === "high" ? " · wysoki wpływ" : ""}`}
            />
          ))}
        </div>
        <div className="ticks">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h} style={{ left: pct(h * 60) }}>
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
      <div className="tlleg">
        <span>
          <i style={{ background: "color-mix(in srgb,var(--accent) 42%,transparent)", border: "1px solid var(--accent2)" }} />
          Twoja sesja
        </span>
        <span>
          <i style={{ background: "repeating-linear-gradient(135deg,color-mix(in srgb,var(--warn) 75%,transparent) 0 3px,color-mix(in srgb,var(--warn) 35%,transparent) 3px 6px)" }} />
          Kill zone
        </span>
        <span>
          <i style={{ background: "var(--win)", width: 9, height: 9, borderRadius: "50%" }} />
          Zysk
        </span>
        <span>
          <i style={{ background: "var(--loss)", width: 9, height: 9, borderRadius: "50%" }} />
          Strata
        </span>
        <span>
          <i style={{ background: "var(--loss)", width: 9, height: 9, transform: "rotate(45deg)" }} />
          News wysoki
        </span>
        <span>
          <i style={{ background: "var(--orange)", width: 9, height: 9, transform: "rotate(45deg)" }} />
          średni
        </span>
        <span>Godziny polskie</span>
      </div>
    </section>
  );
}
