import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export function AccountExportButton({ account, trades }) {
  const exportToCSV = () => {
    if (trades.length === 0) {
      toast.error("Brak transakcji do eksportu");
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
    link.href = URL.createObjectURL(blob);
    link.download = `${account.name}_transakcje_${new Date().toLocaleDateString('pl-PL')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast.success(`Wyeksportowano ${trades.length} transakcji`);
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

export function AccountImportButton({ account, onImportSuccess }) {
  const fileInputRef = useRef(null);

  const parseCSV = (content) => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) throw new Error("Plik CSV jest pusty");

    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1);

    const trades = rows.map((line) => {
      const cells = line.split(",").map(c => c.replace(/"/g, "").trim());
      const obj = { account_id: account.id };

      headers.forEach((header, index) => {
        let value = cells[index];
        if (!value) return;

        switch (header) {
          case "Data":
            obj.date = value;
            break;
          case "Status":
            obj.status = value || "Wykonana";
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
      });

      return obj;
    });

    return trades.filter(t => t.symbol && t.date);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const trades = parseCSV(content);

      if (trades.length === 0) {
        toast.error("Nie znaleziono ważnych transakcji");
        return;
      }

      let successCount = 0;
      for (const trade of trades) {
        await base44.entities.Trade.create(trade);
        successCount++;
      }

      toast.success(`Zaimportowano ${successCount} transakcji`);
      onImportSuccess?.();
    } catch (err) {
      toast.error(err.message || "Błąd podczas importu");
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
        className="gap-1 text-xs h-7"
      >
        <Upload className="w-3 h-3" />
        Import
      </Button>
    </>
  );
}