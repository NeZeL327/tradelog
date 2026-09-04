import { useEffect, useState } from "react";
import { Info, Settings2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmotionsPanelContent, normalizeEmotions } from "@/components/EmotionsPanel";
import EditableTagChips from "@/components/EditableTagChips";
import Sparkline from "@/components/Sparkline";
import {
  cn,
  directionLabel,
  getTradeRealizedPL,
  normalizeDirection,
} from "@/lib/utils";
import {
  DEFAULT_STATS_FIELD_IDS,
  STATS_FIELDS,
  buildExecutionRows,
  formatSigned,
  getPositionSize,
  getRunningPlPoints,
  getStatsCell,
  plTone,
} from "@/lib/tradePreviewStats";

export function toneClass(tone) {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-foreground";
}

function StatsSparkline({ points }) {
  if (!points || points.length < 2) return <span className="text-muted-foreground">—</span>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const w = 132;
  const h = 32;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    return [x, y];
  });
  const line = coords.map((c) => c.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = values[values.length - 1];
  const stroke = last >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))";
  const fill = last >= 0 ? "hsl(var(--profit) / 0.22)" : "hsl(var(--loss) / 0.22)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polygon fill={fill} points={area} />
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" points={line} />
    </svg>
  );
}

export function RatingStars({ value }) {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = n >= i;
        const half = !filled && n >= i - 0.5;
        return (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              filled || half ? "fill-warning text-warning" : "text-muted-foreground/35"
            )}
          />
        );
      })}
    </span>
  );
}

export function PreviewSideBadge({ direction, t }) {
  const short = normalizeDirection(direction) === "Short";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide",
        short ? "bg-loss text-white" : "bg-profit text-primary-foreground"
      )}
    >
      {directionLabel(direction, t) || "—"}
    </span>
  );
}

export function PreviewChip({ children, tone = "neutral" }) {
  const tones = {
    warning: "bg-warning/15 text-warning",
    profit: "bg-profit/15 text-profit",
    loss: "bg-loss/15 text-loss",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-[3px] text-[10px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[10px] text-muted-foreground">{label}</p>
      <div className="h-9 rounded-lg border border-border/80 bg-background/50 px-3 text-sm tabular-nums flex items-center text-foreground">
        {value ?? "—"}
      </div>
    </div>
  );
}

function TargetStopCards({ trade }) {
  const qty = getPositionSize(trade) ?? trade?.position_size ?? "—";
  const hasPriceTarget = trade?.take_profit != null || trade?.take_profit_amount != null;
  const hasPriceStop = trade?.stop_loss != null || trade?.stop_loss_amount != null;
  const target = hasPriceTarget
    ? (trade.take_profit ?? trade.take_profit_amount)
    : (trade?.take_profit_pips != null ? trade.take_profit_pips : "—");
  const stop = hasPriceStop
    ? (trade.stop_loss ?? trade.stop_loss_amount)
    : (trade?.stop_loss_pips != null ? trade.stop_loss_pips : "—");

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-border/70 bg-background/30 p-3">
        <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground">
          Profit Target <Info className="h-3 w-3 text-muted-foreground" />
        </p>
        <div className="flex gap-2">
          <ReadOnlyField label={hasPriceTarget ? "Target in Price" : "Target in Pips"} value={target} />
          <ReadOnlyField label="Qty" value={qty} />
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-background/30 p-3">
        <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground">
          Stop Loss <Info className="h-3 w-3 text-muted-foreground" />
        </p>
        <div className="flex gap-2">
          <ReadOnlyField label={hasPriceStop ? "Stop in Price" : "Stop in Pips"} value={stop} />
          <ReadOnlyField label="Qty" value={qty} />
        </div>
      </div>
    </div>
  );
}

