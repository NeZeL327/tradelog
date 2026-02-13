import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { createTrade } from "@/lib/localStorage";
import { toast } from "sonner";

export function ImportButton({ onImportSuccess, accounts, strategies }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [importData, setImportData] = React.useState(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState("");

  const parseCSV = (content) => {
    const lines = content.split("\n");
    if (lines.length < 2) throw new Error("Plik CSV jest pusty");

    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).filter(line => line.trim());

    const trades = rows.map((line) => {
      const cells = line.split(",").map(c => c.replace(/"/g, "").trim());
      const obj = {};
      
      headers.forEach((header, index) => {
        let value = cells[index] || "";
        
        // Konwertuj liczbowe pola
        if (["entry_price", "exit_price", "stop_loss", "take_profit", "position_size", "profit_loss", "profit_loss_percent", "commission", "net_profit_loss", "risk_reward_ratio"].includes(header)) {
          value = value ? parseFloat(value) : null;
        }
        
        // Mapuj nagłówki na właściwości
        switch (header) {
          case "Data":
            obj.date = value;
            break;
          case "Status":
            obj.status = value;
            break;
          case "Symbol":
            obj.symbol = value;
            break;
          case "Konto":
            if (accounts && value) {
              const account = accounts.find(a => a.name === value);
              obj.account_id = account?.id || "";
            }
            break;
          case "Strategia":
            if (strategies && value) {
              const strategy = strategies.find(s => s.name === value);
              obj.strategy_id = strategy?.id || "";
            }
            break;
          case "Kierunek":
            obj.direction = value;
            break;
          case "Timeframe":
            obj.timeframe = value;
            break;
          case "Entry":
            obj.entry_price = value;
            break;
          case "Exit":
            obj.exit_price = value;
            break;
          case "SL":
            obj.stop_loss = value;
            break;
          case "TP":
            obj.take_profit = value;
            break;
          case "Pozycja":
            obj.position_size = value;
            break;
          case "P&L":
            obj.profit_loss = value;
            break;
          case "P&L %":
            obj.profit_loss_percent = value;
            break;
          case "Wynik":
            obj.outcome = value;
            break;
          case "Setup":
            obj.setup_quality = value;
            break;
          case "Stan emocjonalny":
            obj.emotional_state = value;
            break;
          case "Sesja":
            obj.session = value;
            break;
          case "Powód zamknięcia":
            obj.exit_reason = value;
            break;
          case "R/R":
            obj.risk_reward_ratio = value;
            break;
          case "Notatki":
            obj.notes = value;
            break;
          case "Wnioski":
            obj.lessons_learned = value;
            break;
          default:
            break;
        }
      });

      return obj;
    });

    return trades.filter(t => t.symbol && t.date); // Filtruj niekompletne rekordy
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const trades = parseCSV(content);
        
        if (trades.length === 0) {
          toast.error("Nie znaleziono ważnych transakcji w pliku");
          return;
        }

        setImportData(trades);
        setShowDialog(true);
        toast.info(`Gotowy do importu ${trades.length} transakcji`);
      } catch (err) {
        const errorMsg = err.message || "Błąd podczas parsowania pliku CSV";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    };

    reader.readAsText(file);
    fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!importData || importData.length === 0 || !user) return;

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const trade of importData) {
        if (trade.symbol && trade.date && trade.account_id) {
          await createTrade(user.id, trade);
          successCount++;
        } else {
          failCount++;
        }
      }

      setShowDialog(false);
      setImportData(null);
      
      if (successCount > 0) {
        toast.success(`Zaimportowano ${successCount} transakcji!`);
        onImportSuccess?.();
      }
      
      if (failCount > 0) {
        toast.warning(`${failCount} transakcji pominięto (brakuje wymaganych danych)`);
      }
    } catch (err) {
      const errorMsg = err.message || "Błąd podczas importu transakcji";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsImporting(false);
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
        className="gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
      >
        <Upload className="w-4 h-4" />
        Importuj CSV
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {error ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Błąd importu
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  Potwierdzenie importu
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {error ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400">
                  {error}
                </div>
              ) : (
                `Zamierzasz zaimportować ${importData?.length || 0} transakcji. Czy chcesz kontynuować?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto text-sm">
            {importData?.slice(0, 5).map((trade, idx) => (
              <div key={idx} className="text-slate-400">
                {trade.symbol} {trade.direction} @ {trade.entry_price} ({trade.date})
              </div>
            ))}
            {importData && importData.length > 5 && (
              <div className="text-slate-500 italic">
                ... i {importData.length - 5} więcej
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel disabled={isImporting || error !== ""}>Anuluj</AlertDialogCancel>
            {!error && (
              <AlertDialogAction
                onClick={handleImport}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Importowanie...
                  </>
                ) : (
                  "Importuj"
                )}
              </AlertDialogAction>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}