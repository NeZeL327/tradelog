import { useEffect, useMemo, useState } from "react";
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

export default function TradeFormNew({ trade = null, onSuccess, onClose }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [manualPLOvride, setManualPLOvride] = useState(false);

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
    timeframe: "",
    session: "",
    stop_loss_pips: "",
    take_profit_pips: "",
    stop_loss_amount: "",
    take_profit_amount: "",
    commission: "",
    profit_loss_manual: "",
    scale_outs: [],
    breakeven_moved: false,
    breakeven_price: "",
    screenshot_1: "",
    screenshot_2: "",
    screenshot_3: ""
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [screenshotDirHandle, setScreenshotDirHandle] = useState(null);

  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const normalized = typeof value === "string" ? value.replace(",", ".") : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

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
    setManualPLOvride(false);
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
      timeframe: trade.timeframe || "",
      session: trade.session || "",
      stop_loss_pips: trade.stop_loss_pips != null ? String(trade.stop_loss_pips) : "",
      take_profit_pips: trade.take_profit_pips != null ? String(trade.take_profit_pips) : "",
      stop_loss_amount: trade.stop_loss_amount != null ? String(trade.stop_loss_amount) : "",
      take_profit_amount: trade.take_profit_amount != null ? String(trade.take_profit_amount) : "",
      commission: trade.commission != null
        ? String(
            trade.commission_operation
              ? (trade.commission_operation === "add" ? Math.abs(Number(trade.commission)) : -Math.abs(Number(trade.commission)))
              : Number(trade.commission)
          )
        : "",
      profit_loss_manual: trade.profit_loss_manual != null ? String(trade.profit_loss_manual) : "",
      scale_outs: Array.isArray(trade.scale_outs) ? trade.scale_outs.map((item) => ({
        id: item.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        size: item.size != null ? String(item.size) : "",
        price: item.price != null ? String(item.price) : "",
        pnl: item.pnl != null ? String(item.pnl) : ""
      })) : [],
      breakeven_moved: Boolean(trade.breakeven_moved),
      breakeven_price: trade.breakeven_price != null ? String(trade.breakeven_price) : "",
      screenshot_1: trade.screenshot_1 || "",
      screenshot_2: trade.screenshot_2 || "",
      screenshot_3: trade.screenshot_3 || ""
    });
  }, [trade]);

  const addScaleOut = () => {
    setFormData(prev => ({
      ...prev,
      scale_outs: [...(prev.scale_outs || []), { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, size: "", price: "", pnl: "" }]
    }));
  };

  const updateScaleOut = (id, patch) => {
    setFormData(prev => ({
      ...prev,
      scale_outs: (prev.scale_outs || []).map(item => item.id === id ? { ...item, ...patch } : item)
    }));
  };

  const removeScaleOut = (id) => {
    setFormData(prev => ({
      ...prev,
      scale_outs: (prev.scale_outs || []).filter(item => item.id !== id)
    }));
  };

  const totalScaleOutSize = useMemo(() => {
    return (formData.scale_outs || []).reduce((sum, item) => sum + (toNumber(item.size) || 0), 0);
  }, [formData.scale_outs]);

  const remainingSize = useMemo(() => {
    const total = toNumber(formData.position_size) || 0;
    return Math.max(0, total - totalScaleOutSize);
  }, [formData.position_size, totalScaleOutSize]);

  const scaleOutSummary = useMemo(() => {
    const entry = toNumber(formData.entry_price);
    const totalPosition = toNumber(formData.position_size) || 0;
    const directionSign = normalizeDirection(formData.direction) === "Short" ? -1 : 1;

    let remainingToClose = totalPosition;
    let effectiveClosedSize = 0;
    let totalPnl = 0;
    let hasPnlParts = false;

    for (const item of (formData.scale_outs || [])) {
      const rawSize = toNumber(item.size);
      if (rawSize === null || rawSize <= 0) continue;

      const effectiveSize = Math.max(0, Math.min(rawSize, remainingToClose));
      remainingToClose -= effectiveSize;
      effectiveClosedSize += effectiveSize;

      const manualPartialPnl = toNumber(item.pnl);
      if (manualPartialPnl !== null) {
        totalPnl += manualPartialPnl;
        hasPnlParts = true;
        continue;
      }

      const partialExit = toNumber(item.price);
      if (entry !== null && partialExit !== null && effectiveSize > 0) {
        totalPnl += (partialExit - entry) * effectiveSize * directionSign;
        hasPnlParts = true;
      }
    }

    return {
      totalPnl,
      hasPnlParts,
      remainingToClose,
      overClosed: totalScaleOutSize > totalPosition + 0.000001,
    };
  }, [formData.scale_outs, formData.entry_price, formData.position_size, formData.direction, totalScaleOutSize]);

  const getScaleOutPnl = (item) => {
    const manualPnl = toNumber(item.pnl);
    if (manualPnl !== null) return manualPnl;
    const size = toNumber(item.size);
    const price = toNumber(item.price);
    const entry = toNumber(formData.entry_price);
    if (size === null || price === null || entry === null) return null;
    const directionSign = normalizeDirection(formData.direction) === "Short" ? -1 : 1;
    return (price - entry) * size * directionSign;
  };

  const applyQuickPnlFromRiskTarget = (type) => {
    const slAmount = toNumber(formData.stop_loss_amount);
    const tpAmount = toNumber(formData.take_profit_amount);

    if (type === "SL") {
      if (slAmount === null) {
        setError("Uzupelnij najpierw Kwota SL.");
        return;
      }
      setManualPLOvride(true);
      setError(null);
      setFormData(prev => ({ ...prev, profit_loss_manual: (-Math.abs(slAmount)).toFixed(2) }));
      return;
    }

    if (type === "TP") {
      if (tpAmount === null) {
        setError("Uzupelnij najpierw Kwota TP.");
        return;
      }
      setManualPLOvride(true);
      setError(null);
      setFormData(prev => ({ ...prev, profit_loss_manual: Math.abs(tpAmount).toFixed(2) }));
    }
  };

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

  const calculatePL = () => {
    if (formData.status === "Planned") {
      return null;
    }

    const commissionAdjustment = toNumber(formData.commission) || 0;

    if (manualPLOvride && formData.profit_loss_manual !== "") {
      const manual = parseFloat(formData.profit_loss_manual);
      if (!Number.isNaN(manual)) {
        const finalManual = manual + commissionAdjustment;
        return {
          profit_loss: finalManual.toFixed(2),
          profit_loss_percent: "",
          outcome: finalManual > 0 ? "Win" : finalManual < 0 ? "Loss" : "Breakeven"
        };
      }
    }

    const entry = toNumber(formData.entry_price);
    const totalSize = toNumber(formData.position_size);
    const exit = toNumber(formData.exit_price);

    if (entry === null || totalSize === null || totalSize <= 0) {
      return null;
    }

    const directionSign = normalizeDirection(formData.direction) === "Short" ? -1 : 1;
    let remainingToClose = scaleOutSummary.remainingToClose;
    let totalRealized = scaleOutSummary.totalPnl;
    let hasRealizedPart = scaleOutSummary.hasPnlParts;

    if (formData.status === "Closed" && remainingToClose > 0 && exit !== null) {
      totalRealized += (exit - entry) * remainingToClose * directionSign;
      hasRealizedPart = true;
      remainingToClose = 0;
    }

    if (!hasRealizedPart) {
      return null;
    }

    const finalRealized = totalRealized + commissionAdjustment;

    return {
      profit_loss: finalRealized.toFixed(2),
      profit_loss_percent: "",
      outcome: finalRealized > 0 ? "Win" : finalRealized < 0 ? "Loss" : "Breakeven"
    };
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

      if (scaleOutSummary.overClosed) {
        throw new Error("Suma zamkniec nie moze byc wieksza niz wielkosc pozycji.");
      }

      const pl = calculatePL();

      const submitData = {
        ...formData,
        account_id: formData.account_id || null,
        strategy_id: formData.strategy_id || null,
        entry_price: toNumber(formData.entry_price),
        exit_price: toNumber(formData.exit_price),
        position_size: toNumber(formData.position_size),
        stop_loss_pips: toNumber(formData.stop_loss_pips),
        take_profit_pips: toNumber(formData.take_profit_pips),
        stop_loss_amount: toNumber(formData.stop_loss_amount),
        take_profit_amount: toNumber(formData.take_profit_amount),
        timeframe: formData.timeframe || null,
        session: formData.session || null,
        commission: toNumber(formData.commission),
        scale_outs: (formData.scale_outs || []).map(item => ({
          id: item.id,
          size: toNumber(item.size),
          price: toNumber(item.price),
          pnl: toNumber(item.pnl)
        })),
        profit_loss_manual: manualPLOvride ? toNumber(formData.profit_loss_manual) : null,
        breakeven_moved: Boolean(formData.breakeven_moved),
        breakeven_price: toNumber(formData.breakeven_price),
        remaining_size: remainingSize,
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
          timeframe: "",
          session: "",
          stop_loss_pips: "",
          take_profit_pips: "",
          stop_loss_amount: "",
          take_profit_amount: "",
          commission: "",
          profit_loss_manual: "",
          scale_outs: [],
          breakeven_moved: false,
          breakeven_price: "",
          screenshot_1: "",
          screenshot_2: "",
          screenshot_3: ""
        });
        setManualPLOvride(false);
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

  const availableAccounts = accounts.filter((acc) => {
    const isCurrent = String(acc.id) === String(formData.account_id);
    const isActive = acc.is_active !== false && acc.status !== "Inactive";
    return isCurrent || isActive;
  });

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border border-slate-200/80 shadow-xl shadow-slate-900/5 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-100 border-b border-slate-700/80 rounded-none">
          <div className="flex justify-between items-center">
            <CardTitle>{trade?.id ? t('editTrade') : t('addTrade')}</CardTitle>
            {onClose && (
              <button onClick={onClose} className="text-slate-200 hover:bg-white/10 p-1 rounded">
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
                  {availableAccounts.length === 0 ? (
                    <option disabled>{t('noAccountsAvailable')}</option>
                  ) : (
                    availableAccounts.map(acc => (
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

              <div>
                <Label className="block text-sm font-semibold mb-2">{t('timeframe')}</Label>
                <select
                  name="timeframe"
                  value={formData.timeframe}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz interwał</option>
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>

              <div>
                <Label className="block text-sm font-semibold mb-2">Sesja</Label>
                <select
                  name="session"
                  value={formData.session}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz sesję</option>
                  <option value="Asia">Asia</option>
                  <option value="Londyn">Londyn</option>
                  <option value="Nowy Jork">Nowy Jork</option>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <Label className="block text-sm font-semibold mb-2">{t('exitPrice')}</Label>
                    <Input
                      type="number"
                      name="exit_price"
                      placeholder="1.1100"
                      step="0.00001"
                      value={formData.exit_price}
                      onChange={handleChange}
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
                    <Label className="block text-sm font-semibold mb-2">Kwota SL</Label>
                    <Input
                      type="number"
                      name="stop_loss_amount"
                      placeholder="np. 150"
                      step="0.01"
                      value={formData.stop_loss_amount}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-semibold mb-2">Kwota TP</Label>
                    <Input
                      type="number"
                      name="take_profit_amount"
                      placeholder="np. 300"
                      step="0.01"
                      value={formData.take_profit_amount}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-semibold mb-2">Commission</Label>
                    <Input
                      type="number"
                      name="commission"
                      placeholder="np. 5"
                      step="0.01"
                      value={formData.commission}
                      onChange={handleChange}
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

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Częściowe zamknięcia pozycji</p>
                      <p className="text-xs text-slate-500">Wpisz czesciowe zamkniecia i automatycznie policz pozostala pozycje.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addScaleOut}>
                      <Plus className="w-4 h-4 mr-1" /> Dodaj czesc
                    </Button>
                  </div>

                  {(formData.scale_outs || []).length === 0 && (
                    <div className="text-xs text-slate-500">Brak czesciowych zamkniec.</div>
                  )}

                  <div className="space-y-2">
                    {(formData.scale_outs || []).map((item, index) => {
                      const partialPnl = getScaleOutPnl(item);
                      return (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_1.1fr_1fr_auto] gap-2 items-end rounded-md border border-slate-200 p-2">
                        <div>
                          <Label className="text-xs">Zamknieta wielkosc (lot)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.size}
                            onChange={(e) => updateScaleOut(item.id, { size: e.target.value })}
                            placeholder="np. 1.0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cena zamkniecia</Label>
                          <Input
                            type="number"
                            step="0.00001"
                            value={item.price}
                            onChange={(e) => updateScaleOut(item.id, { price: e.target.value })}
                            placeholder="np. 1.1055"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Kwota P&L (opcjonalnie)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.pnl || ""}
                            onChange={(e) => updateScaleOut(item.id, { pnl: e.target.value })}
                            placeholder="np. 50"
                          />
                        </div>
                        <Button type="button" variant="ghost" onClick={() => removeScaleOut(item.id)}>
                          Usun
                        </Button>
                        <div className="md:col-span-4 text-sm">
                          Kwota zamknięcia: <span className={`font-semibold ${partialPnl === null ? 'text-slate-500 dark:text-slate-400' : partialPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {partialPnl === null ? '-' : `${partialPnl.toFixed(2)}$`}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-md border border-slate-200 p-2 text-sm">
                      <div className="text-xs text-slate-500">Suma zamkniec</div>
                      <div className="font-semibold text-slate-800">{totalScaleOutSize.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2 text-sm">
                      <div className="text-xs text-slate-500">Pozostala pozycja</div>
                      <div className="font-semibold text-slate-800">{remainingSize.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2 text-sm">
                      <div className="text-xs text-slate-500">Suma P&L zamkniec</div>
                      <div className={`font-semibold ${scaleOutSummary.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {scaleOutSummary.totalPnl >= 0 ? '+' : ''}{scaleOutSummary.totalPnl.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {scaleOutSummary.overClosed && (
                    <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                      Suma zamkniec przekracza wielkosc pozycji. Zmniejsz loty w partialach.
                    </div>
                  )}

                  <div className="mt-3 rounded-md border border-slate-200 p-2 text-sm">
                      <div className="text-xs text-slate-500">BE / ochrona</div>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={formData.breakeven_moved}
                          onChange={(e) => setFormData(prev => ({ ...prev, breakeven_moved: e.target.checked }))}
                        />
                        Przenies SL na BE
                      </label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={formData.breakeven_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, breakeven_price: e.target.value }))}
                        placeholder="Cena BE (opcjonalnie)"
                        className="mt-2"
                        disabled={!formData.breakeven_moved}
                      />
                    </div>
                  </div>
                </div>
            )}

            {/* Manual P&L */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="block text-sm font-semibold">{t('profitLoss')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickPnlFromRiskTarget("SL")}
                      className="h-7 px-2 text-xs"
                    >
                      SL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickPnlFromRiskTarget("TP")}
                      className="h-7 px-2 text-xs"
                    >
                      TP
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  name="profit_loss_manual"
                  placeholder="0.00"
                  step="0.01"
                  value={manualPLOvride ? formData.profit_loss_manual : (calculatePL()?.profit_loss || "")}
                  onChange={(e) => {
                    setManualPLOvride(true);
                    handleChange(e);
                  }}
                />
                {manualPLOvride && (
                  <button
                    type="button"
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      setManualPLOvride(false);
                      setFormData(prev => ({ ...prev, profit_loss_manual: "" }));
                    }}
                  >
                    Uzyj auto-wyliczenia P&L
                  </button>
                )}
              </div>
              <div className="flex items-end text-sm text-slate-500">
                {manualPLOvride ? t('profitLossManualHint') : 'Auto: wartosc aktualizuje sie na podstawie wszystkich czesci zamkniec i commission.'}
              </div>
            </div>

            {/* Notes & Tags */}
            <div className="p-4 bg-white rounded-lg border">
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
