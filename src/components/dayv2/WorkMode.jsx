// Tryb w pracy: pełny ekran (głównie telefon) — zegar, news, 4 kafelki, szybkie notatki. Esc zamyka.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Smartphone, X } from "lucide-react";
import { QUICK_NOTES, fmtMoney, newsWarning, nextNews, workClock } from "@/lib/dayFlow";
import { NoteInput, noteTime, notesChrono } from "./StepTrade";
import { toneColor } from "./parts";

export default function WorkMode({ open, onClose, doc, dateIso, nowMin, sessions, news, stats, limit, stopMoney, discipline, onAddNote }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const clock = workClock({ minutes: nowMin, sessions });
  const warn = newsWarning(news, nowMin);
  const upcoming = nextNews(news, nowMin);
  const last = notesChrono(doc).slice(-3).reverse();
  const toStop = stopMoney == null ? null : Math.max(0, stopMoney + Math.min(0, stats.net));

  return createPortal(
    <div className="dz">
      <div className="dz-work" role="dialog" aria-modal="true" aria-label="Tryb w pracy">
        <div className="wbox">
          <div className="wtop">
            <b>
              <Smartphone className="ico" />
              Tryb w pracy
            </b>
            <button type="button" className="btn sm" onClick={onClose}>
              <X className="ico" />
              Wyjdź
            </button>
          </div>
          <div className="wclock">
            <div className="big mono">{clock.big}</div>
            <div className="sub">{clock.sub}</div>
          </div>
          {warn ? (
            <div className="wnews">
              <AlertTriangle className="ico" style={{ color: "var(--loss)" }} />
              <span>
                <b>
                  {warn.time} {warn.cur} {warn.name}
                </b>{" "}
                · bez nowych pozycji 15 min przed i po
              </span>
            </div>
          ) : upcoming ? (
            <div className="wnews calm">
              <AlertTriangle className="ico" style={{ color: "var(--mute)" }} />
              <span>
                Następny news:{" "}
                <b>
                  {upcoming.time} {upcoming.cur} {upcoming.name}
                </b>
              </span>
            </div>
          ) : null}
          <div className="wtiles">
            <div>
              <span>Wynik</span>
              <b className={stats.net >= 0 ? "pos" : "neg"}>{fmtMoney(stats.net)}</b>
            </div>
            <div>
              <span>Transakcje</span>
              <b style={stats.n >= limit ? { color: "var(--warn)" } : undefined}>
                {stats.n} / {limit}
              </b>
            </div>
            <div>
              <span>Do stopu dziennego</span>
              <b>{toStop == null ? "—" : fmtMoney(toStop, { sign: false })}</b>
            </div>
            <div>
              <span>Dyscyplina</span>
              <b style={{ color: toneColor(discipline.score) }}>{discipline.score}%</b>
            </div>
          </div>
          <div className="wnote">
            <NoteInput onAdd={onAddNote} big autoFocus={false} />
            <div className="wq">
              {QUICK_NOTES.slice(0, 4).map((q) => (
                <button key={q} type="button" onClick={() => onAddNote(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          {last.length ? (
            <div className="wlog">
              {last.map((n) => (
                <div key={n.id || n.created_at}>
                  <time>{noteTime(n, dateIso)}</time>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
