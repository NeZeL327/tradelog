// Krok 2 — Handel: liczniki, ostrzeżenia, zasady AUTO, notatki z godziną.
import { useState } from "react";
import { X } from "lucide-react";
import { QUICK_NOTES, fmtMoney, fmtR } from "@/lib/dayFlow";
import { durationLabel, hhmmOf, nowInWarsaw, warsawMinutesOf } from "@/lib/daySessions";
import { Check } from "./parts";

export function noteTime(note, dateIso) {
  const at = note?.created_at ? new Date(note.created_at) : null;
  if (!at || Number.isNaN(at.getTime())) return "—";
  return hhmmOf(warsawMinutesOf(at, dateIso || nowInWarsaw(at).dateIso));
}

export function notesChrono(doc) {
  const list = Array.isArray(doc?.session_notes) ? doc.session_notes : [];
  return [...list].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

export function NoteInput({ onAdd, big = false, autoFocus = false }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue("");
  };
  return (
    <div className="nadd">
      <input
        className="inp"
        value={value}
        autoFocus={autoFocus}
        placeholder={big ? "Szybka notatka i Enter" : "Co widzisz? np. Sweep Asia low, czekam na MSS…"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="Nowa notatka"
      />
      {big ? null : (
        <button type="button" className="btn" onClick={submit}>
          Dodaj
        </button>
      )}
    </div>
  );
}

export default function StepTrade({ doc, dateIso, isToday, nowMin, stats, views, limit, stopMoney, session, checks, onAddNote, onRemoveNote, onGo }) {
  const notes = notesChrono(doc);
  const lastLoss = views.length && (views[views.length - 1].net ?? 0) < 0;
  const used = Math.max(0, -stats.net);
  let sessionSub = "Wybierz sesję w planie";
  let sessionPct = 0;
  if (session) {
    if (!isToday) sessionSub = session.label;
    else if (nowMin < session.from) sessionSub = `Otwarcie za ${durationLabel(session.from - nowMin)}`;
    else if (nowMin < session.to) sessionSub = `Do końca ${durationLabel(session.to - nowMin)}`;
    else sessionSub = "Sesja zamknięta";
    sessionPct = isToday ? Math.max(0, Math.min(1, (nowMin - session.from) / (session.to - session.from))) : 1;
  }
  return (
    <section className="dz-col" aria-label="Handel">
      <div className="livegrid">
        <div className="card meter">
          <div className="lab">Transakcje</div>
          <div className="big">
            {stats.n} / {limit}
          </div>
          <div className="sub">{stats.n >= limit ? "Limit osiągnięty" : `Zostało ${limit - stats.n}`}</div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, (stats.n / limit) * 100)}%`, background: stats.n >= limit ? "var(--warn)" : "var(--accent)" }} />
          </div>
        </div>
        <div className="card meter">
          <div className="lab">Wynik dnia</div>
          <div className="big">
            <span className={stats.net >= 0 ? "pos" : "neg"}>{fmtMoney(stats.net)}</span>
          </div>
          <div className="sub">
            {stats.rCount ? fmtR(stats.r) : "—"} · stop dzienny {stopMoney == null ? "—" : `−${fmtMoney(stopMoney, { sign: false })}`}
          </div>
          <div className="bar">
            <i style={{ width: `${stopMoney ? Math.min(100, (Math.abs(stats.net) / stopMoney) * 100) : 0}%`, background: stats.net >= 0 ? "var(--win)" : "var(--loss)" }} />
          </div>
        </div>
        <div className="card meter">
          <div className="lab">Sesja</div>
          <div className="big">{session ? session.name : "—"}</div>
          <div className="sub">{sessionSub}</div>
          <div className="bar">
            <i style={{ width: `${sessionPct * 100}%`, background: "var(--accent2)" }} />
          </div>
        </div>
      </div>

      {stats.n >= limit ? (
        <div className="alert" role="status">
          <span>
            <b>Limit transakcji osiągnięty.</b> Plan mówi: koniec na dziś. Dopisz notatkę i przejdź do importu.
          </span>
        </div>
      ) : lastLoss ? (
        <div className="alert" role="status">
          <span>
            <b>Ostatnia transakcja na minusie.</b> 15 minut przerwy, zanim otworzysz kolejną.
          </span>
        </div>
      ) : stopMoney && used >= stopMoney ? (
        <div className="alert" role="status">
          <span>
            <b>Stop dzienny osiągnięty.</b> Zamknij platformę na dziś.
          </span>
        </div>
      ) : null}

      <div className="card">
        <div className="ch">
          <h2>Zasady: w trakcie handlu</h2>
          <span className="h mono">
            {checks.filter((c) => c.ok).length} / {checks.length}
          </span>
        </div>
        <div className="chk">
          {checks.map((item) => (
            <Check key={item.key} item={item} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h2>Notatki z sesji</h2>
          <span className="h">Enter dodaje wpis z godziną</span>
        </div>
        <div className="notes">
          {notes.length ? (
            notes.map((n) => (
              <div className="note" key={n.id || n.created_at}>
                <time>{noteTime(n, dateIso)}</time>
                <span>{n.text}</span>
                <button type="button" className="xbtn" aria-label="Usuń notatkę" onClick={() => onRemoveNote(n)}>
                  <X className="ico" style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))
          ) : (
            <div className="muted-empty">Brak notatek. Zapisz, co widzisz na wykresie, choćby dwa słowa.</div>
          )}
        </div>
        <NoteInput onAdd={onAddNote} />
        <div className="qchips">
          {QUICK_NOTES.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => onAddNote(q)}>
              + {q}
            </button>
          ))}
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => onGo(0)}>
          Wróć do planu
        </button>
        <button type="button" className="btn pri" onClick={() => onGo(2)}>
          Koniec handlu, importuj transakcje
        </button>
      </div>
    </section>
  );
}
