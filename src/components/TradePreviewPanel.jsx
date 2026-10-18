import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { toast } from "sonner";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/common/ImageViewer";
import TradePreviewChart from "@/components/TradePreviewChart";
import TradePreviewPhotos from "@/components/TradePreviewPhotos";
import { PlanVsActual, TradeLevelsDiagram } from "@/components/TradePlanCard";
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
import { updateTrade } from "@/lib/localStorage";
import {
  loadTradeTagLists,
  saveTradeTagLists,
} from "@/lib/tradeTags";
import {
  cn,
  directionLabel,
  getTradeMoneyRisk,
  getTradeRealizedPL,
  tradeOutcomeDisplay,
  tradeRealizedR,
  tradeStatusDisplay,
} from "@/lib/utils";
import { formatChartPrice, tradePriceLevels } from "@/lib/tradePreviewMarketData";
import { getDateFormat } from "@/lib/userSettings";
import {
  TABS,
  formatClosedLabel,
  formatHeldDuration,
  formatOpenedLabel,
  formatSigned,
  getGrossPl,
  loadVisibleStatsFields,
  plTone,
  saveVisibleStatsFields,
  toNumber,
} from "@/lib/tradePreviewStats";

export default function TradePreviewPanel({
  open,
  onOpenChange,
  trade,
  trades = [],
  onSelectTrade,
  onEdit,
  onPatched,
  strategy,
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const pnl = usePnlDisplay();
  const dateFormat = getDateFormat();
  const [tab, setTab] = useState("stats");
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState(() => loadVisibleStatsFields(user?.id));
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [emotionDraft, setEmotionDraft] = useState(() => emptyEmotionDraft(null));
  const [tagLists, setTagLists] = useState(() => loadTradeTagLists());
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef({ notes: false, emotions: false, tags: false });
  const tradeId = trade?.id;

  useEffect(() => {
    setVisibleIds(loadVisibleStatsFields(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!open || !tradeId) return;
    setTab("stats");
    setTagLists(loadTradeTagLists());
    dirtyRef.current = { notes: false, emotions: false, tags: false };
    setNotesDraft(trade?.notes || "");
    setEmotionDraft(emptyEmotionDraft(trade));
  }, [open, tradeId]);

  const persistPatch = useCallback(async (patch) => {
    if (!user?.id || !trade?.id) return;
    setSaving(true);
    try {
      await updateTrade(user.id, trade.id, patch);
      onPatched?.(patch);
    } catch (err) {
      console.error("Trade preview save:", err);
      toast.error("Nie udało się zapisać zmian");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id, trade?.id, onPatched]);

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
    if (jobs.length) {
      try {
        await Promise.all(jobs);
      } catch {
        return false;
      }
    }
    return true;
  }, [persistPatch, notesDraft, emotionDraft]);

  const handleOpenChange = async (next) => {
    if (!next) {
      await flushDirty();
    }
    onOpenChange?.(next);
  };

  const tradeIndex = useMemo(
    () => trades.findIndex((item) => String(item.id) === String(trade?.id)),
    [trades, trade?.id]
  );
  const prevTrade = tradeIndex > 0 ? trades[tradeIndex - 1] : null;
  const nextTrade = tradeIndex >= 0 && tradeIndex < trades.length - 1 ? trades[tradeIndex + 1] : null;

  const netPl = getTradeRealizedPL(trade);
  const roi = toNumber(trade?.profit_loss_percent);
  const gross = getGrossPl(trade);
  const held = formatHeldDuration(trade);
  const opened = formatOpenedLabel(trade, dateFormat);
  const closed = formatClosedLabel(trade, dateFormat);
  const realizedR = trade ? tradeRealizedR(trade) : null;
  const moneyRisk = trade ? getTradeMoneyRisk(trade) : null;
  const levels = trade ? tradePriceLevels(trade) : null;
  const outcomeKey = String(trade?.outcome || "").toLowerCase();
  const outcomeTone = outcomeKey === "win" ? "profit" : outcomeKey === "loss" ? "loss" : "neutral";
  const kpis = [
    {
      label: "Result",
      value: netPl == null ? "—" : pnl.formatTrade(trade),
      tone: plTone(netPl),
      sub: [realizedR != null ? `${formatSigned(realizedR)}R` : null, gross !== null ? `Gross ${formatSigned(gross)}` : null, roi !== null ? `ROI ${formatSigned(roi)}%` : null].filter(Boolean).join(" · "),
    },
    { label: "Duration", value: held || "—", sub: closed ? `Closed ${closed}` : "" },
    { label: "Status", value: trade?.outcome ? tradeOutcomeDisplay(trade.outcome) : tradeStatusDisplay(trade?.status) || "—", tone: outcomeTone, sub: tradeStatusDisplay(trade?.status) || "" },
    { label: "Risk", value: moneyRisk ? pnl.formatAmount(moneyRisk) : "—", sub: "" },
  ];
  const planRows = [
    { label: "Setup", value: strategy?.name || trade?.setup || null },
    { label: "Direction", value: trade?.direction ? directionLabel(trade.direction, t) : null },
    { label: "Entry", value: levels?.entry != null ? formatChartPrice(levels.entry) : null },
    { label: "Planned stop", value: levels?.sl != null ? formatChartPrice(levels.sl) : null, color: "var(--ds-neg)" },
    { label: "Actual exit", value: levels?.exit != null ? formatChartPrice(levels.exit) : null },
    { label: "Risk", value: moneyRisk ? pnl.formatAmount(moneyRisk) : null },
  ];

  const goNeighbor = async (neighbor) => {
    if (!neighbor || !onSelectTrade) return;
    await flushDirty();
    onSelectTrade(neighbor);
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
    dirtyRef.current.tags = false;
    await persistPatch(partial);
  };

  const persistLists = (partial) => {
    setTagLists((prev) => {
      const next = { ...prev, ...partial };
      void saveTradeTagLists({ ...next, userId: user?.id });
      return next;
    });
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && (fieldsOpen || viewerOpen)) return;
          handleOpenChange(next);
        }}
      >
        <SheetContent
          side="right"
          className="trade-preview-panel p-0 gap-0 overflow-hidden flex flex-col text-ds-text [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">Trade Preview</SheetTitle>
          <SheetDescription className="sr-only">Podgląd szczegółów transakcji</SheetDescription>

          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] text-ds-text3 transition-colors duration-200 hover:bg-ds-s3 hover:text-ds-text disabled:opacity-30"
                  disabled={!prevTrade}
                  onClick={() => goNeighbor(prevTrade)}
                  aria-label="Poprzednia transakcja"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] text-ds-text3 transition-colors duration-200 hover:bg-ds-s3 hover:text-ds-text disabled:opacity-30"
                  disabled={!nextTrade}
                  onClick={() => goNeighbor(nextTrade)}
                  aria-label="Następna transakcja"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 inline-flex items-center gap-1.5 rounded-[10px] border border-ds-line bg-ds-s2 px-3 text-[12px] font-medium text-ds-text2 transition-colors duration-200 hover:bg-ds-s3 hover:text-ds-text"
                  onClick={() => setTab("chart")}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Replay
                </button>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] text-ds-text3 transition-colors duration-200 hover:bg-ds-s3 hover:text-ds-text"
                  onClick={() => handleOpenChange(false)}
                  aria-label="Zamknij"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h2 className="mt-3 truncate text-[24px] font-medium leading-tight tracking-[-0.01em] text-ds-text">
              {trade?.symbol || "—"}{trade?.direction ? ` ${directionLabel(trade.direction, t)}` : ""}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ds-text2">
              <span>{opened}</span>
              {tradeIndex >= 0 ? <><span className="text-ds-text3">•</span><span>Trade #{tradeIndex + 1}</span></> : null}
              <span className="text-ds-text3">•</span>
              <PreviewSideBadge direction={trade?.direction} t={t} />
              <PreviewChip tone="warning">{tradeStatusDisplay(trade?.status)}</PreviewChip>
              {trade?.outcome ? <PreviewChip tone={outcomeTone}>{tradeOutcomeDisplay(trade.outcome)}</PreviewChip> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[16px] border border-ds-line bg-ds-s2 sm:grid-cols-4">
              {kpis.map((kpi, index) => (
                <div key={kpi.label} className={cn("min-w-0 px-4 py-3.5", index % 2 ? "border-l border-ds-line" : "", index >= 2 ? "border-t border-ds-line sm:border-t-0" : "", index === 2 ? "sm:border-l" : "")}>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3">{kpi.label}</p>
                  <p className={cn("mt-2 truncate text-[22px] font-medium leading-none tabular-nums", kpi.tone ? toneClass(kpi.tone) : "text-ds-text")}>{kpi.value}</p>
                  <p className="mt-1.5 min-h-[15px] truncate text-[11px] text-ds-text3">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 pb-2">
            <TabStrip tabs={TABS} value={tab} onChange={setTab} variant="line" />
          </div>

          <div className={cn(
            "flex-1 min-h-0 px-6 py-1",
            tab === "chart" ? "overflow-hidden flex flex-col" : "overflow-y-auto"
          )}>
            {tab === "stats" && (
              <StatsTab
                trade={trade}
                visibleIds={visibleIds}
                onOpenSettings={() => setFieldsOpen(true)}
                t={t}
              />
            )}
            {tab === "strategy" && <StrategyTab trade={trade} strategy={strategy} />}
            {tab === "tags" && (
              <TagsTab
                trade={trade}
                tagLists={tagLists}
                onListsChange={persistLists}
                onChange={patchTags}
              />
            )}
            {tab === "executions" && <ExecutionsTab trade={trade} />}
            {tab === "chart" && (
              <div className="flex-1 min-h-0 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-h-[280px] sm:min-h-0">
                  <TradePreviewChart trade={trade} />
                </div>
                <div className="min-h-0 space-y-3 overflow-y-auto pb-3">
                  <TradeLevelsDiagram levels={levels} title="Price levels" />
                  <PlanVsActual title="Plan vs actual" rows={planRows} />
                </div>
              </div>
            )}
            {tab === "photos" && (
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
            {tab === "emotion" && (
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
            {tab === "notes" && (
              <NotesTab
                notesDraft={notesDraft}
                onDraftChange={(value) => {
                  dirtyRef.current.notes = true;
                  setNotesDraft(value);
                }}
                onSave={saveNotes}
                saving={saving}
              />
            )}
            {tab === "running_pl" && <RunningPlTab trade={trade} />}
          </div>

          <div className="mt-auto shrink-0 border-t border-ds-line px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-5"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
            {onEdit && (
              <Button
                type="button"
                className="h-10 flex-1"
                onClick={() => onEdit(trade)}
              >
                Go to trade details
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
