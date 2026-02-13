import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { createTrade, updateTrade, getTradingAccounts, getStrategies, uploadTradeScreenshot } from "@/lib/localStorage";
import { useLanguage } from "@/components/LanguageProvider";
import { X, Plus } from "lucide-react";
import ImageViewer from "@/components/common/ImageViewer";
import { normalizeDirection } from "@/lib/utils";

const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(2);
};

export default function TradeFormNew({ trade = null, onSuccess, onClose }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    symbol: "",
    direction: "Long",
    entry_price: "",
    exit_price: "",
    position_size: "",
    date: new Date().toISOString().split('T')[0],
    account_id: "",
    strategy_id: "",
    status: "Open",
    outcome: "",
    notes: "",
    entry_time: "",
    exit_time: "",
    stop_loss_pips: "",
    take_profit_pips: "",
    profit_loss_manual: "",
    screenshot_1: "",
    screenshot_2: "",
    screenshot_3: ""
  });

  const [managerOpen, setManagerOpen] = useState(false);
  const [managerData, setManagerData] = useState({
    entry_price: "",
    sl_price: "",
    tp_price: "",
    size: "",
    current_sl: "",
    current_price: "",
    partial_price: "",
    partial_percent: "50",
    close_price: "",
    manual_pnl: ""
  });
  const [managerBaseRisk, setManagerBaseRisk] = useState(null);
  const [managerRemainingSize, setManagerRemainingSize] = useState(0);
  const [managerRealizedPnl, setManagerRealizedPnl] = useState(0);
  const [managerStatus, setManagerStatus] = useState("OPEN");
  const [managerHistory, setManagerHistory] = useState([]);
  const [managerManualPnl, setManagerManualPnl] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [screenshotDirHandle, setScreenshotDirHandle] = useState(null);

  const supportsDirectoryAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

  const ensureScreenshotDirectory = async () => {
    if (!supportsDirectoryAccess()) return;
    try {
      const handle = await window.showDirectoryPicker();
      setScreenshotDirHandle(handle);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error('Directory picker error:', error);
        setError(t('errorSavingTrade'));
      }
    }
  };

  // Wczytaj konta i strategie
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const accountsList = await getTradingAccounts(user.id);
        const strategiesList = await getStrategies(user.id);

        console.log('Loaded accounts:', accountsList);
        console.log('Loaded strategies:', strategiesList);

        setAccounts(accountsList || []);
        setStrategies(strategiesList || []);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(t('loadDataError'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, t]);

  useEffect(() => {
    if (!trade) return;
    setFormData({
      symbol: trade.symbol || "",
      direction: normalizeDirection(trade.direction) || "Long",
      entry_price: trade.entry_price != null ? String(trade.entry_price) : "",
      exit_price: trade.exit_price != null ? String(trade.exit_price) : "",
      position_size: trade.position_size != null ? String(trade.position_size) : "",
      date: trade.date || new Date().toISOString().split('T')[0],
      account_id: trade.account_id != null ? String(trade.account_id) : "",
      strategy_id: trade.strategy_id != null ? String(trade.strategy_id) : "",
      status: trade.status || "Open",
      outcome: trade.outcome || "",
      notes: trade.notes || "",
      entry_time: trade.entry_time || "",
      exit_time: trade.exit_time || "",
      stop_loss_pips: trade.stop_loss_pips != null ? String(trade.stop_loss_pips) : "",
      take_profit_pips: trade.take_profit_pips != null ? String(trade.take_profit_pips) : "",
      profit_loss_manual: trade.profit_loss != null ? String(trade.profit_loss) : "",
      screenshot_1: trade.screenshot_1 || "",
      screenshot_2: trade.screenshot_2 || "",
      screenshot_3: trade.screenshot_3 || ""
    });
  }, [trade]);

  useEffect(() => {
    if (!managerOpen) return;
    setManagerData(prev => ({
      ...prev,
      entry_price: prev.entry_price || formData.entry_price || "",
      sl_price: prev.sl_price || formData.stop_loss_pips || "",
      tp_price: prev.tp_price || formData.take_profit_pips || "",
      size: prev.size || formData.position_size || ""
    }));
  }, [
    managerOpen,
    formData.entry_price,
    formData.stop_loss_pips,
    formData.take_profit_pips,
    formData.position_size
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = async (e) => {
    const { name, files } = e.target;
    const file = files && files[0];

    if (!file) {
      setFormData(prev => ({ ...prev, [name]: "" }));
      return;
    }

    try {
      const url = await uploadTradeScreenshot(user?.id, file);
      setFormData(prev => ({
        ...prev,
        [name]: url || ""
      }));
    } catch (error) {
      console.error('Upload error:', error);
      setError(t('errorSavingTrade'));
    }
  };

  const openViewer = (imageUrl) => {
    if (!imageUrl) return;
    setViewerImage(imageUrl);
    setViewerOpen(true);
  };

  const managerDirectionSign = formData.direction === "Long" ? 1 : -1;
  const managerEntry = parseNumber(managerData.entry_price);
  const managerSl = parseNumber(managerData.sl_price);
  const managerTp = parseNumber(managerData.tp_price);
  const managerSize = parseNumber(managerData.size);
  const managerCurrentPrice = parseNumber(managerData.current_price);
  const managerPartialPrice = parseNumber(managerData.partial_price);
  const managerPartialPercent = parseNumber(managerData.partial_percent);
  const managerClosePrice = parseNumber(managerData.close_price);
  const managerManualValue = parseNumber(managerData.manual_pnl);

  const managerRiskDollar = useMemo(() => {
    if (managerEntry === null || managerSl === null || managerSize === null) return null;
    return Math.abs(managerEntry - managerSl) * managerSize;
  }, [managerEntry, managerSl, managerSize]);

  const managerRiskPercent = useMemo(() => {
    if (!managerEntry || !managerSize || managerRiskDollar === null) return null;
    const positionValue = managerEntry * managerSize;
    if (!positionValue) return null;
    return (managerRiskDollar / positionValue) * 100;
  }, [managerEntry, managerSize, managerRiskDollar]);

  const managerPotentialProfit = useMemo(() => {
    if (managerEntry === null || managerTp === null || managerSize === null) return null;
    return (managerTp - managerEntry) * managerSize * managerDirectionSign;
  }, [managerEntry, managerTp, managerSize, managerDirectionSign]);

  const managerUnrealizedPnl = useMemo(() => {
    if (managerEntry === null || managerCurrentPrice === null || managerRemainingSize === 0) return null;
    return (managerCurrentPrice - managerEntry) * managerRemainingSize * managerDirectionSign;
  }, [managerEntry, managerCurrentPrice, managerRemainingSize, managerDirectionSign]);

  const managerCurrentRR = useMemo(() => {
    const base = managerBaseRisk || (managerEntry !== null && managerSl !== null ? Math.abs(managerEntry - managerSl) : null);
    if (base === null || base === 0 || managerEntry === null || managerCurrentPrice === null) return null;
    return ((managerCurrentPrice - managerEntry) * managerDirectionSign) / base;
  }, [managerBaseRisk, managerEntry, managerSl, managerCurrentPrice, managerDirectionSign]);

  const managerOpenPercent = useMemo(() => {
    if (!managerSize || managerSize === 0) return 0;
    return Math.max(0, Math.min(100, (managerRemainingSize / managerSize) * 100));
  }, [managerRemainingSize, managerSize]);

  const managerFinalPnl = managerManualPnl !== null
    ? managerManualPnl
    : managerRealizedPnl + (managerUnrealizedPnl || 0);

  const addManagerHistory = (entry) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextEntry = typeof entry === "string"
      ? { label: entry, type: "NOTE" }
      : entry;
    setManagerHistory(prev => [{ id: Date.now() + Math.random(), time, ...nextEntry }, ...prev]);
  };

  const updateManagerStatus = (nextRemaining) => {
    if (!managerSize || nextRemaining === 0) {
      setManagerStatus("CLOSED");
      return;
    }
    if (nextRemaining < managerSize) {
      setManagerStatus("PARTIAL");
      return;
    }
    setManagerStatus("OPEN");
  };

  const initializeManagerRemaining = () => {
    if (managerRemainingSize > 0 || managerHistory.length > 0) return managerRemainingSize;
    if (managerEntry === null || managerSize === null) return 0;
    const nextRemaining = managerSize;
    setManagerRemainingSize(nextRemaining);
    setManagerStatus("OPEN");
    if (managerSl !== null) {
      setManagerBaseRisk(Math.abs(managerEntry - managerSl));
      setManagerData(prev => ({
        ...prev,
        current_sl: prev.current_sl || prev.sl_price || ""
      }));
    }
    return nextRemaining;
  };

  const handleManagerSetEntry = () => {
    if (managerEntry === null || managerSize === null) return;
    setManagerRemainingSize(managerSize);
    setManagerBaseRisk(managerSl !== null ? Math.abs(managerEntry - managerSl) : null);
    setManagerData(prev => ({
      ...prev,
      current_sl: prev.current_sl || prev.sl_price || ""
    }));
    setManagerRealizedPnl(0);
    setManagerManualPnl(null);
    setManagerHistory([]);
    setManagerStatus("OPEN");
    addManagerHistory({
      type: "ENTRY",
      label: `${t("entryEvent")} @ ${managerEntry}`,
      meta: { price: managerEntry }
    });
  };

  const handleManagerPartial = (percentOverride) => {
    const percent = percentOverride !== undefined ? percentOverride : managerPartialPercent;
    const activeRemaining = managerRemainingSize > 0 ? managerRemainingSize : initializeManagerRemaining();
    if (managerEntry === null || activeRemaining <= 0 || managerPartialPrice === null) return;
    if (!percent || percent <= 0) return;

    const closedSize = Math.min(activeRemaining, (activeRemaining * percent) / 100);
    if (closedSize <= 0) return;

    const pnl = (managerPartialPrice - managerEntry) * closedSize * managerDirectionSign;
    const nextRemaining = Math.max(0, activeRemaining - closedSize);

    setManagerRealizedPnl(prev => prev + pnl);
    setManagerRemainingSize(nextRemaining);
    updateManagerStatus(nextRemaining);
    addManagerHistory({
      type: "PARTIAL",
      label: `${t("partialEvent")} ${percent}% @ ${managerPartialPrice}`,
      meta: { percent, price: managerPartialPrice }
    });
  };

  const handleManagerSetOneR = () => {
    const base = managerBaseRisk || (managerEntry !== null && managerSl !== null ? Math.abs(managerEntry - managerSl) : null);
    if (!base || managerEntry === null) return;
    const oneR = managerEntry + managerDirectionSign * base;
    setManagerData(prev => ({
      ...prev,
      partial_price: oneR.toFixed(5)
    }));
  };

  const handleManagerMoveSl = (offsetR) => {
    if (managerEntry === null || managerSl === null) return;
    const base = managerBaseRisk || Math.abs(managerEntry - managerSl);
    if (!base) return;
    const newSl = managerEntry + managerDirectionSign * offsetR * base;
    setManagerData(prev => ({ ...prev, current_sl: newSl.toFixed(5) }));
    addManagerHistory({
      type: "SL_MOVE",
      label: `${t("slMovedEvent")} ${newSl.toFixed(5)}`,
      meta: { price: newSl }
    });
  };

  const handleManagerSlBlur = () => {
    const price = parseNumber(managerData.current_sl);
    if (price !== null) {
      addManagerHistory({
        type: "SL_MOVE",
        label: `${t("slMovedEvent")} ${price}`,
        meta: { price }
      });
    }
  };

  const handleManagerFullClose = () => {
    const activeRemaining = managerRemainingSize > 0 ? managerRemainingSize : initializeManagerRemaining();
    if (managerEntry === null || activeRemaining <= 0 || managerClosePrice === null) return;
    const pnl = (managerClosePrice - managerEntry) * activeRemaining * managerDirectionSign;
    setManagerRealizedPnl(prev => prev + pnl);
    setManagerRemainingSize(0);
    setManagerStatus("CLOSED");
    addManagerHistory({
      type: "CLOSE",
      label: `${t("closeEvent")} @ ${managerClosePrice}`,
      meta: { price: managerClosePrice }
    });
  };

  const handleManagerApplyManual = () => {
    if (managerManualValue === null) return;
    setManagerManualPnl(managerManualValue);
    addManagerHistory({
      type: "MANUAL",
      label: t("manualEvent")
    });
  };

  const handleManagerClearManual = () => {
    setManagerManualPnl(null);
    setManagerData(prev => ({ ...prev, manual_pnl: "" }));
  };

  const handleManagerSyncFromForm = () => {
    setManagerData(prev => ({
      ...prev,
      entry_price: formData.entry_price || "",
      sl_price: formData.stop_loss_pips || "",
      tp_price: formData.take_profit_pips || "",
      size: formData.position_size || ""
    }));
  };

  const calculatePL = () => {
    if (formData.status === "Planned") {
      return null;
    }
    if (formData.profit_loss_manual !== "") {
      const manual = parseFloat(formData.profit_loss_manual);
      if (!Number.isNaN(manual)) {
        return {
          profit_loss: manual.toFixed(2),
          profit_loss_percent: "",
          outcome: manual > 0 ? "Win" : manual < 0 ? "Loss" : "Breakeven"
        };
      }
    }
    return null;
  };

  const calculateRR = () => {
    const entry = parseFloat(formData.entry_price);
    const sl = parseFloat(formData.stop_loss_pips);
    const tp = parseFloat(formData.take_profit_pips);
    if ([entry, sl, tp].some(Number.isNaN)) {
      return null;
    }
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (!risk || !reward) {
      return null;
    }
    return (reward / risk).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!user?.id) {
        throw new Error(t('userNotAuthenticated'));
      }

      if (!formData.symbol || !formData.date) {
        throw new Error(t('requiredFieldsSymbolDate'));
      }

      if (formData.status !== "Planned" && (!formData.entry_price || !formData.position_size)) {
        throw new Error(t('requiredFieldsSymbolEntrySize'));
      }

      const pl = calculatePL();
      const historyToSave = managerHistory.length > 0
        ? managerHistory
        : trade?.position_history || [];

      const submitData = {
        ...formData,
        account_id: formData.account_id || null,
        strategy_id: formData.strategy_id || null,
        entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
        exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
        position_size: formData.position_size ? parseFloat(formData.position_size) : null,
        stop_loss_pips: formData.stop_loss_pips ? parseFloat(formData.stop_loss_pips) : null,
        take_profit_pips: formData.take_profit_pips ? parseFloat(formData.take_profit_pips) : null,
        position_history: historyToSave,
        ...(pl && {
          profit_loss: parseFloat(pl.profit_loss),
          profit_loss_percent: pl.profit_loss_percent ? parseFloat(pl.profit_loss_percent) : null,
          outcome: pl.outcome
        })
      };

      console.log('Submitting trade:', submitData);
      
      const result = trade?.id
        ? await updateTrade(user.id, trade.id, submitData)
        : await createTrade(user.id, submitData);
      
      console.log('Trade created:', result);
      
      if (!trade?.id) {
        // Reset form only for new trade
        setFormData({
          symbol: "",
          direction: "Long",
          entry_price: "",
          exit_price: "",
          position_size: "",
          date: new Date().toISOString().split('T')[0],
          account_id: "",
          strategy_id: "",
          status: "Open",
          outcome: "",
          notes: "",
          entry_time: "",
          exit_time: "",
          stop_loss_pips: "",
          take_profit_pips: "",
          profit_loss_manual: "",
          screenshot_1: "",
          screenshot_2: "",
          screenshot_3: ""
        });
      }

      if (onSuccess) {
        onSuccess(result);
      }

      if (onClose) {
        setTimeout(() => onClose(), 500);
      }
    } catch (err) {
      console.error('Error submitting trade:', err);
      setError(err.message || t('errorSavingTrade'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <CardTitle>{trade?.id ? t('editTrade') : t('addTrade')}</CardTitle>
            {onClose && (
              <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account and Strategy Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('tradingAccount')}</Label>
                <select
                  name="account_id"
                  value={formData.account_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectAccountPlaceholder')}</option>
                  {accounts.length === 0 ? (
                    <option disabled>{t('noAccountsAvailable')}</option>
                  ) : (
                    accounts.map(acc => (
                      <option key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency || 'USD'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <Label className="block text-sm font-semibold mb-2">{t('strategy')}</Label>
                <select
                  name="strategy_id"
                  value={formData.strategy_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectStrategyPlaceholder')}</option>
                  {strategies.length === 0 ? (
                    <option disabled>{t('noStrategiesAvailable')}</option>
                  ) : (
                    strategies.map(str => (
                      <option key={str.id} value={String(str.id)}>
                        {str.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Basic Trade Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('symbol')} *</Label>
                <Input
                  type="text"
                  name="symbol"
                  placeholder="EURUSD"
                  value={formData.symbol}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label className="block text-sm font-semibold mb-2">{t('date')} *</Label>
                <Input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label className="block text-sm font-semibold mb-2">{t('direction')}</Label>
                <select
                  name="direction"
                  value={formData.direction}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    formData.direction === 'Long'
                      ? 'bg-emerald-50 text-emerald-700'
                      : formData.direction === 'Short'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-white text-slate-900'
                  }`}
                >
                  <option value="Long">{t('longLabel')}</option>
                  <option value="Short">{t('shortLabel')}</option>
                </select>
              </div>

              <div>
                <Label className="block text-sm font-semibold mb-2">{t('statusLabel')}</Label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Open">{t('openStatus')}</option>
                  <option value="Closed">{t('closedStatus')}</option>
                  <option value="Planned">{t('plannedStatus')}</option>
                </select>
              </div>
            </div>

            {/* Time Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('entryTime')}</Label>
                <Input
                  type="time"
                  name="entry_time"
                  value={formData.entry_time}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('exitTime')}</Label>
                <Input
                  type="time"
                  name="exit_time"
                  value={formData.exit_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Price Info */}
            {formData.status !== 'Planned' && (
              <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="block text-sm font-semibold mb-2">{t('entryPrice')} *</Label>
                    <Input
                      type="number"
                      name="entry_price"
                      placeholder="1.1050"
                      step="0.00001"
                      value={formData.entry_price}
                      onChange={handleChange}
                      required={formData.status !== 'Planned'}
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-semibold mb-2">{t('stopLossPips')}</Label>
                    <Input
                      type="number"
                      name="stop_loss_pips"
                      placeholder="1.1000"
                      step="0.00001"
                      value={formData.stop_loss_pips}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-semibold mb-2">{t('takeProfitPips')}</Label>
                    <Input
                      type="number"
                      name="take_profit_pips"
                      placeholder="1.1150"
                      step="0.00001"
                      value={formData.take_profit_pips}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-semibold mb-2">{t('lotSize')} *</Label>
                    <Input
                      type="number"
                      name="position_size"
                      placeholder="1.0"
                      step="0.01"
                      value={formData.position_size}
                      onChange={handleChange}
                      required={formData.status !== 'Planned'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-semibold mb-2">{t('rr')}</Label>
                    <Input
                      type="text"
                      readOnly
                      value={calculateRR() ? `1:${calculateRR()}` : "-"}
                      className="bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Position Manager */}
            <div className="p-4 bg-slate-50 rounded-lg border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{t('positionManager')}</h3>
                  <p className="text-xs text-slate-500">{t('positionManagerSubtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleManagerSyncFromForm}>
                    {t('useFormValues')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setManagerOpen(prev => !prev)}>
                    {managerOpen ? t('hideManager') : t('openManager')}
                  </Button>
                </div>
              </div>

              {managerOpen && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('entrySection')}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('entryPrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.entry_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, entry_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('slPrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.sl_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, sl_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('tpPrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.tp_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, tp_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('size')}</Label>
                          <Input
                            type="number"
                            value={managerData.size}
                            onChange={(e) => setManagerData(prev => ({ ...prev, size: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        <div className="bg-slate-50 rounded-lg p-2 border">
                          <div className="text-[11px] text-slate-500">{t('riskDollar')}</div>
                          <div className="text-sm font-semibold">{formatMoney(managerRiskDollar)}</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border">
                          <div className="text-[11px] text-slate-500">{t('riskPercent')}</div>
                          <div className="text-sm font-semibold">
                            {managerRiskPercent === null ? "--" : `${managerRiskPercent.toFixed(2)}%`}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border">
                          <div className="text-[11px] text-slate-500">{t('rrLabel')}</div>
                          <div className="text-sm font-semibold">
                            {managerRiskDollar ? (managerPotentialProfit !== null ? (managerPotentialProfit / managerRiskDollar).toFixed(2) : "--") : "--"}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border">
                          <div className="text-[11px] text-slate-500">{t('potentialProfit')}</div>
                          <div className={`text-sm font-semibold ${managerPotentialProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {managerPotentialProfit === null ? "--" : formatMoney(managerPotentialProfit)}
                          </div>
                        </div>
                      </div>

                      <Button type="button" className="mt-3 w-full" onClick={handleManagerSetEntry}>
                        {t('setEntry')}
                      </Button>
                    </div>

                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('slManagement')}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('currentSl')}</Label>
                          <Input
                            type="number"
                            value={managerData.current_sl}
                            onChange={(e) => setManagerData(prev => ({ ...prev, current_sl: e.target.value }))}
                            onBlur={handleManagerSlBlur}
                            placeholder="0.0000"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 items-end">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleManagerMoveSl(0)}>BE</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleManagerMoveSl(0.1)}>+0.1R</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleManagerMoveSl(0.2)}>+0.2R</Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('partialClose')}</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('exitPrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.partial_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, partial_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('partialPercent')}</Label>
                          <Input
                            type="number"
                            value={managerData.partial_percent}
                            onChange={(e) => setManagerData(prev => ({ ...prev, partial_percent: e.target.value }))}
                            placeholder="50"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button type="button" className="w-full" onClick={() => handleManagerPartial()}>
                            {t('applyPartial')}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {[25, 50, 75].map(percent => (
                          <Button key={percent} type="button" variant="outline" size="sm" onClick={() => handleManagerPartial(percent)}>
                            {percent}%
                          </Button>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={handleManagerSetOneR}>
                          {t('oneR')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="border-rose-300 text-rose-700" onClick={() => handleManagerPartial(100)}>
                          {t('closeAll')}
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('fullClose')}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('closePrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.close_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, close_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button type="button" className="w-full" onClick={handleManagerFullClose}>
                            {t('closePosition')}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('manualResult')}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('manualPnl')}</Label>
                          <Input
                            type="number"
                            value={managerData.manual_pnl}
                            onChange={(e) => setManagerData(prev => ({ ...prev, manual_pnl: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button type="button" className="w-full" onClick={handleManagerApplyManual}>
                            {t('useManual')}
                          </Button>
                          <Button type="button" variant="outline" className="w-full" onClick={handleManagerClearManual}>
                            {t('clearManual')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('liveStats')}</div>
                      <div className="space-y-2">
                        <div>
                          <Label className="block text-xs font-semibold mb-1">{t('currentPrice')}</Label>
                          <Input
                            type="number"
                            value={managerData.current_price}
                            onChange={(e) => setManagerData(prev => ({ ...prev, current_price: e.target.value }))}
                            placeholder="0.0000"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 rounded-lg p-2 border">
                            <div className="text-[11px] text-slate-500">{t('realizedPnl')}</div>
                            <div className={`text-sm font-semibold ${managerRealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatMoney(managerRealizedPnl)}
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 border">
                            <div className="text-[11px] text-slate-500">{t('unrealizedPnl')}</div>
                            <div className={`text-sm font-semibold ${managerUnrealizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {managerUnrealizedPnl === null ? "--" : formatMoney(managerUnrealizedPnl)}
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 border">
                            <div className="text-[11px] text-slate-500">{t('positionOpenPercent')}</div>
                            <div className="text-sm font-semibold">{managerOpenPercent.toFixed(0)}%</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 border">
                            <div className="text-[11px] text-slate-500">{t('currentRR')}</div>
                            <div className="text-sm font-semibold">
                              {managerCurrentRR === null ? "--" : managerCurrentRR.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border">
                          <div className="text-[11px] text-slate-500">{t('status')}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{t(`status${managerStatus}`)}</span>
                            <span className={`text-sm font-semibold ${managerFinalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatMoney(managerFinalPnl)}
                            </span>
                          </div>
                          {managerManualPnl !== null && (
                            <div className="text-[11px] text-slate-500 mt-1">{t('manualActive')}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{t('history')}</div>
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {managerHistory.length === 0 && (
                          <div className="text-sm text-slate-500">{t('historyEmpty')}</div>
                        )}
                        {managerHistory.map(item => (
                          <div key={item.id} className="flex items-start justify-between border rounded-lg p-2">
                            <div className="text-sm text-slate-900">{item.label}</div>
                            <div className="text-[11px] text-slate-500">{item.time}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual P&L */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('profitLoss')}</Label>
                <Input
                  type="number"
                  name="profit_loss_manual"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.profit_loss_manual}
                  onChange={handleChange}
                />
              </div>
              <div className="flex items-end text-sm text-slate-500">
                {t('profitLossManualHint')}
              </div>
            </div>

            {/* Notes & Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('notes')}</Label>
                <Textarea
                  name="notes"
                  placeholder={t('notesPlaceholder')}
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                />
              </div>
            </div>

            {/* Screenshots */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await ensureScreenshotDirectory();
                  }}
                  disabled={!supportsDirectoryAccess()}
                >
                  {t('chooseScreenshotFolder')}
                </Button>
                <span className="text-xs text-slate-500">
                  {supportsDirectoryAccess()
                    ? (screenshotDirHandle ? t('folderSelected') : t('folderNotSelected'))
                    : t('folderNotSupported')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('screenshot')} 1</Label>
                <input
                  id="screenshot_1"
                  type="file"
                  name="screenshot_1"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="screenshot_1"
                  className="relative flex items-center justify-center h-28 border-2 border-dashed border-slate-300 rounded-lg bg-white hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer overflow-hidden"
                >
                  {formData.screenshot_1 ? (
                    <img
                      src={formData.screenshot_1}
                      alt="Screenshot 1"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{t('add')}</span>
                    </div>
                  )}
                  {formData.screenshot_1 && (
                    <div className="absolute inset-0 bg-black/20" />
                  )}
                </label>
                {formData.screenshot_1 && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, screenshot_1: "" }))}
                    >
                      {t('remove')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openViewer(formData.screenshot_1)}
                    >
                      {t('view')}
                    </Button>
                    <label
                      htmlFor="screenshot_1"
                      className="inline-flex items-center justify-center px-3 py-1 text-sm border rounded-md cursor-pointer hover:bg-slate-50"
                    >
                      {t('change')}
                    </label>
                  </div>
                )}
              </div>
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('screenshot')} 2</Label>
                <input
                  id="screenshot_2"
                  type="file"
                  name="screenshot_2"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="screenshot_2"
                  className="relative flex items-center justify-center h-28 border-2 border-dashed border-slate-300 rounded-lg bg-white hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer overflow-hidden"
                >
                  {formData.screenshot_2 ? (
                    <img
                      src={formData.screenshot_2}
                      alt="Screenshot 2"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{t('add')}</span>
                    </div>
                  )}
                  {formData.screenshot_2 && (
                    <div className="absolute inset-0 bg-black/20" />
                  )}
                </label>
                {formData.screenshot_2 && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, screenshot_2: "" }))}
                    >
                      {t('remove')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openViewer(formData.screenshot_2)}
                    >
                      {t('view')}
                    </Button>
                    <label
                      htmlFor="screenshot_2"
                      className="inline-flex items-center justify-center px-3 py-1 text-sm border rounded-md cursor-pointer hover:bg-slate-50"
                    >
                      {t('change')}
                    </label>
                  </div>
                )}
              </div>
              <div>
                <Label className="block text-sm font-semibold mb-2">{t('screenshot')} 3</Label>
                <input
                  id="screenshot_3"
                  type="file"
                  name="screenshot_3"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="screenshot_3"
                  className="relative flex items-center justify-center h-28 border-2 border-dashed border-slate-300 rounded-lg bg-white hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer overflow-hidden"
                >
                  {formData.screenshot_3 ? (
                    <img
                      src={formData.screenshot_3}
                      alt="Screenshot 3"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{t('add')}</span>
                    </div>
                  )}
                  {formData.screenshot_3 && (
                    <div className="absolute inset-0 bg-black/20" />
                  )}
                </label>
                {formData.screenshot_3 && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, screenshot_3: "" }))}
                    >
                      {t('remove')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openViewer(formData.screenshot_3)}
                    >
                      {t('view')}
                    </Button>
                    <label
                      htmlFor="screenshot_3"
                      className="inline-flex items-center justify-center px-3 py-1 text-sm border rounded-md cursor-pointer hover:bg-slate-50"
                    >
                      {t('change')}
                    </label>
                  </div>
                )}
              </div>
            </div>
            </div>

            {/* P&L Preview */}
            {calculatePL() && (
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-600">
                  {t('profitLoss')}: <span className={calculatePL().outcome === 'Win' ? 'text-green-600 font-bold' : calculatePL().outcome === 'Loss' ? 'text-red-600 font-bold' : 'text-gray-600 font-bold'}>
                    {calculatePL().outcome}
                  </span>
                </p>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('cancel')}
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {submitting ? t('save') : trade?.id ? t('save') : t('addTrade')}
              </Button>
            </div>
          </form>
          <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />
        </CardContent>
      </Card>
    </div>
  );
}
