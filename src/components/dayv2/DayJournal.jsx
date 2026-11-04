// Zakładka "Dziennik dni": podsumowanie miesiąca, kalendarz, filtry, karty dni (tylko odczyt transakcji).
import { useMemo, useState } from "react";
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DAY_TAGS, MOODS, curvePoints, fmtMoney, fmtPf, fmtR, journalDays, monthSummary } from "@/lib/dayFlow";
import { SESSION_WINDOWS, selectedSessionIds } from "@/lib/daySessions";
import { tradeMistakes } from "@/lib/calendarAggregates";
import { DayCurve, ScoreRing, toneColor } from "./parts";
import { TradeTable } from "./StepImport";

const FILTERS = [
  ["all", "Wszystkie"],
  ["win", "Na plus"],
  ["loss", "Na minus"],
  ["err", "Z błędami"],
  ["low", "Dyscyplina < 70%"],
];
const BAD_TAGS = new Set(DAY_TAGS.filter((t) => !t.good).map((t) => t.label));
const isGoodTag = (label) => DAY_TAGS.find((t) => t.label === label)?.good;
const dateOf = (iso) => new Date(`${iso}T12:00:00`);

function hasErrors(day) {
  return day.tags.some((t) => BAD_TAGS.has(t)) || day.views.some((v) => tradeMistakes(v.trade).length);
}

