// Krok 4 — Przegląd: kafelki, krzywa dnia, refleksja, obietnica, ocena, tagi, wnioski, zamknięcie dnia.
import { useRef } from "react";
import { toast } from "sonner";
import { Lock, Pin } from "lucide-react";
import { DAY_TAGS, curvePoints, fmtMoney, fmtPf, fmtR } from "@/lib/dayFlow";
import { Check, DayCurve, ScoreRing, toneColor } from "./parts";

export function DayShareCard({ cardRef, dateLabel, sessionName, stats, accountLabel, streak, rule, discipline, views }) {
  return (
    <div className="dcard" ref={cardRef}>
      <div>
        <div className="brand">
          <i />
          AiKeepTrade
        </div>
        <div className="dd">
          {dateLabel}
          {sessionName ? ` · ${sessionName}` : ""}
        </div>
        <div className={`dn ${stats.net >= 0 ? "pos" : "neg"}`}>{fmtMoney(stats.net)}</div>
        <div className="dr">
          {stats.rCount ? fmtR(stats.r) : "—"} · {accountLabel}
        </div>
        <div className="dchips">
          <span>{stats.n} trans.</span>
          <span>WR {stats.wr == null ? "—" : `${stats.wr}%`}</span>
          <span>PF {fmtPf(stats.pf)}</span>
          <span>Seria {streak} dni</span>
        </div>
        {rule ? (
          <div className="drule">
            <b>Zasada na jutro</b>
            {rule}
          </div>
        ) : null}
      </div>
      <div className="dright">
        <div className="dscore">
          <ScoreRing score={discipline.score} size={52} stroke={4} fontSize={11} label={String(discipline.score)} />
          <div>
            <b>Dyscyplina {discipline.score}%</b>
            {discipline.done} z {discipline.total} zasad
          </div>
        </div>
        <DayCurve points={curvePoints(views)} width={420} height={200} colors={{ win: "#78d66a", loss: "#f2646a", mute: "#7f8aa3" }} />
      </div>
    </div>
  );
}

