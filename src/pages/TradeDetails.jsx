import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Info, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/common/ImageViewer";
import TradePreviewChart from "@/components/TradePreviewChart";
import TradePreviewPhotos from "@/components/TradePreviewPhotos";
import {
  EmotionTab,
  ExecutionsTab,
  NotesTab,
  PreviewChip,
  PreviewSideBadge,
  RunningPlTab,
  StatsFieldsModal,
  StatsTab,
  StrategyTab,
  TabStrip,
  TagsTab,
  emptyEmotionDraft,
  toneClass,
} from "@/components/tradePreviewTabs";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/lib/AuthContext";
import { getStrategies, getTradingAccounts, getTrades, updateTrade } from "@/lib/localStorage";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { loadTradeTagLists, saveTradeTagLists } from "@/lib/tradeTags";
import {
  cn,
  directionBadgeClass,
  directionLabel,
  getTradeRealizedPL,
  tradeOutcomeBadgeClass,
  tradeOutcomeDisplay,
  tradeStatusDisplay,
} from "@/lib/utils";
import { formatTradeClock, formatTradeDate, getDateFormat } from "@/lib/userSettings";
import {
  formatClosedLabel,
  formatHeldDuration,
  formatOpenedLabel,
  loadVisibleStatsFields,
  plTone,
  saveVisibleStatsFields,
} from "@/lib/tradePreviewStats";
import { isSameDay, isSameMonth, isSameWeek, parseISO } from "date-fns";
import { createPageUrl } from "@/utils";
import { loadLastTradeDetailsId, saveLastTradeDetailsId, tradeDetailsPath } from "@/lib/tradeDetailsNav";

const LEFT_TABS = [
  { id: "stats", label: "Stats" },
  { id: "strategy", label: "Strategy" },
  { id: "executions", label: "Executions" },
  { id: "photos", label: "Attachments" },
  { id: "emotion", label: "Emotion" },
];

const RIGHT_TABS = [
  { id: "chart", label: "Chart" },
  { id: "notes", label: "Notes" },
  { id: "running_pl", label: "Running P&L" },
];

function sameId(a, b) {
  return String(a) === String(b);
}

function tradeDateKey(item) {
  return String(item?.date || item?.close_date || "").slice(0, 10);
}

function tradeInRange(item, range, anchorKey) {
  if (range === "all") return true;
  const key = tradeDateKey(item);
  if (!key || !anchorKey) return false;
  const day = parseISO(key);
  const anchor = parseISO(anchorKey);
  if (Number.isNaN(day.getTime()) || Number.isNaN(anchor.getTime())) return false;
  if (range === "day") return isSameDay(day, anchor);
  if (range === "week") return isSameWeek(day, anchor, { weekStartsOn: 1 });
  if (range === "month") return isSameMonth(day, anchor);
  return true;
}

function loadJournalRange() {
  try {
    const value = localStorage.getItem("aikeep-trade-journal-range");
    if (["day", "week", "month", "all"].includes(value)) return value;
  } catch {
    /* ignore */
  }
  return "day";
}