export default function DayJournal({ trades, plans, accountId, monthIso, onMonth, todayIso, strategies, liveScores, onOpenDay }) {
  const [filter, setFilter] = useState("all");
  const [expandAll, setExpandAll] = useState(false);
  const [open, setOpen] = useState({});
  const [selected, setSelected] = useState(null);

  const days = useMemo(() => {
    const list = journalDays({ trades, plans, accountId, monthIso, todayIso });
    return list.map((d) => ({ ...d, score: d.score ?? liveScores?.[d.dateIso] ?? null }));
  }, [trades, plans, accountId, monthIso, todayIso, liveScores]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.dateIso, d])), [days]);
  const sum = useMemo(() => monthSummary(days), [days]);

  const monthDate = dateOf(monthIso);
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfMonth(monthDate);
    const out = [];
    for (let cur = start; cur <= end; cur = addDays(cur, 7)) {
      out.push(Array.from({ length: 7 }, (_, i) => format(addDays(cur, i), "yyyy-MM-dd")));
    }
    return out;
  }, [monthIso]);

  const list = days.filter((d) => {
    const net = d.stats.net;
    if (filter === "win") return d.views.length && net > 0;
    if (filter === "loss") return d.views.length && net < 0;
    if (filter === "err") return hasErrors(d);
    if (filter === "low") return d.score != null && d.score < 70;
    return true;
  });

  const jump = (iso) => {
    setSelected(iso);
    setFilter("all");
    requestAnimationFrame(() => {
      const el = document.getElementById(`day-${iso}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1400);
    });
  };

  const prefix = monthIso.slice(0, 7);
  const monthTitle = format(monthDate, "LLLL yyyy", { locale: pl });
  const moveMonth = (delta) => {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1);
    onMonth(format(d, "yyyy-MM-dd"));
  };

  return (
    <div>
      <div className="jtop">
        <h2>
          <button type="button" className="navb" aria-label="Poprzedni miesiąc" onClick={() => moveMonth(-1)}>
            <ChevronLeft className="ico" />
          </button>
          {monthTitle}
          <button type="button" className="navb" aria-label="Następny miesiąc" onClick={() => moveMonth(1)}>
            <ChevronRight className="ico" />
          </button>
        </h2>
        <span style={{ fontSize: 12.5, color: "var(--mute)" }}>Kliknij dzień w kalendarzu, żeby przejść do jego karty</span>
      </div>

      <div className="jsum">
        <div>
          <span>Netto w miesiącu</span>
          <b className={sum.net >= 0 ? "pos" : "neg"}>{sum.days ? fmtMoney(sum.net) : "—"}</b>
          <small>{sum.rCount ? fmtR(sum.r) : "—"}</small>
        </div>
        <div>
          <span>Dni handlowe</span>
          <b>{sum.days}</b>
          <small>
            <span className="pos">{sum.green} na plus</span> · <span className="neg">{sum.red} na minus</span>
          </small>
        </div>
        <div>
          <span>Win rate</span>
          <b>{sum.wr == null ? "—" : `${sum.wr}%`}</b>
          <small>
            {sum.w} W · {sum.l} L
          </small>
        </div>
        <div>
          <span>Profit factor</span>
          <b>{fmtPf(sum.pf)}</b>
          <small>prowizje {fmtMoney(sum.fee)}</small>
        </div>
        <div>
          <span>Najlepszy / najgorszy</span>
          <b className="pos">{sum.best == null ? "—" : fmtMoney(sum.best)}</b>
          <small className="neg">{sum.worst == null ? "—" : fmtMoney(sum.worst)}</small>
        </div>
        <div>
          <span>Śr. dyscyplina</span>
          <b style={{ color: sum.avgScore == null ? undefined : toneColor(sum.avgScore) }}>{sum.avgScore == null ? "—" : `${sum.avgScore}%`}</b>
          <small>z zamkniętych dni</small>
        </div>
      </div>

      <div className="mcal">
        <div className="mgrid">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
            <span key={d} className="wd">
              {d}
            </span>
          ))}
          <span className="wd wk">Tydzień</span>
          {weeks.map((week, w) => {
            let wsum = 0;
            let wn = 0;
            let wd = 0;
            const cells = week.map((iso, i) => {
              const inMonth = iso.startsWith(prefix);
              const day = inMonth ? byDate.get(iso) : null;
              const n = Number(iso.slice(8));
              if (day && day.views.length) {
                wsum += day.stats.net;
                wn += day.stats.n;
                wd += 1;
                const net = day.stats.net;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cd ${net >= 0 ? "w" : "l"}${iso === todayIso ? " t" : ""}${selected === iso ? " sel" : ""}`}
                    title={`${format(dateOf(iso), "EEEE, d MMMM", { locale: pl })}: ${fmtMoney(net)}`}
                    onClick={() => jump(iso)}
                  >
                    <span className="n">{n}</span>
                    <span className="v">{fmtMoney(net)}</span>
                    <span className="c">
                      {day.stats.n} trans. · {day.stats.wr == null ? "—" : `${day.stats.wr}%`}
                    </span>
                  </button>
                );
              }
              if (day) {
                return (
                  <button key={iso} type="button" className={`cd${iso === todayIso ? " t" : ""}${selected === iso ? " sel" : ""}`} onClick={() => jump(iso)} title="Dzień z planem, bez transakcji">
                    <span className="n">{n}</span>
                    <span className="c">plan</span>
                  </button>
                );
              }
              return (
                <div key={iso} className={`cd${inMonth ? "" : " out"}${i >= 5 ? " we" : ""}${iso === todayIso ? " t" : ""}`}>
                  <span className="n">{inMonth ? n : ""}</span>
                </div>
              );
            });
            return [
              ...cells,
              <div key={`w${w}`} className="cwk">
                <span className="n">Tydz. {w + 1}</span>
                <span className={`v ${wsum > 0 ? "pos" : wsum < 0 ? "neg" : ""}`}>{wd ? fmtMoney(wsum) : "—"}</span>
                <span className="c">{wd ? `${wd} dni · ${wn} trans.` : ""}</span>
              </div>,
            ];
          })}
        </div>
      </div>

      <div className="fbar">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={`chip${filter === key ? " on" : ""}`} onClick={() => setFilter(key)} aria-pressed={filter === key}>
            {label}
          </button>
        ))}
        <span className="sp" />
        <span style={{ fontSize: 12, color: "var(--mute)" }}>Pokaż transakcje:</span>
        <button type="button" className={`chip${expandAll ? " on" : ""}`} onClick={() => setExpandAll((v) => !v)} aria-pressed={expandAll}>
          {expandAll ? "rozwinięte" : "zwinięte"}
        </button>
      </div>

      <div className="jlist">
        {list.length ? (
          list.map((d) => (
            <DayCardRow
              key={d.dateIso}
              day={d}
              todayIso={todayIso}
              strategies={strategies}
              expanded={expandAll || !!open[d.dateIso]}
              onToggle={() => setOpen((o) => ({ ...o, [d.dateIso]: !o[d.dateIso] }))}
              onOpenDay={onOpenDay}
            />
          ))
        ) : (
          <div className="empty">{days.length ? "Brak dni dla tego filtra." : "W tym miesiącu nie ma jeszcze dni z planem ani transakcji."}</div>
        )}
      </div>
    </div>
  );
}

