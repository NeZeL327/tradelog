import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { createTrade, getTrades } from "@/lib/localStorage";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  BROKER_LABELS,
  IMPORT_BROKERS,
  filterNewTrades,
  parseTradesFromUpload,
} from "@/lib/csv-trade-import";

export function AccountExportButton({ account, trades }) {
  const exportToCSV = () => {
    try {
      if (trades.length === 0) {
        toast.error("❌ Brak transakcji do eksportu");
        return;
      }

      const headers = ["Data", "Status", "Symbol", "Kierunek", "Entry", "Exit", "Pozycja", "P&L", "P&L %", "Wynik", "Setup", "Timeframe"];
      const rows = trades.map((trade) => [
        trade.date || "",
        trade.status || "",
        trade.symbol || "",
        trade.direction || "",
        trade.entry_price || "",
        trade.exit_price || "",
        trade.position_size || "",
        trade.profit_loss || "",
        trade.profit_loss_percent || "",
        trade.outcome || "",
        trade.setup_quality || "",
        trade.timeframe || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const fileName = `${account.name}_transakcje_${new Date().toLocaleDateString("pl-PL").replace(/\./g, "-")}.csv`;

      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(
        `✅ Wyeksportowano ${trades.length} ${trades.length === 1 ? "transakcję" : "transakcji"} do pliku ${fileName}`,
        { duration: 5000 }
      );
    } catch (err) {
      console.error("Export error:", err);
      toast.error(`❌ Błąd podczas eksportu: ${err.message || "Nieznany błąd"}`, { duration: 5000 });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1 text-xs h-7">
      <Download className="w-3 h-3" />
      Eksport
    </Button>
  );
}

export function AccountImportButton({ account, existingTrades = [], onImportSuccess }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const pickingFileRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [broker, setBroker] = useState("auto");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState("");

  const resetDialog = () => {
    setSelectedFile(null);
    setPreview(null);
    setParseError("");
    setBroker("auto");
    setParsing(false);
    pickingFileRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next) => {
    if (!next && pickingFileRef.current) return;
    setOpen(next);
    if (!next) resetDialog();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onWindowFocus = () => {
      window.setTimeout(() => {
        pickingFileRef.current = false;
      }, 300);
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [open]);

  const buildPreview = async (file, brokerId, tradesForDedup) => {
    const { trades, format } = await parseTradesFromUpload(file, {
      accountId: account.id,
      brokerId,
    });
    const { newTrades, skipped } = filterNewTrades(trades, tradesForDedup, account.id);
    const sample = newTrades[0] || trades[0] || null;
    return {
      total: trades.length,
      newCount: newTrades.length,
      skipped,
      format,
      newTrades,
      sample,
    };
  };

  const runPreview = async (file, brokerId) => {
    if (!file) return;
    setParsing(true);
    setParseError("");
    setPreview(null);
    try {
      const tradesForDedup = user?.id ? await getTrades(user.id) : existingTrades;
      const next = await buildPreview(file, brokerId, tradesForDedup);
      setPreview(next);
      if (!next.total) {
        setParseError(
          "Nie znaleziono transakcji buy/sell w pliku. Dla MT zapisz historię jako CSV albo XLSX z pozycjami (nie sam bilans)."
        );
      }
    } catch (err) {
      setPreview(null);
      setParseError(err.message || "Nie udało się odczytać pliku");
      toast.error(err.message || "Nie udało się odczytać pliku");
    } finally {
      setParsing(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    pickingFileRef.current = false;
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".csv") &&
      !lower.endsWith(".xml") &&
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xlsm")
    ) {
      toast.error("Wybierz plik CSV, XML lub XLSX (Excel z MT4/MT5)");
      return;
    }

    setSelectedFile(file);
    setOpen(true);
    await runPreview(file, broker);
  };

  const handleBrokerChange = async (value) => {
    setBroker(value);
    if (selectedFile) await runPreview(selectedFile, value);
  };

  const openFilePicker = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    pickingFileRef.current = true;
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const canImport = Boolean(selectedFile && preview?.newCount > 0 && !parsing && !importing);

  const handleImport = async () => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby importować transakcje");
      return;
    }
    if (!selectedFile) {
      toast.error("Najpierw wybierz plik CSV, XML lub XLSX");
      return;
    }
    if (parsing) return;

    if (!preview?.newCount) {
      if (preview?.total > 0) {
        toast.info("Wszystkie transakcje z tego pliku są już w dzienniku.");
      } else {
        toast.error(parseError || "Brak transakcji do importu — wybierz inny plik.");
      }
      return;
    }

    setImporting(true);
    const loadingToast = toast.loading("Sprawdzanie duplikatów...");

    let successCount = 0;
    let errorCount = 0;
    let skipped = 0;
    let format = broker;

    try {
      const freshTrades = await getTrades(user.id);
      const previewNow = await buildPreview(selectedFile, broker, freshTrades);
      skipped = previewNow.skipped;
      format = previewNow.format;
      setPreview(previewNow);

      if (!previewNow.newTrades.length) {
        toast.info(
          previewNow.total > 0
            ? `Wszystkie ${previewNow.total} transakcji z pliku są już w dzienniku — duplikaty pominięte.`
            : "Plik nie zawiera transakcji do importu.",
          { id: loadingToast, duration: 6000 }
        );
        return;
      }

      toast.loading(`Importowanie ${previewNow.newTrades.length} nowych transakcji...`, {
        id: loadingToast,
      });

      for (const trade of previewNow.newTrades) {
        try {
          await createTrade(user.id, trade);
          successCount++;
        } catch (err) {
          console.error("Error creating trade:", err);
          errorCount++;
          toast.error(`Błąd zapisu trade ${trade.symbol || ""}: ${err.message || "Firestore"}`);
        }
      }

      const brokerLabel = BROKER_LABELS[format] || BROKER_LABELS[broker] || broker;
      const skippedMsg = skipped > 0 ? `, pominięto ${skipped} duplikatów` : "";

      if (successCount === 0 && errorCount > 0) {
        toast.error(`❌ Nie udało się zapisać transakcji (${errorCount} błędów)`, {
          id: loadingToast,
          duration: 8000,
        });
        return;
      }

      if (errorCount === 0) {
        toast.success(
          `✅ Dodano ${successCount} ${successCount === 1 ? "nową transakcję" : "nowych transakcji"} (${brokerLabel})${skippedMsg}`,
          { id: loadingToast, duration: 6000 }
        );
      } else {
        toast.warning(`⚠️ Dodano ${successCount}, błędów: ${errorCount}${skippedMsg}`, {
          id: loadingToast,
          duration: 6000,
        });
      }

      onImportSuccess?.({ imported: successCount, skipped, errors: errorCount });
      handleOpenChange(false);
    } catch (err) {
      toast.error(`❌ Błąd importu: ${err.message || "Nieznany błąd"}`, { id: loadingToast });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xml,.xlsx,.xlsm,text/csv,text/xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFileSelect}
        className="sr-only"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="h-8 gap-1 px-2 relative z-10 shrink-0"
        title="Importuj transakcje z CSV / XML / XLSX"
      >
        <Upload className="w-3.5 h-3.5" />
        <span className="text-xs">Import</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-md z-[100]"
          onPointerDownOutside={(e) => {
            if (pickingFileRef.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (pickingFileRef.current) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (pickingFileRef.current) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Import — {account.name}</DialogTitle>
            <DialogDescription>
              1) Wybierz format (Auto / MT4-MT5) 2) Wybierz plik XLSX/CSV 3) Kliknij Importuj, gdy
              pojawią się nowe transakcje.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Broker / format</Label>
              <Select value={broker} onValueChange={handleBrokerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz brokera" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {IMPORT_BROKERS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plik CSV / XML / XLSX</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={openFilePicker}
                disabled={parsing || importing}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {selectedFile ? selectedFile.name : "Wybierz plik CSV, XML lub XLSX..."}
                </span>
              </Button>
            </div>

            {parsing && <p className="text-sm text-slate-500">Odczytywanie pliku…</p>}

            {parseError && !parsing && (
              <div className="rounded-lg border border-red-300 bg-loss/10 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                {parseError}
              </div>
            )}

            {preview && !parsing && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  Wykryty format:{" "}
                  <strong>{BROKER_LABELS[preview.format] || preview.format}</strong>
                </p>
                <p>
                  Wierszy w pliku: <strong>{preview.total}</strong>
                </p>
                <p className="text-profit dark:text-profit">
                  Nowe do importu: <strong>{preview.newCount}</strong>
                </p>
                {preview.skipped > 0 && (
                  <p className="text-amber-700 dark:text-amber-400">
                    Pominięte duplikaty: <strong>{preview.skipped}</strong>
                  </p>
                )}
                {preview.newCount === 0 && preview.total > 0 && (
                  <p className="text-slate-600 dark:text-slate-400">
                    Brak nowych transakcji — wszystkie z tego pliku są już w dzienniku.
                  </p>
                )}
                {preview.sample && (
                  <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      Przykład ({preview.sample.symbol}):
                    </p>
                    <p>
                      Profit z pliku: <strong>{preview.sample.profit_loss_gross ?? "—"}</strong>
                    </p>
                    <p>
                      Commission: <strong>{preview.sample.commission ?? 0}</strong>
                      {preview.sample.swap != null ? ` · Swap: ${preview.sample.swap}` : ""}
                    </p>
                    <p>
                      Netto P&L: <strong>{preview.sample.profit_loss ?? "—"}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3 mt-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="min-w-[9rem]"
            >
              {importing
                ? "Importowanie..."
                : parsing
                  ? "Czytanie..."
                  : preview?.newCount
                    ? `Importuj (${preview.newCount})`
                    : "Importuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
