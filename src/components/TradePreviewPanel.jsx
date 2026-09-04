import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
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
import { updateTrade } from "@/lib/localStorage";
import {
  loadTradeTagLists,
  saveTradeTagLists,
} from "@/lib/tradeTags";
import {
  cn,
  getTradeRealizedPL,
  tradeOutcomeDisplay,
  tradeStatusDisplay,
} from "@/lib/utils";
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
          className="!top-0 !bottom-0 !h-[100dvh] !max-h-[100dvh] !w-[min(100vw,52rem)] sm:!max-w-none p-0 gap-0 overflow-hidden flex flex-col bg-[hsl(var(--window-bg))] text-card-foreground border-l border-[hsl(var(--window-border))] shadow-[var(--window-shadow)] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">Trade Preview</SheetTitle>
          <SheetDescription className="sr-only">Podgląd szczegółów transakcji</SheetDescription>

          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold tracking-tight">Trade Preview</h2>
              <button
                type="button"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
                onClick={() => handleOpenChange(false)}
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!prevTrade}
                  onClick={() => goNeighbor(prevTrade)}
                  aria-label="Poprzednia transakcja"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[15px] font-semibold truncate">{trade?.symbol || "—"}</span>
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!nextTrade}
                  onClick={() => goNeighbor(nextTrade)}
                  aria-label="Następna transakcja"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <PreviewSideBadge direction={trade?.direction} t={t} />
                <PreviewChip tone="warning">{tradeStatusDisplay(trade?.status)}</PreviewChip>
                {trade?.outcome ? (
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
              </div>
              <button
                type="button"
                className="shrink-0 h-8 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/40 px-2.5 text-[12px] font-medium text-foreground hover:bg-white/5"
                onClick={() => setTab("chart")}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Replay
              </button>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Opened {opened}
              {closed ? ` • Closed ${closed}` : ""}
              {held ? ` • Held ${held}` : ""}
            </p>
          </div>

          {tab === "chart" ? (
            <div className="px-5 pb-1 flex items-baseline gap-2.5">
              <span className="text-[11px] text-muted-foreground">NET P&L</span>
              <span className={cn("text-lg font-bold tabular-nums", toneClass(plTone(netPl)))}>
                {netPl == null ? "—" : formatSigned(netPl)}
              </span>
              {roi !== null && (
                <span className={cn("text-[11px] tabular-nums", toneClass(plTone(roi)))}>
                  ROI {formatSigned(roi)}%
                </span>
              )}
            </div>
          ) : (
            <div className="px-5 pb-3">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">NET P&L</p>
                <p className={cn("mt-1.5 text-[34px] leading-none font-bold tabular-nums tracking-tight", toneClass(plTone(netPl)))}>
                  {netPl == null ? "—" : formatSigned(netPl)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roi !== null && (
                    <span className={cn("text-[11px] px-2.5 py-1 rounded-full bg-profit/10 border border-profit/20", toneClass(plTone(roi)))}>
                      ROI {formatSigned(roi)}%
                    </span>
                  )}
                  {gross !== null && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                      Gross {formatSigned(gross)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="px-5 pb-2">
            <TabStrip tabs={TABS} value={tab} onChange={setTab} />
          </div>

          <div className={cn(
            "flex-1 min-h-0 px-5 py-1",
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
              <div className="flex-1 min-h-0">
                <TradePreviewChart trade={trade} />
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

          <div className="mt-auto shrink-0 border-t border-white/[0.06] px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-5 bg-transparent border-border/80 text-muted-foreground hover:text-foreground"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
            {onEdit && (
              <Button
                type="button"
                className="h-10 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
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
