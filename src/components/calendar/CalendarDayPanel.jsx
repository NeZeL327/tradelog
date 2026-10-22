import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowUpRight, X } from "lucide-react";
import DayNotesBubble from "@/components/DayNotesBubble";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  AsideHeading,
  DayFindings,
  JournalPreview,
  ReviewAside,
  buildTagFindings,
  sessionDisciplineMetric,
  sessionRows,
  tagEntries,
  tradeCountLabel,
} from "@/components/DayReview";
import { dateOfKey, winRate } from "@/lib/calendarAggregates";
import { directionLabel, getTradeMoneyRisk, getTradeRealizedPL, tradeRealizedR } from "@/lib/utils";
import { formatTradeClock } from "@/lib/userSettings";
import { MICRO, capFirst, formatR, glowOf, percent, toneOf } from "@/components/calendar/calendarUi";
import NoteMarkdownView from "@/components/NoteMarkdownView";

const byClock = (a, b) => String(formatTradeClock(a, "entry") || a.open_time || "").localeCompare(String(formatTradeClock(b, "entry") || b.open_time || ""));

function MiniStat({ label, value, color, hint }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-ds-line bg-ds-s2 px-3 py-2.5">
      <p className={`truncate ${MICRO}`}>{label}</p>
      <div className="mt-1.5 truncate text-[15px] font-medium tabular-nums" style={{ color: color || "var(--ds-text)" }}>{value}</div>
      {hint ? <p className="mt-1 truncate text-[10.5px] text-ds-text3">{hint}</p> : null}
    </div>
  );
}

function reviewItems({ trades, pnl, plText, t, accounts, onOpenTrade }) {
  return trades.map((trade) => {
    const r = tradeRealizedR(trade);
    const risk = getTradeMoneyRisk(trade);
    const firstTag = tagEntries([trade])[0];
    const account = accounts.find((item) => String(item.id) === String(trade.account_id));
    return {
      id: trade.id,
      title: `${trade.symbol || "—"} · ${directionLabel(trade.direction, t)}`,
      badge: firstTag?.tag,
      badgeKind: firstTag?.kind,
      rows: [
        { label: plText ? "Wynik" : "Result", value: pnl.formatTrade(trade), color: toneOf(getTradeRealizedPL(trade)) },
        r != null ? { label: "R", value: formatR(r), color: toneOf(r) } : null,
        risk ? { label: plText ? "Ryzyko" : "Risk", value: pnl.formatAmount(risk) } : null,
        { label: plText ? "Wejście → wyjście" : "Entry → exit", value: `${trade.entry_price ?? "—"} → ${trade.exit_price ?? "—"}` },
        trade.session ? { label: plText ? "Sesja" : "Session", value: trade.session } : null,
        account?.name ? { label: t("account") || "Account", value: account.name } : null,
        { label: plText ? "Godzina" : "Time", value: formatTradeClock(trade, "entry") || "—" },
      ].filter(Boolean),
      onOpen: () => onOpenTrade(trade),
      openLabel: plText ? "Otwórz transakcję" : "Open trade",
    };
  });
}

