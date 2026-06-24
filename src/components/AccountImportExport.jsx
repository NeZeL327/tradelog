import { useRef, useState } from "react";
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
import { createTrade } from "@/lib/localStorage";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  BROKER_LABELS,
  IMPORT_BROKERS,
  filterNewTrades,
  parseTradesFromCSV,
} from "@/lib/csv-trade-import";

export function AccountExportButton({ account, trades }) {
  const exportToCSV = () => {
    try {
      if (trades.length === 0) {
        toast.error("❌ Brak transakcji do eksportu");
        return;
      }

      const headers = ["Data", "Status", "Symbol", "Kierunek", "Entry", "Exit", "Pozycja", "P&L", "P&L %", "Wynik", "Setup", "Timeframe"];
      const rows = trades.map(trade => [
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
        trade.timeframe || ""
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const fileName = `${account.name}_transakcje_${new Date().toLocaleDateString('pl-PL').replace(/\./g, '-')}.csv`;

      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(
        `✅ Wyeksportowano ${trades.length} ${trades.length === 1 ? 'transakcję' : 'transakcji'} do pliku ${fileName}`,
        { duration: 5000 }
      );
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`❌ Błąd podczas eksportu: ${err.message || 'Nieznany błąd'}`, { duration: 5000 });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToCSV}
      className="gap-1 text-xs h-7"
    >
      <Download className="w-3 h-3" />
      Eksport
    </Button>
  );
}

export function AccountImportButton({ account, existingTrades = [], onImportSuccess }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [broker, setBroker] = useState("auto");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);

  const resetDialog = () => {
    setSelectedFile(null);
    setPreview(null);
    setBroker("auto");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next) => {
    setOpen(next);
    if (!next) resetDialog();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    try {
      const content = await file.text();
      const { trades, format } = parseTradesFromCSV(content, {
        accountId: account.id,
        brokerId: broker,
      });
      const { newTrades, skipped } = filterNewTrades(trades, existingTrades, account.id);
      setPreview({
        total: trades.length,
        newCount: newTrades.length,
        skipped,
        format,
        newTrades,
      });
    } catch (err) {
      setPreview(null);
      toast.error(err.message || "Nie udało się odczytać pliku CSV");
    }
  };

  const handleBrokerChange = async (value) => {
    setBroker(value);
    if (!selectedFile) return;

    try {
      const content = await selectedFile.text();
      const { trades, format } = parseTradesFromCSV(content, {
        accountId: account.id,
        brokerId: value,
      });
      const { newTrades, skipped } = filterNewTrades(trades, existingTrades, account.id);
      setPreview({
        total: trades.length,
        newCount: newTrades.length,
        skipped,
        format,
        newTrades,
      });
    } catch {
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby importować transakcje");
      return;
    }
    if (!preview?.newTrades?.length) {
      toast.error("Brak nowych transakcji do importu");
      return;
    }

    setImporting(true);
    const loadingToast = toast.loading(`Importowanie ${preview.newTrades.length} transakcji...`);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const trade of preview.newTrades) {
        try {
          await createTrade(user.id, trade);
          successCount++;
        } catch (err) {
          console.error("Error creating trade:", err);
          errorCount++;
        }
      }

      const brokerLabel = BROKER_LABELS[preview.format] || BROKER_LABELS[broker] || broker;
      const skippedMsg = preview.skipped > 0 ? `, pominięto ${preview.skipped} duplikatów` : "";

      if (errorCount === 0) {
        toast.success(
          `✅ Zaimportowano ${successCount} ${successCount === 1 ? "transakcję" : "transakcji"} (${brokerLabel})${skippedMsg}`,
          { id: loadingToast, duration: 6000 }
        );
      } else {
        toast.warning(
          `⚠️ Zaimportowano ${successCount}, błędów: ${errorCount}${skippedMsg}`,
          { id: loadingToast, duration: 6000 }
        );
      }

      onImportSuccess?.();
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
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1"
        title="Importuj transakcje z CSV"
      >
        <Upload className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import CSV — {account.name}</DialogTitle>
            <DialogDescription>
              Wybierz brokera/źródło pliku. Przy ponownym imporcie transakcje z tą samą datą, godziną otwarcia i wolumenem nie będą nadpisywane — dodane zostaną tylko nowe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Broker / format CSV</Label>
              <Select value={broker} onValueChange={handleBrokerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz brokera" />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_BROKERS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plik CSV</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {selectedFile ? selectedFile.name : "Wybierz plik CSV..."}
                </span>
              </Button>
            </div>

            {preview && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm space-y-1">
                <p>
                  Wykryty format:{" "}
                  <strong>{BROKER_LABELS[preview.format] || preview.format}</strong>
                </p>
                <p>Wierszy w pliku: <strong>{preview.total}</strong></p>
                <p className="text-green-700 dark:text-green-400">
                  Nowe do importu: <strong>{preview.newCount}</strong>
                </p>
                {preview.skipped > 0 && (
                  <p className="text-amber-700 dark:text-amber-400">
                    Pominięte duplikaty: <strong>{preview.skipped}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={importing || !preview?.newCount}
            >
              {importing ? "Importowanie..." : `Importuj${preview?.newCount ? ` (${preview.newCount})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