function JournalTable({ trades, currentId, onSelect, t, dateFormat, showDate }) {
  const pnl = usePnlDisplay();
  if (!trades.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Brak transakcji w wybranym zakresie.
      </p>
    );
  }

  return (
    <div className="overflow-auto h-full min-h-0">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
            {showDate && <th className="py-1.5 pr-2 font-medium">Data</th>}
            <th className="py-1.5 pr-2 font-medium">Symbol</th>
            <th className="py-1.5 pr-2 font-medium">Side</th>
            <th className="py-1.5 pr-2 font-medium">Czas</th>
            <th className="py-1.5 pr-2 font-medium text-right">P&L</th>
            <th className="py-1.5 font-medium text-right">Wynik</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((item) => {
            const active = sameId(item.id, currentId);
            const pl = getTradeRealizedPL(item);
            return (
              <tr
                key={item.id}
                onClick={() => { if (!active) onSelect(item); }}
                className={cn(
                  "border-b border-border transition-colors",
                  active ? "bg-primary/10" : "cursor-pointer hover:bg-muted"
                )}
              >
                {showDate && (
                  <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">
                    {formatTradeDate(item.date, dateFormat) || tradeDateKey(item) || "—"}
                  </td>
                )}
                <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">{item.symbol || "—"}</td>
                <td className="py-1.5 pr-2">
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md border", directionBadgeClass(item.direction))}>
                    {directionLabel(item.direction, t) || "—"}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">
                  {formatTradeClock(item, "entry") || "—"}
                </td>
                <td className={cn("py-1.5 pr-2 text-right tabular-nums font-medium", toneClass(plTone(pl)))}>
                  {pl == null ? "—" : pnl.formatTrade(item)}
                </td>
                <td className="py-1.5 text-right">
                  {item.outcome ? (
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md border", tradeOutcomeBadgeClass(item.outcome))}>
                      {tradeOutcomeDisplay(item.outcome)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NotesDock({
  notesView,
  onNotesViewChange,
  notesDraft,
  onDraftChange,
  onSave,
  saving,
  compact,
  journalTrades,
  journalRange,
  onJournalRangeChange,
  currentId,
  onSelectTrade,
  t,
  dateFormat,
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="px-4 pt-2.5 pb-2 flex items-center gap-1.5 shrink-0">
        <p className="text-[13px] font-semibold">Notes</p>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onNotesViewChange("trade")}
          className={cn(
            "h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 border",
            notesView === "trade"
              ? "bg-muted text-foreground border-border"
              : "bg-transparent text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Trade note
        </button>
        <button
          type="button"
          onClick={() => onNotesViewChange("journal")}
          className={cn(
            "h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 border",
            notesView === "journal"
              ? "bg-muted text-foreground border-border"
              : "bg-transparent text-muted-foreground border-border hover:text-foreground"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Journal
        </button>
        <select
          value={journalRange}
          onChange={(e) => {
            onNotesViewChange("journal");
            onJournalRangeChange(e.target.value);
          }}
          className="h-8 rounded-lg border border-border bg-muted px-2 text-[12px] text-foreground"
          aria-label="Zakres Journal"
        >
          <option value="day">Dzień</option>
          <option value="week">Tydzień</option>
          <option value="month">Miesiąc</option>
          <option value="all">Wszystkie</option>
        </select>
      </div>
      <div className="px-4 pb-4">
        {notesView === "journal" ? (
          <JournalTable
            trades={journalTrades}
            currentId={currentId}
            onSelect={onSelectTrade}
            t={t}
            dateFormat={dateFormat}
            showDate={journalRange !== "day"}
          />
        ) : (
          <div>
            <NotesTab
              compact={compact}
              notesDraft={notesDraft}
              onDraftChange={onDraftChange}
              onSave={onSave}
              saving={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const MIN_CHART = 200;
const MIN_NOTES = 380;
const PANE_KEY = "aikeep-trade-pane-heights-v1";

function readPaneHeights() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANE_KEY) || "");
    if (Number.isFinite(parsed?.chart) && Number.isFinite(parsed?.notes)) {
      return {
        chart: Math.max(MIN_CHART, parsed.chart),
        notes: Math.max(MIN_NOTES, parsed.notes),
      };
    }
  } catch {
    /* ignore */
  }
  return { chart: 560, notes: 440 };
}

function usePaneHeights() {
  const [chartH, setChartH] = useState(() => readPaneHeights().chart);
  const [notesH, setNotesH] = useState(() => readPaneHeights().notes);
  const sizes = useRef({ chartH, notesH });
  sizes.current = { chartH, notesH };

  useEffect(() => {
    try {
      localStorage.setItem(PANE_KEY, JSON.stringify({ chart: Math.round(chartH), notes: Math.round(notesH) }));
    } catch {
      /* ignore */
    }
  }, [chartH, notesH]);

  const dragBy = useCallback((dy) => {
    const { chartH: chart, notesH: notes } = sizes.current;
    let nextChart = chart;
    let nextNotes = notes;
    if (dy >= 0) {
      const take = Math.min(dy, Math.max(0, notes - MIN_NOTES));
      nextChart = chart + dy;
      nextNotes = notes - take;
    } else {
      const up = -dy;
      const take = Math.min(up, Math.max(0, chart - MIN_CHART));
      nextNotes = notes + up;
      nextChart = chart - take;
    }
    sizes.current = { chartH: nextChart, notesH: nextNotes };
    setChartH(nextChart);
    setNotesH(nextNotes);
  }, []);

  return { chartH, notesH, dragBy };
}

const SIDE_KEY = "aikeep-trade-side-w";
const MIN_SIDE = 260;
const MAX_SIDE = 560;

function useSideWidth() {
  const [sideW, setSideW] = useState(() => {
    try {
      const n = Number(localStorage.getItem(SIDE_KEY));
      if (Number.isFinite(n)) return Math.min(MAX_SIDE, Math.max(MIN_SIDE, n));
    } catch {
      /* ignore */
    }
    return 320;
  });
  const widthRef = useRef(sideW);
  widthRef.current = sideW;

  useEffect(() => {
    try {
      localStorage.setItem(SIDE_KEY, String(Math.round(sideW)));
    } catch {
      /* ignore */
    }
  }, [sideW]);

  const dragX = useCallback((dx) => {
    const next = Math.min(MAX_SIDE, Math.max(MIN_SIDE, widthRef.current + dx));
    widthRef.current = next;
    setSideW(next);
  }, []);

  return { sideW, dragX };
}

function ColResizeHandle({ onDrag }) {
  const lastX = useRef(0);
  const onPointerDown = (event) => {
    event.preventDefault();
    lastX.current = event.clientX;
    const move = (ev) => {
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      if (dx) onDrag(dx);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Rozciągnij szerokość wykresu"
      onPointerDown={onPointerDown}
      className="mx-1 hidden w-3 shrink-0 cursor-col-resize items-center justify-center self-stretch xl:flex"
    >
      <div className="h-14 w-1.5 rounded-full bg-border hover:bg-primary/50" />
    </div>
  );
}

function RowResizeHandle({ onDrag }) {
  const lastY = useRef(0);

  const onPointerDown = (event) => {
    event.preventDefault();
    lastY.current = event.clientY;
    const move = (ev) => {
      const dy = ev.clientY - lastY.current;
      lastY.current = ev.clientY;
      if (dy) onDrag(dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Rozciągnij wykres i notatki"
      onPointerDown={onPointerDown}
      className="flex h-7 shrink-0 cursor-row-resize items-center justify-center"
    >
      <div className="h-1.5 w-14 rounded-full bg-border hover:bg-primary/50" />
    </div>
  );
}

function useWideLayout() {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

function enrichTrade(trade, accounts, strategies) {
  if (!trade) return null;
  const account = accounts.find((item) => sameId(item.id, trade.account_id));
  const strategy = strategies.find((item) => sameId(item.id, trade.strategy_id));
  return {
    ...trade,
    accountName: account?.name || trade.accountName || "",
    strategyName: strategy?.name || trade.strategyName || "",
  };
}

export default function TradeDetails() {
  const { tradeId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const tradeId = paramId || searchParams.get("id") || searchParams.get("tradeId");
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();
  const pnl = usePnlDisplay();
  const dateFormat = getDateFormat();

  const wide = useWideLayout();
  const { sideW, dragX } = useSideWidth();
  const { chartH, notesH, dragBy } = usePaneHeights();
  const [leftTab, setLeftTab] = useState("stats");
  const [rightTab, setRightTab] = useState("chart");
  const [notesView, setNotesView] = useState("trade");
  const [journalRange, setJournalRange] = useState(loadJournalRange);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState(() => loadVisibleStatsFields(user?.id));
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [emotionDraft, setEmotionDraft] = useState(() => emptyEmotionDraft(null));
  const [tagLists, setTagLists] = useState(() => loadTradeTagLists());
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef({ notes: false, emotions: false });

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ["trades", user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: Boolean(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user?.id),
    enabled: Boolean(user?.id),
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ["strategies", user?.id],
    queryFn: () => getStrategies(user?.id),
    enabled: Boolean(user?.id),
  });

  const contextIds = Array.isArray(location.state?.tradeIds)
    ? location.state.tradeIds.map(String)
    : null;

  const navTrades = useMemo(() => {
    if (contextIds?.length) {
      return contextIds
        .map((id) => trades.find((item) => sameId(item.id, id)))
        .filter(Boolean);
    }
    return trades;
  }, [contextIds, trades]);

  const rawTrade = useMemo(
    () => trades.find((item) => sameId(item.id, tradeId)) || null,
    [trades, tradeId]
  );
  const trade = useMemo(
    () => enrichTrade(rawTrade, accounts, strategies),
    [rawTrade, accounts, strategies]
  );
  const strategy = useMemo(
    () => strategies.find((item) => sameId(item.id, trade?.strategy_id)) || null,
    [strategies, trade?.strategy_id]
  );

  const tradeIndex = useMemo(
    () => navTrades.findIndex((item) => sameId(item.id, tradeId)),
    [navTrades, tradeId]
  );
  const prevTrade = tradeIndex > 0 ? navTrades[tradeIndex - 1] : null;
  const nextTrade = tradeIndex >= 0 && tradeIndex < navTrades.length - 1 ? navTrades[tradeIndex + 1] : null;

  const journalTrades = useMemo(() => {
    const anchor = tradeDateKey(trade);
    const list = trades.filter((item) => tradeInRange(item, journalRange, anchor));
    return [...list].sort((a, b) => {
      const dateCmp = tradeDateKey(b).localeCompare(tradeDateKey(a));
      if (dateCmp) return dateCmp;
      const timeA = formatTradeClock(a, "entry") || "";
      const timeB = formatTradeClock(b, "entry") || "";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return String(a.id).localeCompare(String(b.id));
    });
  }, [trade, trades, journalRange]);

  useEffect(() => {
    setVisibleIds(loadVisibleStatsFields(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!trade?.id) return;
    saveLastTradeDetailsId(trade.id);
    setTagLists(loadTradeTagLists());
    dirtyRef.current = { notes: false, emotions: false };
    setNotesDraft(trade.notes || "");
    setEmotionDraft(emptyEmotionDraft(trade));
  }, [trade?.id]);

  useEffect(() => {
    if (tradeId || isLoading || !user?.id) return;
    const last = loadLastTradeDetailsId();
    const match = last ? trades.find((item) => sameId(item.id, last)) : null;
    const target = match || trades[0];
    if (!target?.id) return;
    navigate(tradeDetailsPath(target.id), {
      replace: true,
      state: { tradeIds: trades.map((item) => String(item.id)) },
    });
  }, [tradeId, isLoading, trades, user?.id, navigate]);

  const persistPatch = useCallback(async (patch) => {
    if (!user?.id || !trade?.id) return;
    setSaving(true);
    try {
      await updateTrade(user.id, trade.id, patch);
      await queryClient.invalidateQueries({ queryKey: ["trades", user.id] });
    } catch (err) {
      console.error("Trade details save:", err);
      toast.error("Nie udało się zapisać zmian");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id, trade?.id, queryClient]);

  const flushDirty = useCallback(async () => {
    const jobs = [];
    if (dirtyRef.current.notes) {
      jobs.push(persistPatch({ notes: notesDraft }).then(() => { dirtyRef.current.notes = false; }));
    }
    if (dirtyRef.current.emotions) {
      jobs.push(persistPatch({
        emotions: emotionDraft.emotions,
        setup_confidence: emotionDraft.setup_confidence,
        setup_confidence_comment: emotionDraft.setup_confidence_comment,
      }).then(() => { dirtyRef.current.emotions = false; }));
    }
    if (!jobs.length) return true;
    try {
      await Promise.all(jobs);
      return true;
    } catch {
      return false;
    }
  }, [persistPatch, notesDraft, emotionDraft]);

  const goToTrade = async (neighbor) => {
    if (!neighbor?.id) return;
    await flushDirty();
    navigate(tradeDetailsPath(neighbor.id), {
      state: { tradeIds: contextIds || navTrades.map((item) => String(item.id)) },
    });
  };

  const saveNotes = async () => {
    dirtyRef.current.notes = false;
    await persistPatch({ notes: notesDraft });
    toast.success("Notatki zapisane");
  };

  const saveEmotions = async () => {
    dirtyRef.current.emotions = false;
    await persistPatch({
      emotions: emotionDraft.emotions,
      setup_confidence: emotionDraft.setup_confidence,
      setup_confidence_comment: emotionDraft.setup_confidence_comment,
    });
    toast.success("Emocje zapisane");
  };

  const patchTags = async (partial) => {
    await persistPatch(partial);
  };

  const persistLists = (partial) => {
    setTagLists((prev) => {
      const next = { ...prev, ...partial };
      void saveTradeTagLists({ ...next, userId: user?.id });
      return next;
    });
  };

  if (!user?.id || (isLoading && !trades.length)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-muted-foreground">
        Ładowanie transakcji…
      </div>
    );
  }

  if (!tradeId) {
    if (!trades.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <p className="text-sm text-muted-foreground">Brak transakcji do analizy.</p>
          <Button type="button" variant="outline" onClick={() => navigate(createPageUrl("Journal"))}>
            Przejdź do Dziennika
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-muted-foreground">
        Ładowanie transakcji…
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Nie znaleziono tej transakcji.</p>
        <Button type="button" variant="outline" onClick={() => navigate("/trade")}>
          Wybierz inną transakcję
        </Button>
      </div>
    );
  }

  const netPl = getTradeRealizedPL(trade);
  const held = formatHeldDuration(trade);
  const opened = formatOpenedLabel(trade, dateFormat);
  const closed = formatClosedLabel(trade, dateFormat);

  const notesDockProps = {
    notesView,
    onNotesViewChange: setNotesView,
    notesDraft,
    onDraftChange: (value) => {
      dirtyRef.current.notes = true;
      setNotesDraft(value);
    },
    onSave: saveNotes,
    saving,
    journalTrades,
    journalRange,
    onJournalRangeChange: (value) => {
      setJournalRange(value);
      try {
        localStorage.setItem("aikeep-trade-journal-range", value);
      } catch {
        /* ignore */
      }
    },
    currentId: trade.id,
    onSelectTrade: goToTrade,
    t,
    dateFormat,
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-card px-3 py-3 shadow-none">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={async () => {
              await flushDirty();
              navigate(createPageUrl("Journal"));
            }}
            aria-label="Wróć do Dziennika"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
            disabled={!prevTrade}
            onClick={() => goToTrade(prevTrade)}
            aria-label="Poprzednia transakcja"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[18px] font-semibold truncate">{trade.symbol || "—"}</span>
          <button
            type="button"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
            disabled={!nextTrade}
            onClick={() => goToTrade(nextTrade)}
            aria-label="Następna transakcja"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <PreviewSideBadge direction={trade.direction} t={t} />
          <PreviewChip tone="warning">{tradeStatusDisplay(trade.status)}</PreviewChip>
          {trade.outcome ? (
            <PreviewChip
              tone={
                String(trade.outcome).toLowerCase() === "win"
                  ? "profit"
                  : String(trade.outcome).toLowerCase() === "loss"
                    ? "loss"
                    : "neutral"
              }
            >
              {tradeOutcomeDisplay(trade.outcome)}
            </PreviewChip>
          ) : null}
          <span className="text-[12px] text-muted-foreground pl-1">
            {opened}
            {closed ? ` · ${closed}` : ""}
            {held ? ` · ${held}` : ""}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">P&L</p>
          <p className={cn("text-[22px] font-semibold tabular-nums leading-none", toneClass(plTone(netPl)))}>
            {netPl == null ? "—" : pnl.formatTrade(trade)}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <aside
          className="flex h-[min(42vh,26rem)] min-h-[16rem] w-full flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-none xl:sticky xl:top-0 xl:h-[calc(100dvh-5.5rem)] xl:shrink-0"
          style={wide ? { width: sideW } : undefined}
        >
          <TabStrip tabs={LEFT_TABS} value={leftTab} onChange={setLeftTab} variant="line" />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {leftTab === "stats" && (
              <>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground">Net P&L</p>
                    <p className={cn("mt-1 text-[32px] leading-none font-bold tabular-nums tracking-tight", toneClass(plTone(netPl)))}>
                      {netPl == null ? "—" : pnl.formatTrade(trade)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFieldsOpen(true)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Dostosuj widoczne pola"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <StatsTab
                  trade={trade}
                  visibleIds={visibleIds}
                  onOpenSettings={() => setFieldsOpen(true)}
                  t={t}
                  settingsInRow={false}
                />
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tags</p>
                  <TagsTab
                    trade={trade}
                    tagLists={tagLists}
                    onListsChange={persistLists}
                    onChange={patchTags}
                  />
                </div>
              </>
            )}
            {leftTab === "strategy" && <StrategyTab trade={trade} strategy={strategy} />}
            {leftTab === "executions" && <ExecutionsTab trade={trade} />}
            {leftTab === "photos" && (
              <TradePreviewPhotos
                trade={trade}
                userId={user?.id}
                persistPatch={persistPatch}
                onOpenImage={(src) => {
                  setViewerImage(src);
                  setViewerOpen(true);
                }}
              />
            )}
            {leftTab === "emotion" && (
              <EmotionTab
                trade={trade}
                emotionDraft={emotionDraft}
                onDraftChange={(next) => {
                  dirtyRef.current.emotions = true;
                  setEmotionDraft(next);
                }}
                onSave={saveEmotions}
                saving={saving}
              />
            )}
          </div>
        </aside>
        <ColResizeHandle onDrag={dragX} />
        <section className="flex min-w-0 flex-1 flex-col rounded-[12px] border border-border bg-card shadow-none">
          <TabStrip tabs={RIGHT_TABS} value={rightTab} onChange={setRightTab} variant="line" />

          {rightTab === "notes" ? (
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ minHeight: notesH }}>
              <NotesDock {...notesDockProps} compact={false} />
            </div>
          ) : (
            <>
              <div className="shrink-0 p-2" style={{ height: chartH }}>
                {rightTab === "chart" ? (
                  <TradePreviewChart key={trade.id} trade={trade} />
                ) : (
                  <div className="h-full overflow-y-auto">
                    <RunningPlTab trade={trade} />
                  </div>
                )}
              </div>
              <RowResizeHandle onDrag={dragBy} />
              <div className="shrink-0 border-t border-border" style={{ minHeight: notesH }}>
                <NotesDock {...notesDockProps} compact={false} />
              </div>
            </>
          )}
        </section>
      </div>

      <StatsFieldsModal
        open={fieldsOpen}
        onOpenChange={setFieldsOpen}
        selected={visibleIds}
        onSave={(ids) => {
          const next = saveVisibleStatsFields(user?.id, ids);
          setVisibleIds(next);
          setFieldsOpen(false);
        }}
      />

      <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />
    </div>
  );
}