function DayCardRow({ day, todayIso, strategies, expanded, onToggle, onOpenDay }) {
  const s = day.stats;
  const date = dateOf(day.dateIso);
  const mood = Number.isInteger(day.plan?.mood_v2?.level) ? MOODS[day.plan.mood_v2.level] : null;
  const ids = selectedSessionIds(day.plan);
  const sessionNames = SESSION_WINDOWS.filter((x) => ids.includes(x.id)).map((x) => x.name).join(" + ");
  const note = day.plan?.post_session?.went_well || day.plan?.post_session?.improve_next || "";
  const rule = day.plan?.promise?.tomorrow_rule || "";
  const isPast = day.dateIso < todayIso;
  return (
    <article className={`jday${day.today ? " today" : ""}`} id={`day-${day.dateIso}`}>
      <div className="jhead">
        <div className="dbox">
          <b>{format(date, "dd")}</b>
          <span>{format(date, "LLL", { locale: pl }).replace(".", "")}</span>
        </div>
        <div className="jtitle">
          <div className="dt" style={{ textTransform: "none" }}>
            <span style={{ textTransform: "capitalize" }}>{format(date, "EEEE, d MMMM", { locale: pl })}</span>
            {day.today ? <span className="tag auto">dziś</span> : null}
            {!day.closed && (day.today || day.plan) ? <span className="tag soon">niezamknięty</span> : null}
          </div>
          <div className="meta">
            <span>
              {ids.length > 1 ? "Sesje" : "Sesja"} <i>{sessionNames || "—"}</i>
            </span>
            <span>
              <i>{s.n}</i> trans.
            </span>
            <span>
              WR <i>{s.wr == null ? "—" : `${s.wr}%`}</i>
            </span>
            <span>{mood ? <>Nastrój <i style={{ color: mood.color }}>{mood.label}</i></> : "Brak nastroju"}</span>
          </div>
        </div>
        <div className="jright">
          <div className="jnet">
            <b className={s.net >= 0 ? "pos" : "neg"}>{s.n ? fmtMoney(s.net) : "$0"}</b>
            <span>{s.rCount ? fmtR(s.r) : "—"}</span>
          </div>
          <div className="jring">
            <ScoreRing score={day.score} size={40} stroke={4} fontSize={11} label={day.score == null ? "—" : String(day.score)} />
            DYSC.
          </div>
          {day.today || (!day.closed && isPast) ? (
            <button type="button" className={`btn sm${day.today ? " pri" : ""}`} onClick={() => onOpenDay(day.dateIso)}>
              Otwórz dzień
            </button>
          ) : null}
        </div>
      </div>
      {s.n ? (
        <div className="jmid">
          <div className="jchart">
            <div className="lab">Krzywa dnia</div>
            <DayCurve points={curvePoints(day.views)} width={420} height={120} small />
          </div>
          <div className="jst">
            <div>
              <span>Brutto</span>
              <b className={s.gross >= 0 ? "pos" : "neg"}>{fmtMoney(s.gross)}</b>
            </div>
            <div>
              <span>Prowizje</span>
              <b>{fmtMoney(s.fee)}</b>
            </div>
            <div>
              <span>Profit factor</span>
              <b>{fmtPf(s.pf)}</b>
            </div>
            <div>
              <span>Wygrane</span>
              <b className="pos">{s.w}</b>
            </div>
            <div>
              <span>Przegrane</span>
              <b className="neg">{s.l}</b>
            </div>
            <div>
              <span>Śr. dyscyplina</span>
              <b>{day.avgRating == null ? "—" : `${day.avgRating.toFixed(1)} / 5`}</b>
            </div>
          </div>
        </div>
      ) : null}
      {expanded && s.n ? (
        <div className="jtr tw">
          <TradeTable views={day.views} strategies={strategies} editable={false} />
        </div>
      ) : null}
      {note || rule || day.tags.length ? (
        <div className="jfoot">
          <div className="txt">
            {note ? (
              <>
                <span>Wniosek</span>
                {note}
              </>
            ) : null}
            {rule ? (
              <>
                <span style={{ marginTop: note ? 6 : 0 }}>Zasada na jutro</span>
                {rule}
              </>
            ) : null}
          </div>
          <div className="tg">
            {day.tags.map((t) => (
              <span key={t} className={`chip on${isGoodTag(t) ? " good" : ""}`}>
                <i />
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {s.n ? (
        <div className="jtoggle">
          <button type="button" onClick={onToggle} aria-expanded={expanded}>
            <ChevronDown className="ico" style={{ width: 15, height: 15, transform: `rotate(${expanded ? 180 : 0}deg)` }} />
            {expanded ? "Ukryj transakcje" : `Pokaż transakcje (${s.n})`}
          </button>
        </div>
      ) : null}
    </article>
  );
}
