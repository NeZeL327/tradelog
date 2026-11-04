// Krok 1 — Plan: obietnica z wczoraj, nastrój, limity, sesja, bias i poziomy, newsy, przygotowanie, plan w jednym zdaniu.
import { useState } from "react";
import { Check as CheckIcon, Pin, Plus, X } from "lucide-react";
import {
  LIMIT_BOUNDS,
  MOODS,
  PREP_RULES,
  baseTradeLimit,
  dailyStopPercent,
  isLimitLowered,
  moodLevel,
  prepChecks,
  riskPercent,
} from "@/lib/dayFlow";
import { SESSION_PRESETS, durationLabel, hhmmOf, legacyMappingSession, selectedSessionIds, sessionState, sessionsSummary } from "@/lib/daySessions";
import { Check, MoodFace } from "./parts";

const STATE_LABEL = { open: "otwarta", soon: "za chwilę", off: "zamknięta" };

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function PromiseCard({ promise, acknowledged, onAck }) {
  if (!promise?.rule) return null;
  return (
    <div className={`card promise${acknowledged ? " ok" : ""}`}>
      <span className="pi">
        <Pin className="ico" />
      </span>
      <div className="pt">
        <span>Wczoraj obiecałeś</span>
        <b>{promise.rule}</b>
        <small>{acknowledged ? "Przypięte do dzisiejszego planu. Wieczorem zapytam, czy się udało." : `Z dnia ${promise.dateLabel} · zasada na jutro`}</small>
      </div>
      {acknowledged ? (
        <button type="button" className="btn sm" onClick={() => onAck(false)}>
          Odepnij
        </button>
      ) : (
        <button type="button" className="btn pri" onClick={() => onAck(true)}>
          Pamiętam, dziś też
        </button>
      )}
    </div>
  );
}

function LimitRule({ label, value, display, onStep }) {
  return (
    <div className="rule">
      <div className="lab">{label}</div>
      <div className="v">
        <button type="button" className="mini" onClick={() => onStep(-1)} aria-label={`${label}: mniej`}>
          −
        </button>
        <b>{display(value)}</b>
        <button type="button" className="mini" onClick={() => onStep(1)} aria-label={`${label}: więcej`}>
          +
        </button>
      </div>
    </div>
  );
}

const pctOf = (m) => `${((Math.max(0, Math.min(1440, m)) / 1440) * 100).toFixed(2)}%`;