export default function StepReview({ doc, patch, views, stats, discipline, promise, closed, dirty, cardProps, onClose, onSaveChanges, onGo }) {
  const cardRef = useRef(null);
  const tags = Array.isArray(doc?.day_tags) ? doc.day_tags : [];
  const post = doc?.post_session || {};
  const kept = doc?.promise?.kept_yesterday;
  const setPost = (key, value) => patch((p) => ({ ...p, post_session: { ...(p.post_session || {}), [key]: value } }));
  const refl = discipline.refl.list.map((c) => (c.auto ? { ...c, bad: false } : c));

  const savePng = async () => {
    if (!cardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `aikeeptrade-${doc?.date || "dzien"}.png`;
      a.click();
      toast.success("Zapisano kartę dnia.");
    } catch {
      toast.error("Nie udało się zapisać obrazu.");
    }
  };

  const copySummary = async () => {
    const text = [
      `AiKeepTrade · ${cardProps.dateLabel}`,
      `Wynik: ${fmtMoney(stats.net)} (${stats.rCount ? fmtR(stats.r) : "—"})`,
      `Transakcje: ${stats.n} · WR ${stats.wr == null ? "—" : stats.wr + "%"} · PF ${fmtPf(stats.pf)}`,
      `Dyscyplina: ${discipline.score}%`,
      `Zasada na jutro: ${doc?.promise?.tomorrow_rule || "—"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Skopiowano podsumowanie.");
    } catch {
      toast.error("Nie udało się skopiować.");
    }
  };

  return (
    <section className="dz-col" aria-label="Przegląd">
      {closed ? (
        <div className="done-banner">
          <Lock className="ico" style={{ width: 26, height: 26, color: "var(--win)" }} />
          <div>
            <b>Dzień zamknięty i wliczony do serii.</b>
            <div style={{ fontSize: 13, color: "var(--mute)" }}>
              Wynik za dyscyplinę {discipline.score}%. Zasada na jutro: {doc?.promise?.tomorrow_rule || "—"}
            </div>
          </div>
        </div>
      ) : null}
      {closed ? (
        <div>
          <DayShareCard cardRef={cardRef} {...cardProps} stats={stats} discipline={discipline} views={views} rule={doc?.promise?.tomorrow_rule} />
          <div className="dcbtns">
            <button type="button" className="btn sm" onClick={savePng}>
              Zapisz jako obraz
            </button>
            <button type="button" className="btn sm" onClick={copySummary}>
              Kopiuj podsumowanie
            </button>
          </div>
        </div>
      ) : null}

      <div className="kpis">
        <div className="kpi">
          <div className="lab">Wynik netto</div>
          <div className="big">
            <span className={stats.net >= 0 ? "pos" : "neg"}>{fmtMoney(stats.net)}</span>
          </div>
          <div className="sub">
            {stats.rCount ? fmtR(stats.r) : "—"} · prowizje {fmtMoney(stats.fee)}
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Transakcje</div>
          <div className="big">{stats.n}</div>
          <div className="sub">
            {stats.w} wygrane · {stats.l} przegrane
          </div>
        </div>
        <div className="kpi">
          <div className="lab">Win rate</div>
          <div className="big">{stats.wr == null ? "—" : `${stats.wr}%`}</div>
          <div className="sub">profit factor {fmtPf(stats.pf)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Wynik za dyscyplinę</div>
          <div className="big">
            <span style={{ color: toneColor(discipline.score) }}>{discipline.score}%</span>
          </div>
          <div className="sub">zasady z 3 etapów</div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h2>Krzywa dnia</h2>
          <span className="h">Skumulowany wynik netto po każdej transakcji</span>
        </div>
        {views.length ? <DayCurve points={curvePoints(views)} /> : <div className="muted-empty">Brak transakcji w tym dniu.</div>}
      </div>

      <div className="card">
        <div className="ch">
          <h2>Zasady: refleksja</h2>
          <span className="h mono">
            {discipline.refl.done} / {discipline.refl.total}
          </span>
        </div>
        <div className="chk">
          {refl.map((item) => (
            <Check
              key={item.key}
              item={item}
              onToggle={() => patch((p) => ({ ...p, rules_manual: { ...(p.rules_manual || {}), screens: !p.rules_manual?.screens } }))}
            />
          ))}
        </div>
      </div>

      {promise?.rule ? (
        <div className={`card promise${kept === true ? " ok" : ""}`}>
          <span className="pi">
            <Pin className="ico" />
          </span>
          <div className="pt">
            <span>{kept === true ? "Obietnica dotrzymana" : "Obietnica z wczoraj"}</span>
            <b>{promise.rule}</b>
            <small>Dotrzymałeś dziś tej zasady?</small>
          </div>
          <div className="yn">
            <button type="button" className={`btn sm y${kept === true ? " on" : ""}`} onClick={() => patch((p) => ({ ...p, promise: { ...(p.promise || {}), kept_yesterday: true } }))}>
              Tak
            </button>
            <button type="button" className={`btn sm n${kept === false ? " on" : ""}`} onClick={() => patch((p) => ({ ...p, promise: { ...(p.promise || {}), kept_yesterday: false } }))}>
              Nie
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="ch">
          <h2>Jak trzymałeś się planu?</h2>
          <span className="h">1 – złamałem plan, 5 – w 100%</span>
        </div>
        <div className="stars" role="radiogroup" aria-label="Ocena trzymania się planu">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={doc?.plan_adherence === n} className={doc?.plan_adherence === n ? "on" : ""} onClick={() => patch((p) => ({ ...p, plan_adherence: n }))}>
              {n}
            </button>
          ))}
        </div>
        <div className="lab" style={{ margin: "16px 0 8px" }}>
          Co się wydarzyło
        </div>
        <div className="qchips" style={{ marginTop: 0 }}>
          {DAY_TAGS.map((t) => {
            const on = tags.includes(t.label);
            return (
              <button
                key={t.label}
                type="button"
                aria-pressed={on}
                className={`chip${t.good ? " good" : ""}${on ? " on" : ""}`}
                onClick={() => patch((p) => {
                  const cur = Array.isArray(p.day_tags) ? p.day_tags : [];
                  return { ...p, day_tags: cur.includes(t.label) ? cur.filter((x) => x !== t.label) : [...cur, t.label] };
                })}
              >
                <i />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h2>Wnioski</h2>
          <span className="h">Wystarczy po jednym zdaniu</span>
        </div>
        <div className="refl">
          <label>
            Co zrobiłem dobrze
            <textarea className="inp" value={post.went_well || ""} placeholder="np. Poczekałem na sweep zamiast wchodzić od razu." onChange={(e) => setPost("went_well", e.target.value)} />
          </label>
          <label>
            Co poprawić
            <textarea className="inp" value={post.improve_next || ""} placeholder="np. Drugi trade bez potwierdzenia na M5." onChange={(e) => setPost("improve_next", e.target.value)} />
          </label>
        </div>
        <label className="fl" style={{ marginTop: 12 }}>
          Jedna zasada na jutro
          <input
            className="inp"
            value={doc?.promise?.tomorrow_rule || ""}
            placeholder="np. Po stracie 15 minut przerwy, zanim otworzę wykres."
            onChange={(e) => patch((p) => ({ ...p, promise: { ...(p.promise || {}), tomorrow_rule: e.target.value } }))}
          />
        </label>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => onGo(2)}>
          Wróć do importu
        </button>
        {closed ? (
          <button type="button" className="btn ok" disabled={!dirty} onClick={onSaveChanges}>
            {dirty ? "Zapisz zmiany" : "Zapisane"}
          </button>
        ) : (
          <button type="button" className="btn ok" onClick={onClose}>
            <Lock className="ico" />
            Zamknij dzień
          </button>
        )}
      </div>
    </section>
  );
}
