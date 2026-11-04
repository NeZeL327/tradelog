// Prawy panel: wynik za dyscyplinę, postęp (mapa ciepła, seria), odznaki, limity konta, "Twój plan".
import { Flame } from "lucide-react";
import { MOODS, effectiveTradeLimit, fmtMoney, isLimitLowered, moodLevel, riskPercent, dailyStopPercent, scoreHeadline } from "@/lib/dayFlow";
import { Medal, ScoreRing } from "./parts";

const DAY_LABELS = ["Pn", "", "Śr", "", "Pt"];

export default function DayAside({ doc, promise, discipline, heat, streak, avg30, badges, newBadgeKey, account, balance, stats, sessions, pairs }) {
  const groups = [
    ["Przygotowanie", discipline.prep],
    ["Handel", discipline.trade],
    ["Refleksja", discipline.refl],
  ];
  const used = Math.max(0, -stats.net);
  const stop = dailyStopPercent(doc);
  const stopMoney = balance > 0 ? (balance * stop) / 100 : null;
  const propPct = parseFloat(account?.max_daily_loss_percent);
  const propMoney = balance > 0 && propPct > 0 ? (balance * propPct) / 100 : null;
  const risk = riskPercent(doc);
  const oneR = balance > 0 ? (balance * risk) / 100 : null;
  const mood = moodLevel(doc);
  const session = sessions.find((s) => s.id === doc?.mapping_session);
  const biasList = pairs.filter((p) => doc?.bias_levels?.[p]?.bias);
  const promiseRule = doc?.promise?.acknowledged ? promise?.rule : null;

  return (
    <aside className="dz-aside" aria-label="Podsumowanie dnia">
      <div className="card">
        <div className="lab" style={{ marginBottom: 12 }}>
          Wynik dnia za dyscyplinę
        </div>
        <div className="dz-ring">
          <ScoreRing score={discipline.score} />
          <div className="t">
            <b>{scoreHeadline(discipline.score)}</b>
            {discipline.done} z {discipline.total} zasad spełnionych
          </div>
        </div>
        <div className="groups">
          {groups.map(([name, g]) => (
            <div className="grp" key={name}>
              <div className="row">
                <span>{name}</span>
                <span>
                  {g.done}/{g.total}
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${(g.done / g.total) * 100}%`, ...(g.done === g.total ? { background: "var(--win)" } : null) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mbar">
          <span className="lab">Postęp</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--mute)" }}>
            ostatnie 12 tygodni
          </span>
        </div>
        <div className="heat" role="img" aria-label="Mapa zamkniętych dni z ostatnich 12 tygodni">
          {DAY_LABELS.map((label, d) => (
            <HeatRow key={d} label={label} cells={heat.filter((c) => c.day === d)} />
          ))}
        </div>
        <div className="legend">
          mniej <i style={{ background: "color-mix(in srgb,var(--loss) 45%,transparent)" }} />
          <i style={{ background: "color-mix(in srgb,var(--warn) 45%,transparent)" }} />
          <i style={{ background: "color-mix(in srgb,var(--win) 40%,transparent)" }} />
          <i style={{ background: "color-mix(in srgb,var(--win) 80%,transparent)" }} /> więcej zasad
        </div>
        <div className="sstats">
          <div>
            <b>
              <Flame className="ico" style={{ color: "var(--warn)" }} />
              {streak} {streak === 1 ? "dzień" : "dni"}
            </b>
            <span>Seria zamkniętych dni</span>
          </div>
          <div>
            <b>{avg30 == null ? "—" : `${avg30}%`}</b>
            <span>Średni wynik, 30 dni</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mbar">
          <span className="lab">Odznaki</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--mute)" }}>
            {badges.filter((b) => b.earned).length} / {badges.length}
          </span>
        </div>
        <div className="badges">
          {badges.map((b, i) => (
            <div key={b.key} className={`bdg${b.earned ? "" : " lock"}${newBadgeKey === b.key ? " new" : ""}`} title={`${b.name}: ${Math.min(b.count, b.goal)}/${b.goal} ${b.desc}`}>
              <Medal earned={b.earned} index={i} />
              <b>{b.name}</b>
              {b.earned ? (
                <small>zdobyta</small>
              ) : (
                <>
                  <div className="pb">
                    <i style={{ width: `${(Math.min(b.count, b.goal) / b.goal) * 100}%` }} />
                  </div>
                  <small>
                    {Math.min(b.count, b.goal)}/{b.goal}
                  </small>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="lab" style={{ marginBottom: 12 }}>
          Limity konta
        </div>
        <div className="lim">
          <div>
            <div className="row">
              <span>Twój stop dzienny (−{stop}%)</span>
              <b>{stopMoney == null ? "—" : `${fmtMoney(Math.max(0, stopMoney - used), { sign: false })} wolne`}</b>
            </div>
            <div className="bar">
              <i style={{ width: `${stopMoney ? Math.min(100, (used / stopMoney) * 100) : 0}%`, background: "var(--warn)" }} />
            </div>
          </div>
          {propMoney != null ? (
            <div>
              <div className="row">
                <span>
                  Daily loss {account?.broker || account?.name || "prop"} ({propPct}%)
                </span>
                <b>{fmtMoney(Math.max(0, propMoney - used), { sign: false })}</b>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.min(100, (used / propMoney) * 100)}%`, background: "var(--loss)" }} />
              </div>
            </div>
          ) : (
            <div className="row">
              <span>Daily loss prop firmy</span>
              <b className="mut">ustaw w Kontach</b>
            </div>
          )}
          <div className="row">
            <span>1R przy {risk.toFixed(2)}%</span>
            <b>{oneR == null ? "—" : fmtMoney(oneR, { sign: false })}</b>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="lab" style={{ marginBottom: 10 }}>
          Twój plan
        </div>
        <div className="planbox">
          <div>
            Nastrój: <b>{mood != null ? MOODS[mood].label : "—"}</b>
          </div>
          <div>
            Sesja: <b>{session ? session.name : "—"}</b>
          </div>
          <div>
            Bias:{" "}
            <b>
              {biasList.length
                ? biasList.map((p, i) => {
                    const b = doc.bias_levels[p].bias;
                    return (
                      <span key={p}>
                        {i ? ", " : ""}
                        {p} <span className={b === "long" ? "pos" : b === "short" ? "neg" : ""}>{b === "long" ? "Long" : b === "short" ? "Short" : "Neutral"}</span>
                      </span>
                    );
                  })
                : "—"}
            </b>
          </div>
          <div>
            Limit:{" "}
            <b>
              {effectiveTradeLimit(doc)} trans. · {risk.toFixed(2)}% · stop −{stop}%
            </b>
            {isLimitLowered(doc) ? (
              <>
                {" "}
                <span className="tag soon">obniżony</span>
              </>
            ) : null}
          </div>
          {doc?.plan_sentence ? <div style={{ color: "var(--fg)", borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 2 }}>{doc.plan_sentence}</div> : null}
          {promiseRule ? (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 2 }}>
              <span className="wrn">Obietnica: </span>
              <b>{promiseRule}</b>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function HeatRow({ label, cells }) {
  return (
    <>
      <span>{label}</span>
      {cells.map((c) => (
        <i
          key={c.dateIso}
          className={[c.kind === "fut" ? "fut" : "", c.kind === "now" ? "now" : "", c.level ? `l${c.level}` : ""].filter(Boolean).join(" ")}
          title={`${c.dateIso}${c.level ? "" : c.kind === "past" ? " · niezamknięty" : ""}`}
        />
      ))}
    </>
  );
}
