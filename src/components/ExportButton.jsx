import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import { directionLabel } from "@/lib/utils";

export function ExportButton({ trades, accounts, strategies, analytics, type = "journal" }) {
  const exportToCSV = () => {
    if (!trades || trades.length === 0) {
      alert("Brak danych do eksportu");
      return;
    }

    const headers = [
      "Data",
      "Status",
      "Symbol",
      "Konto",
      "Strategia",
      "Kierunek",
      "Timeframe",
      "Entry",
      "Exit",
      "SL",
      "TP",
      "Pozycja",
      "P&L",
      "P&L %",
      "Wynik",
      "Setup",
      "Stan emocjonalny",
      "Sesja",
      "Powód zamknięcia",
      "R/R",
      "Notatki",
      "Wnioski"
    ];

    const rows = trades.map(trade => {
      const account = accounts?.find(a => a.id === trade.account_id);
      const strategy = strategies?.find(s => s.id === trade.strategy_id);
      
      return [
        trade.date || "",
        trade.status || "",
        trade.symbol || "",
        account?.name || "",
        strategy?.name || "",
        directionLabel(trade.direction) || "",
        trade.timeframe || "",
        trade.entry_price || "",
        trade.exit_price || "",
        trade.stop_loss || "",
        trade.take_profit || "",
        trade.position_size || "",
        trade.profit_loss || "",
        trade.profit_loss_percent || "",
        trade.outcome || "",
        trade.setup_quality || "",
        trade.emotional_state || "",
        trade.session || "",
        trade.exit_reason || "",
        trade.risk_reward_ratio || "",
        (trade.notes || "").replace(/\n/g, " "),
        (trade.lessons_learned || "").replace(/\n/g, " ")
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tradejournal_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    if (!trades || trades.length === 0) {
      alert("Brak danych do eksportu");
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text("TradeJournal - Raport", 14, 20);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 14, 28);
    doc.text(`Liczba transakcji: ${trades.length}`, 14, 34);

    let yPos = 45;

    // Summary stats if analytics provided
    if (analytics) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("Podsumowanie", 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      doc.text(`Laczny P&L: ${analytics.totalPL?.toFixed(2) || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Win Rate: ${analytics.winRate?.toFixed(1) || 0}%`, 14, yPos);
      yPos += 6;
      doc.text(`Profit Factor: ${analytics.profitFactor?.toFixed(2) || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Sredni zysk: ${analytics.avgWin?.toFixed(2) || 0}`, 14, yPos);
      yPos += 6;
      doc.text(`Srednia strata: ${analytics.avgLoss?.toFixed(2) || 0}`, 14, yPos);
      yPos += 12;
    }

    // Trade list
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Lista transakcji", 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    trades.slice(0, 20).forEach((trade, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const account = accounts?.find(a => a.id === trade.account_id);
      const strategy = strategies?.find(s => s.id === trade.strategy_id);
      
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${trade.symbol || '-'} | ${directionLabel(trade.direction) || '-'}`, 14, yPos);
      yPos += 5;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Data: ${trade.date || '-'} | Status: ${trade.status || '-'}`, 18, yPos);
      yPos += 5;
      doc.text(`Konto: ${account?.name || '-'} | Strategia: ${strategy?.name || '-'}`, 18, yPos);
      yPos += 5;
      doc.text(`Entry: ${trade.entry_price || '-'} | Exit: ${trade.exit_price || '-'} | P&L: ${(trade.profit_loss || 0).toFixed(2)}`, 18, yPos);
      yPos += 5;
      doc.text(`Wynik: ${trade.outcome || '-'} | Setup: ${trade.setup_quality || '-'}`, 18, yPos);
      yPos += 7;
    });

    if (trades.length > 20) {
      doc.text(`... i ${trades.length - 20} wiecej transakcji`, 14, yPos + 5);
    }

    doc.save(`tradejournal_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Eksportuj
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          <Sheet className="w-4 h-4 mr-2" />
          Eksportuj CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Eksportuj PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}