export function StatsFieldsModal({ open, onOpenChange, selected, onSave }) {
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[hsl(var(--window-bg))] border-border">
        <DialogHeader>
          <DialogTitle>Dostosuj widoczne pola</DialogTitle>
          <DialogDescription>
            Wybierz, które informacje mają być widoczne w zakładce Stats. Ustawienia zostaną zapamiętane.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="rounded-full h-8" onClick={() => setDraft(STATS_FIELDS.map((f) => f.id))}>
            Wszystkie
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full h-8" onClick={() => setDraft([])}>
            Żadne
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full h-8" onClick={() => setDraft([...DEFAULT_STATS_FIELD_IDS])}>
            Domyślne
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-[50vh] overflow-y-auto pr-1">
          {STATS_FIELDS.map((field) => {
            const checked = draft.includes(field.id);
            return (
              <label key={field.id} className="flex items-center gap-2.5 text-sm cursor-pointer rounded-md px-1 py-1.5 hover:bg-white/5">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    setDraft((prev) => {
                      const has = prev.includes(field.id);
                      if (value && !has) return [...prev, field.id];
                      if (!value && has) return prev.filter((x) => x !== field.id);
                      return prev;
                    });
                  }}
                />
                <span>{field.label}</span>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => onSave(draft)}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatsTab({ trade, visibleIds, onOpenSettings, t, settingsInRow = true }) {
  const points = getRunningPlPoints(trade);
  return (
    <div>
      {visibleIds.map((id, index) => {
        const field = STATS_FIELDS.find((f) => f.id === id);
        if (!field) return null;
        const cell = getStatsCell(trade, id, t);
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-3 min-h-[2.35rem] border-b border-white/[0.06] last:border-0"
          >
            <span className="text-[13px] text-muted-foreground">{field.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              {id === "running_pl" ? (
                <StatsSparkline points={points} />
              ) : id === "trade_rating" ? (
                cell.rating ? <RatingStars value={cell.rating} /> : <span className="text-[13px] text-muted-foreground">—</span>
              ) : id === "side" ? (
                <PreviewSideBadge direction={trade?.direction} t={t} />
              ) : (
                <span className={cn("text-[13px] font-medium tabular-nums text-right", toneClass(cell.tone))}>
                  {cell.text}
                </span>
              )}
              {index === 0 && settingsInRow && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
                  aria-label="Dostosuj widoczne pola"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <TargetStopCards trade={trade} />
    </div>
  );
}

export function StrategyTab({ trade, strategy }) {
  const blocks = [
    { title: "Strategia", value: trade?.strategyName || strategy?.name },
    { title: "Opis", value: strategy?.description },
    { title: "Zasady", value: strategy?.rules },
    { title: "Plan / setup", value: strategy?.setup_description },
    { title: "Komentarze", value: strategy?.comments },
    { title: "Notatki strategii", value: strategy?.notes },
    { title: "Timeframe transakcji", value: trade?.timeframe },
    { title: "Sesja", value: trade?.session },
    { title: "Jakość setupu", value: trade?.setup_quality },
    { title: "Warunki rynku", value: trade?.market_condition },
    { title: "Powód wyjścia", value: trade?.exit_reason },
    { title: "Wnioski", value: trade?.lessons_learned },
  ].filter((b) => b.value != null && String(b.value).trim());

  if (!blocks.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Brak przypisanej strategii i powiązanych danych.</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <div key={block.title} className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{block.title}</p>
          <p className="text-sm whitespace-pre-wrap">{block.value}</p>
        </div>
      ))}
      {strategy?.target_rr ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <span className="text-sm text-muted-foreground">Docelowy R:R</span>
          <span className="text-sm font-semibold">1:{strategy.target_rr}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ExecutionsTab({ trade }) {
  const rows = buildExecutionRows(trade);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 pr-3 font-medium">Typ</th>
            <th className="py-2 pr-3 font-medium">Czas</th>
            <th className="py-2 pr-3 font-medium">Cena</th>
            <th className="py-2 pr-3 font-medium">Ilość</th>
            <th className="py-2 font-medium text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-3">{row.kind}</td>
              <td className="py-2 pr-3 text-muted-foreground">{row.time}</td>
              <td className="py-2 pr-3 tabular-nums">{row.price}</td>
              <td className="py-2 pr-3 tabular-nums">{row.size}</td>
              <td className={cn("py-2 text-right tabular-nums", toneClass(plTone(row.pnl)))}>
                {row.pnl == null ? "—" : formatSigned(row.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TagsTab({ trade, onChange, tagLists, onListsChange }) {
  const confluences = Array.isArray(trade?.confluences) ? trade.confluences : [];
  const mistakes = Array.isArray(trade?.mistakes) ? trade.mistakes : [];
  const psychology = Array.isArray(trade?.psychology_tags) ? trade.psychology_tags : [];
  const legacy = Array.isArray(trade?.tags) ? trade.tags : [];

  const mergeOptions = (base, selected) => {
    const extras = selected.filter(
      (item) => !base.some((b) => String(b).toLowerCase() === String(item).toLowerCase())
    );
    return extras.length ? [...base, ...extras] : base;
  };

  return (
    <div className="space-y-4">
      <EditableTagChips
        label="Confluences"
        accent="emerald"
        kind="confluences"
        options={mergeOptions(tagLists.confluences || [], confluences)}
        selected={confluences}
        onToggle={(tag) => {
          const next = confluences.includes(tag)
            ? confluences.filter((x) => x !== tag)
            : [...confluences, tag];
          onChange({ confluences: next });
        }}
        onOptionsChange={(list) => onListsChange({ confluences: list })}
        onSelectedChange={(list) => onChange({ confluences: list })}
      />
      <EditableTagChips
        label="Błędy"
        accent="rose"
        kind="mistakes"
        options={mergeOptions(tagLists.mistakes || [], mistakes)}
        selected={mistakes}
        onToggle={(tag) => {
          const next = mistakes.includes(tag)
            ? mistakes.filter((x) => x !== tag)
            : [...mistakes, tag];
          onChange({ mistakes: next });
        }}
        onOptionsChange={(list) => onListsChange({ mistakes: list })}
        onSelectedChange={(list) => onChange({ mistakes: list })}
      />
      <EditableTagChips
        label="Psychologia"
        accent="violet"
        kind="psychology"
        options={mergeOptions(tagLists.psychology || [], psychology)}
        selected={psychology}
        onToggle={(tag) => {
          const next = psychology.includes(tag)
            ? psychology.filter((x) => x !== tag)
            : [...psychology, tag];
          onChange({ psychology_tags: next });
        }}
        onOptionsChange={(list) => onListsChange({ psychology: list })}
        onSelectedChange={(list) => onChange({ psychology_tags: list })}
      />
      {legacy.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Tagi (wcześniejsze)</p>
          <div className="flex flex-wrap gap-1.5">
            {legacy.map((tag, idx) => (
              <Badge key={`${tag}-${idx}`} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmotionTab({ trade, emotionDraft, onDraftChange, onSave, saving }) {
  return (
    <div className="space-y-3">
      {trade?.emotional_state ? (
        <p className="text-xs text-muted-foreground">
          Stan emocjonalny: <span className="font-medium text-foreground">{trade.emotional_state}</span>
        </p>
      ) : null}
      <EmotionsPanelContent
        value={emotionDraft.emotions}
        onChange={(emotions) => onDraftChange({ ...emotionDraft, emotions })}
        setupConfidence={emotionDraft.setup_confidence}
        onSetupConfidenceChange={(n) => onDraftChange({ ...emotionDraft, setup_confidence: n })}
        setupConfidenceComment={emotionDraft.setup_confidence_comment}
        onSetupConfidenceCommentChange={(comment) => onDraftChange({ ...emotionDraft, setup_confidence_comment: comment })}
      />
      <Button type="button" onClick={onSave} disabled={saving}>
        Zapisz emocje
      </Button>
    </div>
  );
}

export function NotesTab({ notesDraft, onDraftChange, onSave, saving, compact = false }) {
  return (
    <div className="space-y-3 h-full flex flex-col min-h-0">
      <Textarea
        value={notesDraft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={compact ? 5 : 10}
        className={cn("flex-1 min-h-0 resize-none", compact ? "min-h-[5rem]" : "min-h-[200px]")}
      />
      <Button type="button" onClick={onSave} disabled={saving} className="self-start">
        Zapisz notatki
      </Button>
    </div>
  );
}

export function RunningPlTab({ trade }) {
  const points = getRunningPlPoints(trade);
  const net = getTradeRealizedPL(trade);
  if (!points.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Brak danych Running P&L dla tej transakcji.
      </p>
    );
  }
  const values = points.map((p) => p.value);
  const last = values[values.length - 1];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <p className="text-[11px] text-muted-foreground mb-2">Running P&L</p>
        <Sparkline values={values} width={640} height={140} fill className="w-full" />
        <p className={cn("mt-3 text-sm font-semibold tabular-nums", toneClass(plTone(last)))}>
          {formatSigned(last)}
          {net !== null ? `  ·  Net ${formatSigned(net)}` : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 font-medium text-right">Skumulowany P&L</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, idx) => (
              <tr key={`${point.idx}-${idx}`} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                <td className={cn("py-2 text-right tabular-nums", toneClass(plTone(point.value)))}>
                  {formatSigned(point.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function emptyEmotionDraft(trade) {
  return {
    emotions: normalizeEmotions(trade?.emotions),
    setup_confidence: Number(trade?.setup_confidence) || 0,
    setup_confidence_comment: trade?.setup_confidence_comment || "",
  };
}

export function TabStrip({ tabs, value, onChange, variant = "pill" }) {
  if (variant === "line") {
    return (
      <div className="flex gap-0 overflow-x-auto border-b border-white/[0.08]">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "h-9 shrink-0 px-3 text-[12px] font-medium border-b-2 -mb-px transition-colors",
              value === item.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-white/[0.04] p-1">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "h-7 shrink-0 px-2 rounded-md text-[11px] font-medium transition-colors",
            value === item.id
              ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function usePreviewTranslator() {
  return useLanguage();
}
