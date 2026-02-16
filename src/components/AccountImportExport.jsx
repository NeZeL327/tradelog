import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { createTrade } from "@/lib/localStorage";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

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

/**
 * AccountImportButton - Imports trades from CSV files for a specific trading account
 * 
 * Supported platforms:
 * - MT4/MT5: MetaTrader platforms (detects by 'ticket', 'open time' headers)
 * - TradingView: TradingView platform (detects by 'trade id', 'instrument', 'qty' headers)
 * - cTrader: cTrader platform (detects by 'position id' headers)
 * - Custom: Default format with Polish headers (Data, Symbol, Kierunek, etc.)
 * 
 * The component automatically detects the platform format and maps the columns accordingly.
 * All imported trades are associated with the provided account.
 */
export function AccountImportButton({ account, onImportSuccess }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const detectPlatformFormat = (headers) => {
    const headerStr = headers.map(h => h.toLowerCase()).join(',');
    
    // MT4/MT5 format detection (multiple variants)
    if ((headerStr.includes('ticket') || headerStr.includes('id')) && 
        (headerStr.includes('open time') || headerStr.includes('time')) && 
        (headerStr.includes('side') || headerStr.includes('type') || headerStr.includes('cmd'))) {
      return 'MT4';
    }
    // TradingView format detection
    if (headerStr.includes('trade id') || headerStr.includes('instrument') || headerStr.includes('qty')) {
      return 'TRADINGVIEW';
    }
    // cTrader format detection
    if (headerStr.includes('position id') || headerStr.includes('ctrader')) {
      return 'CTRADER';
    }
    // Default custom format
    return 'CUSTOM';
  };

  const parseCSV = (content) => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) throw new Error("Plik CSV jest pusty");

    const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).filter(line => {
      // Filter out summary/total rows
      const firstCell = line.split(',')[0]?.trim().toLowerCase();
      return firstCell && !firstCell.includes('total') && !firstCell.includes('sum');
    });
    const platform = detectPlatformFormat(headers);

    console.log('=== CSV IMPORT DEBUG ===');
    console.log('Account:', account);
    console.log('Account ID:', account?.id);
    console.log('Detected platform:', platform, 'Headers:', headers);

    const trades = rows.map((line) => {
      const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim());
      const accountId = account?.id || account.id;
      const obj = { 
        account_id: String(accountId), 
        status: "Closed" 
      };

      headers.forEach((header, index) => {
        let value = cells[index];
        if (!value) return;

        const headerLower = header.toLowerCase();

        // MT4/MT5 format mapping
        if (platform === 'MT4') {
          if (headerLower.includes('open time') || (headerLower.includes('time') && !headerLower.includes('close'))) {
            // Parse DD/MM/YYYY HH:MM:SS format
            const datePart = value.split(' ')[0];
            if (datePart.includes('/')) {
              const [day, month, year] = datePart.split('/');
              obj.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else {
              obj.date = datePart;
            }
          } else if (headerLower.includes('close time')) {
            // Store close time if available
            const datePart = value.split(' ')[0];
            if (datePart.includes('/')) {
              const [day, month, year] = datePart.split('/');
              obj.close_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          } else if (headerLower.includes('symbol')) {
            obj.symbol = value;
          } else if (headerLower === 'side' || headerLower.includes('type') || headerLower.includes('cmd')) {
            obj.direction = value.toLowerCase().includes('buy') ? 'Long' : value.toLowerCase().includes('sell') ? 'Short' : value;
          } else if (headerLower.includes('volume') || headerLower.includes('lots')) {
            obj.position_size = parseFloat(value) || null;
          } else if (headerLower.includes('open') && headerLower.includes('price')) {
            obj.entry_price = parseFloat(value) || null;
          } else if (headerLower.includes('close') && headerLower.includes('price')) {
            obj.exit_price = parseFloat(value) || null;
          } else if (headerLower.includes('s/l') || headerLower.includes('stop loss')) {
            obj.stop_loss = parseFloat(value) || null;
          } else if (headerLower.includes('t/p') || headerLower.includes('take profit')) {
            obj.take_profit = parseFloat(value) || null;
          } else if (headerLower === 'profit' && !headerLower.includes('take')) {
            const profit = parseFloat(value) || 0;
            obj.profit_loss = profit;
            obj.outcome = profit >= 0 ? 'Win' : 'Loss';
          } else if (headerLower.includes('commission')) {
            obj.commission = parseFloat(value) || null;
          } else if (headerLower === 'swap') {
            obj.swap = parseFloat(value) || null;
          } else if (headerLower === 'reason') {
            obj.notes = obj.notes ? `${obj.notes} | Exit: ${value}` : `Exit: ${value}`;
          }
        }
        // TradingView format mapping
        else if (platform === 'TRADINGVIEW') {
          if (headerLower.includes('date') || headerLower.includes('time')) {
            obj.date = value.split(' ')[0];
          } else if (headerLower.includes('instrument') || headerLower.includes('symbol')) {
            obj.symbol = value;
          } else if (headerLower.includes('side') || headerLower.includes('type')) {
            obj.direction = value.toLowerCase().includes('long') || value.toLowerCase().includes('buy') ? 'Long' : 'Short';
          } else if (headerLower.includes('qty') || headerLower.includes('quantity') || headerLower.includes('size')) {
            obj.position_size = parseFloat(value) || null;
          } else if (headerLower.includes('entry')) {
            obj.entry_price = parseFloat(value) || null;
          } else if (headerLower.includes('exit')) {
            obj.exit_price = parseFloat(value) || null;
          } else if (headerLower.includes('stop')) {
            obj.stop_loss = parseFloat(value) || null;
          } else if (headerLower.includes('target') || headerLower.includes('take')) {
            obj.take_profit = parseFloat(value) || null;
          } else if (headerLower.includes('profit') || headerLower.includes('p&l') || headerLower.includes('pnl')) {
            const profit = parseFloat(value) || 0;
            obj.profit_loss = profit;
            obj.outcome = profit >= 0 ? 'Win' : 'Loss';
          }
        }
        // Custom format (original)
        else {
          switch (header) {
            case "Data":
              obj.date = value;
              break;
            case "Status":
              obj.status = value || "Closed";
              break;
            case "Symbol":
              obj.symbol = value;
              break;
            case "Kierunek":
              obj.direction = value;
              break;
            case "Entry":
              obj.entry_price = parseFloat(value) || null;
              break;
            case "Exit":
              obj.exit_price = parseFloat(value) || null;
              break;
            case "Pozycja":
              obj.position_size = parseFloat(value) || null;
              break;
            case "P&L":
              obj.profit_loss = parseFloat(value) || null;
              break;
            case "P&L %":
              obj.profit_loss_percent = parseFloat(value) || null;
              break;
            case "Wynik":
              obj.outcome = value;
              break;
            case "Setup":
              obj.setup_quality = value;
              break;
            case "Timeframe":
              obj.timeframe = value;
              break;
          }
        }
      });

      // Calculate P&L % if we have entry and P&L
      if (obj.profit_loss && obj.entry_price && obj.position_size) {
        obj.profit_loss_percent = ((obj.profit_loss / (obj.entry_price * obj.position_size)) * 100).toFixed(2);
      }

      console.log('Parsed trade with account_id:', obj.account_id, 'Symbol:', obj.symbol);

      return obj;
    });

    return { trades: trades.filter(t => t.symbol && t.date), platform };
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show loading toast
    const loadingToast = toast.loading(`Importowanie pliku ${file.name}...`);

    try {
      if (!user) {
        toast.error("Musisz być zalogowany, aby importować transakcje", { id: loadingToast });
        return;
      }

      const content = await file.text();
      const { trades, platform } = parseCSV(content);

      if (trades.length === 0) {
        toast.error("Nie znaleziono ważnych transakcji w pliku", { id: loadingToast });
        return;
      }

      const platformNames = {
        'MT4': 'MT4/MT5',
        'TRADINGVIEW': 'TradingView',
        'CTRADER': 'cTrader',
        'CUSTOM': 'Custom'
      };

      let successCount = 0;
      let errorCount = 0;
      
      console.log('Starting import of', trades.length, 'trades for account:', account.name, 'ID:', account.id);
      
      for (const trade of trades) {
        try {
          console.log('Creating trade:', { symbol: trade.symbol, account_id: trade.account_id });
          await createTrade(user.id, trade);
          successCount++;
        } catch (err) {
          console.error('Error creating trade:', err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(
          `✅ Zaimportowano ${successCount} ${successCount === 1 ? 'transakcję' : 'transakcji'} z platformy ${platformNames[platform]}`,
          { id: loadingToast, duration: 5000 }
        );
      } else {
        toast.warning(
          `⚠️ Zaimportowano ${successCount} transakcji, ${errorCount} błędów`,
          { id: loadingToast, duration: 5000 }
        );
      }
      
      onImportSuccess?.();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(
        `❌ Błąd podczas importu: ${err.message || 'Nieznany błąd'}`,
        { id: loadingToast, duration: 5000 }
      );
    }

    fileInputRef.current.value = "";
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
        onClick={() => fileInputRef.current?.click()}
        className="gap-1"
        title="Importuj transakcje z CSV (MT4, MT5, TradingView, cTrader)"
      >
        <Upload className="w-4 h-4" />
      </Button>
    </>
  );
}