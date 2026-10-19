import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import {
  importResultStatus,
  importResultTiles,
  polishUnitKind,
  splitImportError,
} from "@/lib/importResultView";

const ISSUE_PREVIEW = 10;

const STATUS_UI = {
  success: { icon: CheckCircle2, className: "text-ds-pos", tint: "bg-ds-pos/10" },
  warning: { icon: AlertTriangle, className: "text-ds-warn", tint: "bg-ds-warn/10" },
  error: { icon: XCircle, className: "text-ds-neg", tint: "bg-ds-neg/10" },
};

function tradeUnit(n, t, language) {
  if (language === "en") return n === 1 ? t("importResultUnitOneEn") : t("importResultUnitManyEn");
  const kind = polishUnitKind(n);
  if (kind === "one") return t("importResultUnitOne");
  if (kind === "few") return t("importResultUnitFew");
  return t("importResultUnitMany");
}

function buildIssues({ empty, imported, skipped, extraIssues, t }) {
  const items = [];
  if (empty) items.push({ id: "empty", reason: t("importResultEmptyHint") });
  if (!empty && imported === 0 && (skipped || 0) > 0) {
    items.push({ id: "dupes", reason: t("importResultDupesHint") });
  }
  if (Array.isArray(extraIssues)) {
    extraIssues.forEach((item, idx) => {
      if (item?.reason) items.push({ id: item.id || `extra-${idx}`, ...item });
    });
  }
  return items;
}

function summaryLine({ imported, skipped, empty, errorMessage, t, language }) {
  if (empty) return t("importResultSummaryEmpty");
  if (imported === 0 && (skipped || 0) > 0) return t("importResultSummaryDupes");
  if (imported > 0) {
    return t("importResultSummaryImported")
      .replace("{n}", String(imported))
      .replace("{unit}", tradeUnit(imported, t, language));
  }
  if (errorMessage) {
    const split = splitImportError(errorMessage);
    return split.friendlyKey ? t(split.friendlyKey) : (split.friendlyText || t("importResultSummaryNone"));
  }
  return t("importResultSummaryNone");
}

function ResultKpi({ label, value }) {
  return (
    <div className="rounded-[16px] border border-ds-line bg-ds-s2 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ds-text3">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums leading-none text-ds-text">{value}</p>
    </div>
  );
}

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
      <span className="w-20 shrink-0 text-ds-text3">{label}</span>
      <div className="min-w-0 flex-1 text-ds-text2">{children}</div>
    </div>
  );
}

export default function ImportResultDialog({
  open,
  onOpenChange,
  imported,
  skipped,
  errors,
  empty = false,
  fileName,
  accountName,
  dateFrom,
  dateTo,
  symbols,
  extraIssues,
  errorMessage,
  journalHref,
}) {
  const { t, language } = useLanguage();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  const status = importResultStatus({ imported, skipped, errors, empty, errorMessage });
  const tiles = importResultTiles({ imported, skipped, errors, errorMessage });
  const chrome = STATUS_UI[status];
  const Icon = chrome.icon;
  const issues = useMemo(
    () => buildIssues({ empty, imported, skipped, extraIssues, t }),
    [empty, imported, skipped, extraIssues, t]
  );
  const technical = splitImportError(errorMessage).technical;
  const preview = issues.slice(0, ISSUE_PREVIEW);
  const rest = issues.slice(ISSUE_PREVIEW);
  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`)
    : null;
  const showJournal = Boolean(journalHref && imported > 0);
  const title =
    status === "success" ? t("importResultSuccess")
      : status === "warning" ? t("importResultWarning")
        : t("importResultError");
  const live = summaryLine({ imported, skipped, empty, errorMessage, t, language });
  const hasDetails = Boolean(fileName || accountName || dateLabel || (symbols && symbols.length));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(32rem,calc(100%-1.25rem))] gap-4 border-ds-frame bg-ds-glass p-5 shadow-ds-pop backdrop-blur-xl duration-[var(--ds-dur)] sm:p-6"
        aria-describedby="import-result-summary"
      >
        <DialogHeader className="pr-8 text-left">
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", chrome.tint, chrome.className)}>
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription id="import-result-summary" className="text-[13px] text-ds-text2" aria-live="polite">
                {live}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {tiles.length > 0 && (
          <div className={cn("grid gap-2", tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {tiles.map((tile) => (
              <ResultKpi
                key={tile.id}
                label={
                  tile.id === "imported" ? t("importResultTileImported")
                    : tile.id === "skipped" ? t("importResultTileSkipped")
                      : t("importResultTileErrors")
                }
                value={tile.value}
              />
            ))}
          </div>
        )}

        {hasDetails && (
          <div className="space-y-2 rounded-[16px] border border-ds-line bg-ds-s2/80 px-3 py-2.5">
            <DetailRow label={t("importResultFile")}>{fileName || null}</DetailRow>
            <DetailRow label={t("importResultAccount")}>{accountName || null}</DetailRow>
            <DetailRow label={t("importResultDates")}>{dateLabel}</DetailRow>
            {Array.isArray(symbols) && symbols.length > 0 && (
              <DetailRow label={t("importResultSymbols")}>
                <div className="flex flex-wrap gap-1">
                  {symbols.map((symbol) => (
                    <span
                      key={symbol}
                      className="inline-flex h-6 items-center rounded-full border border-ds-line px-2 text-[11px] text-ds-text2"
                    >
                      {symbol}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}
          </div>
        )}

        {issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ds-text3">
              {t("importResultIssues")}
            </p>
            <ul className="space-y-1.5 text-[13px] text-ds-text2">
              {preview.map((item) => (
                <li key={item.id} className="rounded-[12px] border border-ds-line bg-ds-s2 px-3 py-2">
                  {item.reason}
                </li>
              ))}
            </ul>
            {rest.length > 0 && (
              <Collapsible open={issuesOpen} onOpenChange={setIssuesOpen}>
                <CollapsibleTrigger className="inline-flex items-center gap-1 text-[12px] text-ds-text2 hover:text-ds-text">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", issuesOpen && "rotate-180")} />
                  {issuesOpen ? t("importResultLess") : t("importResultMore").replace("{n}", String(rest.length))}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-1.5 space-y-1.5 text-[13px] text-ds-text2">
                    {rest.map((item) => (
                      <li key={item.id} className="rounded-[12px] border border-ds-line bg-ds-s2 px-3 py-2">
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {technical ? (
          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <CollapsibleTrigger className="inline-flex items-center gap-1 text-[12px] text-ds-text3 hover:text-ds-text2">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", techOpen && "rotate-180")} />
              {t("importResultTech")}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-[12px] border border-ds-line bg-ds-s1 p-2 text-[11px] text-ds-text3">
                {technical}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          {showJournal && (
            <Button asChild variant="outline">
              <Link to={journalHref} onClick={() => onOpenChange(false)}>
                {t("importResultViewJournal")}
              </Link>
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("importResultClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
