import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getTrades, patchTradesFieldsBatch } from "@/lib/localStorage";
import {
  MT5_TIME_FIX_CREATED_AT_FIELD,
  MT5_TIME_FIX_CUTOFF_ISO,
  buildTimeFixBackup,
  parseTimeFixBackup,
  patchesFromBackupRestore,
  patchesFromFixRows,
  planMt4ImportTimeFix,
  verifyTimeFix,
} from "@/lib/mt5ImportTimeFix";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SKIP_LABEL = {
  pl: {
    already_fixed: "już skorygowane (time_fix_v1)",
    not_imported: "wpis ręczny",
    other_broker: "inny broker (FundedNext / TradingView / custom)",
    metaapi: "MetaApi (import_broker=mt5)",
    not_mt4: "brak import_broker=mt4",
    created_at_unknown: "brak daty utworzenia",
    created_after_cutoff: "utworzone po wdrożeniu Etapu 2",
    no_time: "brak daty/godziny",
    unchanged: "godzina bez zmiany",
    deleted: "w koszu",
  },
  en: {
    already_fixed: "already fixed (time_fix_v1)",
    not_imported: "manual entry",
    other_broker: "other broker (FundedNext / TradingView / custom)",
    metaapi: "MetaApi (import_broker=mt5)",
    not_mt4: "missing import_broker=mt4",
    created_at_unknown: "missing createdAt",
    created_after_cutoff: "created after Etap 2 cutoff",
    no_time: "missing date/time",
    unchanged: "clock already local",
    deleted: "in trash",
  },
};