function DayPanelBody({ dayKey, bucket, pnl, fmt, plText, locale, t, accounts, onOpenTrade, onClose, onOpenDashboard }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesFocusId, setNotesFocusId] = useState(null);
  const trades = [...(bucket?.trades || [])].sort(byClock);
  const has = trades.length > 0;
  const value = fmt.value(bucket);
  const sessions = sessionRows(trades, getTradeRealizedPL);
  const discipline = sessionDisciplineMetric(trades, plText);
  const notes = trades.map((trade) => ({ id: trade.id, symbol: trade.symbol, notes: String(trade.notes || "").trim() })).filter((row) => row.notes);
  const emptyText = plText ? "Brak transakcji tego dnia." : "No trades this day.";
  const dayTags = tagEntries(trades);
  const noteSections = trades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol || "—",
    direction: directionLabel(trade.direction, t),
    time: formatTradeClock(trade, "entry") || "—",
    result: fmt.trade(trade),
    resultColor: toneOf(getTradeRealizedPL(trade)),
    notes: String(trade.notes || "").trim(),
    trade,
  }));

  useEffect(() => {
    setNotesOpen(false);
    setNotesFocusId(null);
  }, [dayKey]);

  const openNotes = (id = null) => {
    setNotesFocusId(id);
    setNotesOpen(true);
  };

  const review = (
    <DayFindings
      summaryTitle={plText ? "Podsumowanie sesji" : "Session summary"}
      summary={has
        ? [
          `${tradeCountLabel(trades.length, plText)}: ${bucket.wins}W · ${bucket.losses}L, ${pnl.formatTrades(trades)}.`,
          sessions.length ? `${plText ? "Sesje" : "Sessions"}: ${sessions.map((row) => `${row.name} (${row.count})`).join(", ")}.` : "",
        ].filter(Boolean).join(" ")
        : emptyText}
      tagsTitle={plText ? "Wnioski" : "Findings"}
      findings={buildTagFindings(trades, pnl, plText)}
      findingsTitle={plText ? "Transakcje dnia" : "Day trades"}
      items={reviewItems({ trades, pnl, plText, t, accounts, onOpenTrade })}
      emptyText={emptyText}
    />
  );

  const journal = (
    <div className="space-y-5">
      <JournalPreview
        rows={trades}
        onOpenTrade={onOpenTrade}
        describe={(trade) => ({
          title: trade.symbol || "—",
          meta: [directionLabel(trade.direction, t), formatTradeClock(trade, "entry")].filter(Boolean).join(" • "),
          result: fmt.trade(trade),
          resultColor: toneOf(getTradeRealizedPL(trade)),
        })}
        emptyText={emptyText}
        noShotsText={plText ? "Brak zrzutów ekranu dla tych transakcji." : "No screenshots for these trades."}
        shotLabel={plText ? "Zrzut ekranu" : "Screenshot"}
        onReadNote={(trade) => openNotes(trade.id)}
        readMoreLabel={t("readMore")}
      />
      {notes.map((row) => (
        <div key={row.id}>
          <AsideHeading>{row.symbol || "—"}</AsideHeading>
          <NoteMarkdownView className="mt-1.5 text-[12px] leading-[18px]" value={row.notes} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-ds-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-ds-text3">{capFirst(format(dateOfKey(dayKey), "EEEE, d MMMM yyyy", { locale }))}</p>
            <p className="mt-1.5 text-[26px] font-medium leading-none tabular-nums" style={{ color: toneOf(value), textShadow: glowOf(value) }}>
              {fmt.text(bucket)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={plText ? "Zamknij panel dnia" : "Close day panel"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {has ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label={plText ? "Transakcje" : "Trades"} value={String(trades.length)} hint={`${bucket.wins}W · ${bucket.losses}L`} />
            <MiniStat label="Win rate" value={percent(winRate(bucket))} />
            <MiniStat label="Net R" value={bucket.rCount ? formatR(bucket.r) : "—"} color={bucket.rCount ? toneOf(bucket.r) : undefined} />
            <MiniStat label={discipline.label} value={discipline.value} color={discipline.color} hint={discipline.hint} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onOpenDashboard}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-ds-line px-3 text-[12px] font-medium text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
        >
          {plText ? "Otwórz w Dashboard" : "Open in Dashboard"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReviewAside
          key={dayKey}
          tabs={[
            { id: "review", label: plText ? "Przegląd dnia" : "Day review", content: review },
            { id: "journal", label: plText ? "Dziennik" : "Journal", content: journal },
          ]}
        />
      </div>
      <DayNotesBubble
        open={notesOpen}
        onOpenChange={setNotesOpen}
        title={t("daySummaryTitle")}
        dateLabel={capFirst(format(dateOfKey(dayKey), "d MMMM yyyy", { locale }))}
        countLabel={has ? tradeCountLabel(trades.length, plText) : ""}
        sections={noteSections}
        scoreLabel={plText ? "Wynik dnia" : "Day result"}
        scoreValue={has ? `${bucket.wins}W · ${bucket.losses}L` : ""}
        tags={dayTags}
        onOpenTrade={onOpenTrade}
        focusId={notesFocusId}
      />
    </div>
  );
}

// inline: right column at ≥1280; otherwise a right-side drawer (Esc / overlay close it).
export default function CalendarDayPanel({ inline, open, ...props }) {
  if (inline) {
    if (!open) return null;
    return (
      <aside
        aria-label={props.plText ? "Panel dnia" : "Day panel"}
        className="cal-panel sticky top-4 flex max-h-[calc(100dvh-var(--ds-chrome,146px)-16px)] min-h-[420px] flex-col overflow-hidden rounded-[16px] border border-ds-frame bg-ds-glass shadow-ds-pop backdrop-blur-xl"
      >
        <DayPanelBody {...props} />
      </aside>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) props.onClose(); }}>
      <SheetContent
        side="right"
        onCloseAutoFocus={(event) => {
          const cell = document.querySelector('[role="grid"] [tabindex="0"]');
          if (!cell) return;
          event.preventDefault();
          cell.focus();
        }}
        className="cal-drawer flex w-[min(420px,100vw)] flex-col gap-0 p-0 text-ds-text sm:max-w-[420px] [&>button.absolute]:hidden">
        <SheetTitle className="sr-only">{props.plText ? "Panel dnia" : "Day panel"}</SheetTitle>
        <SheetDescription className="sr-only">{props.dayKey}</SheetDescription>
        {open ? <DayPanelBody {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}