function SessionPicker({ doc, patch, sessions, nowMin, isToday }) {
  const ids = selectedSessionIds(doc);
  const setIds = (next) => {
    const ordered = sessions.map((s) => s.id).filter((id) => next.includes(id));
    patch((p) => ({ ...p, sessions: ordered, mapping_session: legacyMappingSession(ordered) }));
  };
  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const sum = sessionsSummary(sessions, ids);
  return (
    <div className="card">
      <div className="ch">
        <h2>Które sesje grasz?</h2>
        <span className="h">Możesz wybrać kilka · godziny polskie · kill zone wg ICT</span>
      </div>
      <div className="sess" role="group" aria-label="Sesje">
        {sessions.map((s) => {
          const state = isToday ? sessionState(s, nowMin) : "off";
          const on = ids.includes(s.id);
          return (
            <button key={s.id} type="button" aria-pressed={on} className={`ses${on ? " on" : ""}`} style={{ "--sc": s.color }} onClick={() => toggle(s.id)}>
              <div className="top">
                <span className="nm">
                  <span className="sck" />
                  {s.name}
                </span>
                {isToday ? <span className={`tag ${state}`}>{STATE_LABEL[state]}</span> : null}
              </div>
              <span className="tm">{s.label}</span>
              <span className="mtl" aria-hidden="true">
                <i className="mb" style={{ left: pctOf(s.from), width: pctOf(s.to - s.from) }} />
                {s.killZone ? <i className="mk" style={{ left: pctOf(s.killZone.from), width: pctOf(s.killZone.to - s.killZone.from) }} /> : null}
                {isToday ? <i className="mn" style={{ left: pctOf(nowMin) }} /> : null}
              </span>
              <span className="kz">{s.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="presets">
        {SESSION_PRESETS.map((p) => {
          const on = p.ids.length === ids.length && p.ids.every((id) => ids.includes(id));
          return (
            <button key={p.label} type="button" aria-pressed={on} className={`chip${on ? " on" : ""}`} onClick={() => setIds(p.ids)}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="ssum">
        {ids.length ? (
          <>
            Grasz: <b>{sum.names}</b> · {durationLabel(sum.minutes)} na rynku · {sum.killZones} kill zone
            {sum.gaps.length ? ` · przerwa ${sum.gaps.map((g) => `${hhmmOf(g.from)}–${hhmmOf(g.to)}`).join(", ")}` : ""}
          </>
        ) : (
          "Wybierz jedną lub kilka sesji. Możesz łączyć, np. Londyn + NY AM."
        )}
      </div>
    </div>
  );
}

function NewsEditor({ news, onChange }) {
  const [draft, setDraft] = useState({ time: "", cur: "USD", name: "", impact: "high" });
  const add = () => {
    if (!/^\d{1,2}:\d{2}$/.test(draft.time) || !draft.name.trim()) return;
    const time = draft.time.padStart(5, "0");
    onChange([...news, { time, cur: draft.cur.trim().toUpperCase().slice(0, 4) || "USD", name: draft.name.trim().slice(0, 60), impact: draft.impact }]);
    setDraft({ ...draft, time: "", name: "" });
  };
  const sorted = [...news].map((n, i) => ({ ...n, i })).sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div className="card">
      <div className="ch">
        <h2>Newsy dnia</h2>
        <span className="h">Czerwone blokują wejścia 15 min przed i po · godziny polskie</span>
      </div>
      {sorted.length ? (
        <div className="newslist">
          {sorted.map((n) => (
            <div className="newsitem" key={n.i}>
              <span className="dm" style={{ background: n.impact === "high" ? "var(--loss)" : "var(--orange)" }} />
              <span className="mono">{n.time}</span>
              <b style={{ fontWeight: 600 }}>{n.cur}</b>
              <span style={{ flex: 1, minWidth: 0 }}>{n.name}</span>
              <button type="button" className="xbtn" aria-label={`Usuń ${n.name}`} onClick={() => onChange(news.filter((_, idx) => idx !== n.i))}>
                <X className="ico" style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted-empty">Dodaj ważne publikacje z kalendarza ekonomicznego — pojawią się na osi dnia.</div>
      )}
      <div className="newsrow" style={{ marginTop: 10 }}>
        <input className="inp" inputMode="numeric" placeholder="14:30" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-label="Godzina newsa" />
        <input className="inp" placeholder="USD" value={draft.cur} onChange={(e) => setDraft({ ...draft, cur: e.target.value })} aria-label="Waluta" />
        <input
          className="inp"
          placeholder="np. CPI m/m"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Nazwa publikacji"
        />
        <div className="seg">
          <button type="button" className={draft.impact === "high" ? "on S" : ""} onClick={() => setDraft({ ...draft, impact: "high" })}>
            Wysoki
          </button>
          <button type="button" className={draft.impact === "med" ? "on N" : ""} onClick={() => setDraft({ ...draft, impact: "med" })}>
            Średni
          </button>
        </div>
        <button type="button" className="btn sm" onClick={add}>
          <Plus className="ico" />
          Dodaj
        </button>
      </div>
    </div>
  );
}

export default function StepPlan({ doc, patch, pairs, onPairsChange, sessions, nowMin, isToday, promise, missing, locked, onGoTrade }) {
  const mood = moodLevel(doc);
  const prep = prepChecks(doc);
  const prepDone = prep.filter((c) => c.ok).length;
  const [newPair, setNewPair] = useState("");
  const [editPairs, setEditPairs] = useState(false);

  const setParam = (key, value) => patch((p) => ({ ...p, parameters: { ...(p.parameters || {}), [key]: value } }));
  const setBias = (pair, partial) =>
    patch((p) => ({ ...p, bias_levels: { ...(p.bias_levels || {}), [pair]: { ...(p.bias_levels?.[pair] || {}), ...partial } } }));

  const addPair = () => {
    const sym = newPair.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 12);
    if (!sym || pairs.includes(sym)) return;
    onPairsChange([...pairs, sym]);
    setNewPair("");
  };

  return (
    <section className="dz-col" aria-label="Plan">
      <PromiseCard
        promise={promise}
        acknowledged={!!doc?.promise?.acknowledged}
        onAck={(value) => patch((p) => ({ ...p, promise: { ...(p.promise || {}), acknowledged: value } }))}
      />
      <div className="two">
        <div className="card">
          <div className="ch">
            <h2>Jak się dziś czujesz?</h2>
            <span className="h">Przy „Źle” plan obniża limit transakcji do 1</span>
          </div>
          <div className="mood" role="radiogroup" aria-label="Nastrój">
            {MOODS.map((m) => (
              <button
                key={m.level}
                type="button"
                role="radio"
                aria-checked={mood === m.level}
                className={mood === m.level ? "on" : ""}
                style={{ "--mc": m.color }}
                onClick={() => patch((p) => ({ ...p, mood_v2: { ...(p.mood_v2 || {}), level: m.level } }))}
              >
                <MoodFace level={m.level} />
                {m.label}
              </button>
            ))}
          </div>
          <input
            className="inp moodnote"
            placeholder="Co wpływa na Twój nastrój? np. mało snu, długa trasa"
            value={doc?.mood_v2?.note || ""}
            onChange={(e) => patch((p) => ({ ...p, mood_v2: { ...(p.mood_v2 || {}), note: e.target.value } }))}
          />
        </div>
        <div className="card">
          <div className="ch">
            <h2>Limity na dziś</h2>
            <span className="h">Sprawdzane automatycznie</span>
          </div>
          <div className="rules">
            <LimitRule
              label="Max transakcji"
              value={baseTradeLimit(doc)}
              display={(v) => (
                <>
                  {v}
                  {isLimitLowered(doc) ? <span className="tag soon" style={{ marginLeft: 6, fontSize: 9.5 }}>obniżony do 1</span> : null}
                </>
              )}
              onStep={(d) => setParam("trade_limit", clamp(baseTradeLimit(doc) + d * LIMIT_BOUNDS.trade_limit.step, LIMIT_BOUNDS.trade_limit))}
            />
            <LimitRule
              label="Ryzyko / trade"
              value={riskPercent(doc)}
              display={(v) => `${v.toFixed(2)}%`}
              onStep={(d) => setParam("max_risk_percent", clamp(riskPercent(doc) + d * LIMIT_BOUNDS.max_risk_percent.step, LIMIT_BOUNDS.max_risk_percent))}
            />
            <LimitRule
              label="Stop dzienny"
              value={dailyStopPercent(doc)}
              display={(v) => `−${v.toFixed(1)}%`}
              onStep={(d) =>
                patch((p) => ({
                  ...p,
                  limits: {
                    ...(p.limits || {}),
                    daily_stop_percent: clamp(dailyStopPercent(p) + d * LIMIT_BOUNDS.daily_stop_percent.step, LIMIT_BOUNDS.daily_stop_percent),
                  },
                }))
              }
            />
          </div>
        </div>
      </div>

      <SessionPicker doc={doc} patch={patch} sessions={sessions} nowMin={nowMin} isToday={isToday} />

      <div className="card">
        <div className="ch">
          <h2>Bias i poziomy</h2>
          <span className="h">
            Kierunek z H4/D1, poziomy do obserwacji ·{" "}
            <button type="button" className="todaybtn" onClick={() => setEditPairs((v) => !v)}>
              {editPairs ? "gotowe" : "zmień pary"}
            </button>
          </span>
        </div>
        <div className="bias">
          {pairs.map((pair) => {
            const b = doc?.bias_levels?.[pair] || {};
            return (
              <div className="brow" key={pair}>
                <span className="sym" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {editPairs ? (
                    <button type="button" className="xbtn" aria-label={`Usuń ${pair}`} onClick={() => onPairsChange(pairs.filter((x) => x !== pair))}>
                      <X className="ico" style={{ width: 13, height: 13 }} />
                    </button>
                  ) : null}
                  {pair}
                </span>
                <div className="seg" role="group" aria-label={`Bias ${pair}`}>
                  {[
                    ["long", "L", "Long"],
                    ["short", "S", "Short"],
                    ["neutral", "N", "Neutral"],
                  ].map(([key, cls, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={b.bias === key}
                      className={`${cls}${b.bias === key ? " on" : ""}`}
                      onClick={() => setBias(pair, { bias: b.bias === key ? null : key })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input className="inp" value={b.levels || ""} placeholder="Poziomy, np. PDH, Asia high" onChange={(e) => setBias(pair, { levels: e.target.value })} aria-label={`Poziomy ${pair}`} />
              </div>
            );
          })}
        </div>
        {editPairs ? (
          <div className="pairedit">
            <input className="inp" placeholder="np. USDJPY" value={newPair} onChange={(e) => setNewPair(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPair()} aria-label="Nowa para" />
            <button type="button" className="btn sm" onClick={addPair}>
              <Plus className="ico" />
              Dodaj parę
            </button>
            <span className="h" style={{ fontSize: 12, color: "var(--mute)" }}>Lista par zapisuje się w ustawieniach konta.</span>
          </div>
        ) : null}
      </div>

      <NewsEditor news={Array.isArray(doc?.news_manual) ? doc.news_manual : []} onChange={(list) => patch((p) => ({ ...p, news_manual: list }))} />

      <div className="two">
        <div className="card">
          <div className="ch">
            <h2>Zasady: przygotowanie</h2>
            <span className="h mono">
              {prepDone} / {PREP_RULES.length}
            </span>
          </div>
          <div className="chkbar">
            <i style={{ width: `${(prepDone / PREP_RULES.length) * 100}%` }} />
          </div>
          <div className="chk">
            {prep.map((item) => (
              <Check
                key={item.key}
                item={item}
                onToggle={() =>
                  patch((p) => ({
                    ...p,
                    rules_manual: {
                      ...(p.rules_manual || {}),
                      prep: { ...(p.rules_manual?.prep || {}), [item.key]: !item.ok },
                    },
                  }))
                }
              />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="ch">
            <h2>Plan w jednym zdaniu</h2>
            <span className="h">Co musi się stać, żebyś wszedł?</span>
          </div>
          <textarea
            className="inp"
            value={doc?.plan_sentence || ""}
            placeholder="np. Czekam na sweep Asia low na EURUSD, potem MSS na M5 i wejście z FVG. Bez wejścia przed 08:00."
            onChange={(e) => patch((p) => ({ ...p, plan_sentence: e.target.value }))}
            aria-label="Plan w jednym zdaniu"
          />
        </div>
      </div>

      <div className="actions">
        <span className="why">{missing.length ? `Brakuje: ${missing.join(", ")}` : "Wszystko gotowe."}</span>
        <button type="button" className="btn pri" disabled={missing.length > 0 || locked} onClick={onGoTrade}>
          <CheckIcon className="ico" />
          Plan gotowy, zaczynam handel
        </button>
      </div>
    </section>
  );
}