function copy(language) {
  const pl = language === "pl";
  return {
    title: pl ? "Korekta godzin importu MT5" : "MT5 import time correction",
    lead: pl
      ? "Jednorazowo przelicza czas serwera brokera (America/New_York + 7h) na czas lokalny w już zapisanych transakcjach z pliku MT4/MT5. Nic nie zapisuje, dopóki nie klikniesz „Popraw godziny”."
      : "One-time conversion of stored MT4/MT5 file times from broker server clock (America/New_York + 7h) to local time. Nothing is written until you click Apply.",
    cutoff: pl
      ? `Pole daty utworzenia: ${MT5_TIME_FIX_CREATED_AT_FIELD}. Próg Etapu 2: ${MT5_TIME_FIX_CUTOFF_ISO}.`
      : `Created-at field: ${MT5_TIME_FIX_CREATED_AT_FIELD}. Etap 2 cutoff: ${MT5_TIME_FIX_CUTOFF_ISO}.`,
    preview: pl ? "Podgląd (bez zapisu)" : "Preview (no writes)",
    backup: pl ? "Pobierz kopię zapasową" : "Download backup",
    apply: pl ? "Popraw godziny" : "Apply times",
    restore: pl ? "Przywróć z kopii" : "Restore from backup",
    confirmTitle: pl ? "Zapis do bazy" : "Write to database",
    confirmBody: pl
      ? "To zmieni godziny i daty w zaznaczonych transakcjach oraz ustawi znacznik time_fix_v1. P&L, ceny i wolumen zostaną nietknięte. Kontynuować?"
      : "This will change date/time fields on the selected trades and set time_fix_v1. P&L, prices and volume stay untouched. Continue?",
    needBackup: pl
      ? "Najpierw pobierz kopię zapasową — zapis jest zablokowany."
      : "Download the backup first — write is locked until then.",
    empty: pl ? "0 do zmiany" : "0 to change",
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatShift(hours) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const n = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `−${n}h`;
}

function clockCell(clock) {
  const open = [clock?.date, clock?.entry_time || clock?.time].filter(Boolean).join(" ");
  const close = [clock?.close_date || clock?.date, clock?.exit_time].filter(Boolean).join(" ");
  return { open: open || "—", close: close || "—" };
}

export default function Mt5TimeFixTool({ userId, language = "pl" }) {
  const t = copy(language);
  const labels = SKIP_LABEL[language] || SKIP_LABEL.pl;
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [backupReady, setBackupReady] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(null);
  const [backupFile, setBackupFile] = useState(null);

  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey: ["trades", userId],
    queryFn: () => getTrades(userId),
    enabled: !!userId,
  });

  const plan = useMemo(() => planMt4ImportTimeFix(trades), [trades]);
  const fingerprint = plan.toFix.map((row) => row.id).join(",");
  const canWrite = backupReady && backupReady === fingerprint && plan.toFix.length > 0;
  const unknownCreated = plan.skipped.filter((row) => row.reason === "created_at_unknown");

  const makeBackup = () => {
    if (!plan.toFix.length) return null;
    const backup = buildTimeFixBackup({ userId, rows: plan.toFix });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`mt5-time-fix-backup-${stamp}.json`, backup);
    setBackupFile(backup);
    setBackupReady(fingerprint);
    return backup;
  };

  const runApply = async () => {
    if (!canWrite || busy) return;
    setBusy(true);
    try {
      const backup = backupFile && backupReady === fingerprint ? backupFile : makeBackup();
      if (!backup?.trades?.length) {
        toast.error(t.needBackup);
        return;
      }
      const beforeTrades = trades;
      await patchTradesFieldsBatch(userId, patchesFromFixRows(plan.toFix));
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      const afterTrades = await getTrades(userId);
      const report = verifyTimeFix({
        beforeTrades,
        afterTrades,
        backupRows: backup.trades,
      });
      setVerify(report);
      await refetch();
      toast.success(
        language === "pl"
          ? `Zapisano ${backup.trades.length} transakcji. Ponowny podgląd powinien pokazać 0 do zmiany.`
          : `Updated ${backup.trades.length} trades. Preview should now show 0 to change.`
      );
    } catch (err) {
      toast.error(err.message || "Zapis nie powiódł się");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const runRestore = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const text = await file.text();
      const backup = parseTimeFixBackup(text);
      await patchTradesFieldsBatch(userId, patchesFromBackupRestore(backup));
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      await refetch();
      setBackupReady("");
      setBackupFile(null);
      setVerify(null);
      toast.success(
        language === "pl"
          ? `Przywrócono ${backup.trades.length} transakcji i usunięto znacznik.`
          : `Restored ${backup.trades.length} trades and removed the marker.`
      );
    } catch (err) {
      toast.error(err.message || "Nie udało się przywrócić kopii");
    } finally {
      setBusy(false);
    }
  };

  const oct22 = trades.filter((trade) => trade.date === "2026-10-22" || trade.close_date === "2026-10-22");

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">{t.lead}</p>
      <p className="text-xs text-muted-foreground font-mono">{t.cutoff}</p>

      {isLoading ? (
        <p className="text-muted-foreground">Wczytywanie transakcji…</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p>
              {t.preview}: <strong>{plan.summary.toFix}</strong>
              {plan.summary.toFix === 0 ? ` — ${t.empty}` : ""}
            </p>
            <p>
              Zmiana dnia (północ): <strong>{plan.summary.dayChanged}</strong>
            </p>
            <p>
              Przesunięcie −1h: <strong>{plan.summary.shift1h}</strong>
              {" · "}
              −2h: <strong>{plan.summary.shift2h}</strong>
              {plan.summary.shiftOther ? ` · inne: ${plan.summary.shiftOther}` : ""}
            </p>
            <p>
              Pominięte: <strong>{plan.summary.skipped}</strong>
            </p>
            {Object.entries(plan.summary.byReason).map(([reason, count]) => (
              <p key={reason} className="text-xs text-muted-foreground">
                {labels[reason] || reason}: {count}
              </p>
            ))}
          </div>

          {unknownCreated.length > 0 && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 space-y-1">
              <p className="font-medium">Bez createdAt — nie zmieniane:</p>
              {unknownCreated.map((row) => (
                <p key={row.id} className="font-mono text-xs">
                  {row.id} · {row.symbol || "—"} · {row.account_id || "—"}
                </p>
              ))}
            </div>
          )}

          {plan.toFix.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-2">Symbol</th>
                    <th className="p-2">Przed</th>
                    <th className="p-2">Po</th>
                    <th className="p-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.toFix.map((row) => {
                    const before = clockCell(row.before);
                    const after = clockCell(row.after);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="p-2 align-top">
                          {row.symbol}
                          <div className="text-[10px] text-muted-foreground">{row.id}</div>
                        </td>
                        <td className="p-2 align-top">
                          {before.open}
                          <div className="text-muted-foreground">{before.close}</div>
                        </td>
                        <td className="p-2 align-top">
                          {after.open}
                          <div className="text-muted-foreground">{after.close}</div>
                        </td>
                        <td className="p-2 align-top">
                          {formatShift(row.shiftHours)}
                          {row.dayChanged || row.closeDayChanged ? " · dzień" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!plan.toFix.length || busy}
              onClick={() => {
                makeBackup();
                toast.success(language === "pl" ? "Kopia zapisana na dysk." : "Backup saved to disk.");
              }}
            >
              {t.backup}
            </Button>
            <Button
              type="button"
              disabled={!canWrite || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {t.apply}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {t.restore}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) runRestore(file);
              }}
            />
          </div>
          {!canWrite && plan.toFix.length > 0 && (
            <p className="text-xs text-amber-500">{t.needBackup}</p>
          )}

          {verify && (
            <div className="rounded-lg border border-border p-3 space-y-1 text-xs">
              <p>
                Liczba transakcji: {verify.countBefore} → {verify.countAfter}{" "}
                {verify.countUnchanged ? "✓" : "✗ zmiana"}
              </p>
              <p>
                Suma P&L: {verify.pnlBefore} → {verify.pnlAfter}{" "}
                {verify.pnlUnchanged ? "✓" : "✗ zmiana"}
              </p>
              <p>
                Próbka odczytu po zapisie:{" "}
                {verify.sampleAllMatch ? "godziny zgodne z podglądem" : "niezgodność — sprawdź wiersze"}
              </p>
              {oct22.slice(0, 8).map((trade) => (
                <p key={trade.id} className="font-mono">
                  {trade.symbol} {trade.date} {trade.entry_time} → {trade.close_date} {trade.exit_time}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmBody} ({plan.toFix.length})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Anuluj</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={runApply}>
              {busy ? "Zapisywanie…" : t.apply}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
