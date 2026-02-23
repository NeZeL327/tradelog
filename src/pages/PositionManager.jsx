import React, { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { CheckCircle, AlertCircle, X } from "lucide-react";

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(2);
};

export default function PositionManager() {
  const { t } = useLanguage();

  // 📊 Entry section
  const [direction, setDirection] = useState("Long");
  const [entryPrice, setEntryPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [positionSize, setPositionSize] = useState("");

  // 💰 Trade state
  const [isActive, setIsActive] = useState(false);
  const [remainingSize, setRemainingSize] = useState(0);
  const [realizedPnL, setRealizedPnL] = useState(0);
  const [closedTrades, setClosedTrades] = useState([]);

  // 🎯 Close section
  const [closePercentDialog, setClosePercentDialog] = useState(null);
  const [dialogPrice, setDialogPrice] = useState("");

  // 📢 Notifications
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 🚀 SET ENTRY
  const handleSetEntry = () => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(slPrice);
    const tp = parseFloat(tpPrice);
    const size = parseFloat(positionSize);

    if (!entry || !sl || !tp || !size) {
      showNotification("error", "Wypełnij wszystkie pola");
      return;
    }

    setIsActive(true);
    setRemainingSize(size);
    setRealizedPnL(0);
    setClosedTrades([]);
    showNotification("success", `Pozycja otwarta: ${direction} ${size} @ ${entry}`);
  };

  // 🔄 PARTIAL CLOSE
  const handleClosePercent = (percent) => {
    if (!isActive || remainingSize <= 0) return;
    setClosePercentDialog(percent);
    setDialogPrice("");
  };

  const confirmClose = () => {
    if (!closePercentDialog) return;

    const exit = parseFloat(dialogPrice);
    const entry = parseFloat(entryPrice);

    if (!exit || !entry) {
      showNotification("error", "Podaj cenę wyjścia");
      return;
    }

    // Obliczenie
    const sizeToClose = (remainingSize * closePercentDialog) / 100;
    const dirSign = direction === "Long" ? 1 : -1;
    const pnl = (exit - entry) * sizeToClose * dirSign;

    // Update state
    const newRemaining = remainingSize - sizeToClose;
    setRemainingSize(Math.max(0, newRemaining));
    setRealizedPnL(realizedPnL + pnl);

    // Dodaj do historii
    setClosedTrades([
      ...closedTrades,
      {
        id: Date.now(),
        percent: closePercentDialog,
        size: sizeToClose.toFixed(2),
        exitPrice: exit,
        pnl: pnl.toFixed(2),
      },
    ]);

    // Reset dialog
    setClosePercentDialog(null);
    setDialogPrice("");

    // Jeśli wszystko zamknięte
    if (newRemaining <= 0.0001) {
      setIsActive(false);
      showNotification("success", `Pozycja pełnie zamknięta ✅ | Razem P&L: ${(realizedPnL + pnl).toFixed(2)}`);
    } else {
      showNotification("success", `Zamknąłeś ${closePercentDialog}% @ ${exit} | P&L: ${pnl.toFixed(2)}`);
    }
  };

  // 📈 CURRENT PRICE & UNREALIZED P&L
  const [currentPrice, setCurrentPrice] = useState("");
  const currentUnrealizedPnL = (() => {
    const current = parseFloat(currentPrice);
    const entry = parseFloat(entryPrice);
    if (!current || !entry || remainingSize === 0) return null;
    const dirSign = direction === "Long" ? 1 : -1;
    return (current - entry) * remainingSize * dirSign;
  })();

  const totalPnL = realizedPnL + (currentUnrealizedPnL || 0);

  const getStatusColor = () => {
    if (!isActive) return "bg-slate-100 dark:bg-slate-800";
    if (totalPnL >= 0) return "bg-emerald-100 dark:bg-emerald-900/20";
    return "bg-rose-100 dark:bg-rose-900/20";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0f0f16] dark:to-[#1a1a2e] p-2 sm:p-3">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg border flex gap-3 items-start shadow-lg animate-in slide-in-from-top ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium flex-1">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-none mx-0 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-1">
            Position Manager
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Prosty menager pozycji handlowych</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Entry Setup */}
          <div className="lg:col-span-2 space-y-6">
            {/* Direction + Entry */}
            <div className={`${getStatusColor()} border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4`}>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isActive ? `${direction} pozycja aktywna` : "1. Nowa pozycja"}
              </h2>

              <div className="flex gap-3">
                <button
                  onClick={() => setDirection("Long")}
                  disabled={isActive}
                  className={`px-6 py-2 rounded-lg font-semibold border transition ${
                    direction === "Long"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  📈 Long
                </button>
                <button
                  onClick={() => setDirection("Short")}
                  disabled={isActive}
                  className={`px-6 py-2 rounded-lg font-semibold border transition ${
                    direction === "Short"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  📉 Short
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Entry Price</label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    disabled={isActive}
                    placeholder="0.0000"
                    className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Size (lots)</label>
                  <input
                    type="number"
                    value={positionSize}
                    onChange={(e) => setPositionSize(e.target.value)}
                    disabled={isActive}
                    placeholder="1.0"
                    className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">SL</label>
                  <input
                    type="number"
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value)}
                    disabled={isActive}
                    placeholder="0.0000"
                    className="w-full h-10 rounded-lg border border-rose-300 dark:border-rose-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">TP</label>
                  <input
                    type="number"
                    value={tpPrice}
                    onChange={(e) => setTpPrice(e.target.value)}
                    disabled={isActive}
                    placeholder="0.0000"
                    className="w-full h-10 rounded-lg border border-emerald-300 dark:border-emerald-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                onClick={handleSetEntry}
                disabled={isActive}
                className="w-full py-3 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                {isActive ? "✓ Pozycja aktywna" : "➕ Ustaw pozycję"}
              </button>
            </div>

            {/* Close Partial */}
            {isActive && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Zamknij część pozycji</h2>

                {closePercentDialog ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 space-y-3">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Zamykasz {closePercentDialog}% ({(remainingSize * closePercentDialog / 100).toFixed(2)} lots)
                    </p>
                    <input
                      type="number"
                      value={dialogPrice}
                      onChange={(e) => setDialogPrice(e.target.value)}
                      placeholder="Exit price"
                      autoFocus
                      className="w-full h-10 rounded-lg border border-blue-300 dark:border-blue-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={confirmClose}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                      >
                        ✅ Potwierdź
                      </button>
                      <button
                        onClick={() => setClosePercentDialog(null)}
                        className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        ❌ Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handleClosePercent(percent)}
                        className={`py-3 rounded-lg font-bold border transition ${
                          percent === 100
                            ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                            : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600"
                        }`}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Closed Trades */}
            {closedTrades.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white">📋 Historia zamknięć</h3>
                <div className="space-y-2">
                  {closedTrades.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-900 rounded-lg"
                    >
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {trade.percent}% @ {trade.exitPrice}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{trade.size} lots</p>
                      </div>
                      <p className={`font-bold ${parseFloat(trade.pnl) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {parseFloat(trade.pnl) > 0 ? "+" : ""}{trade.pnl}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Stats Panel */}
          <div className="space-y-4">
            {isActive && (
              <>
                {/* Remaining Size */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Pozostało</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {remainingSize.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {((remainingSize / parseFloat(positionSize)) * 100).toFixed(0)}%
                  </p>
                </div>

                {/* Current Price */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Cena bieżąca</label>
                  <input
                    type="number"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    placeholder="0.0000"
                    className="w-full mt-2 h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Realized PnL */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Zrealizowany P&L</p>
                  <p
                    className={`text-2xl font-bold ${
                      realizedPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {realizedPnL > 0 ? "+" : ""}{realizedPnL.toFixed(2)}
                  </p>
                </div>

                {/* Unrealized PnL */}
                {currentUnrealizedPnL !== null && (
                  <div className={`${currentUnrealizedPnL >= 0 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700"} border rounded-xl p-4`}>
                    <p className={`text-xs ${currentUnrealizedPnL >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
                      Niezrealizowany P&L
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        currentUnrealizedPnL >= 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      {currentUnrealizedPnL > 0 ? "+" : ""}{currentUnrealizedPnL.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Total PnL */}
                <div
                  className={`${
                    totalPnL >= 0
                      ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700"
                      : "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700"
                  } border rounded-xl p-4`}
                >
                  <p
                    className={`text-xs font-bold ${
                      totalPnL >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    RAZEM P&L
                  </p>
                  <p
                    className={`text-3xl font-bold ${
                      totalPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {totalPnL > 0 ? "+" : ""}{totalPnL.toFixed(2)}
                  </p>
                </div>
              </>
            )}

            {!isActive && (
              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  👈 Wpisz parametry i kliknij "Ustaw pozycję" aby zacząć
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
