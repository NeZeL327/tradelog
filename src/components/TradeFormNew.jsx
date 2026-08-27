import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { createTrade, updateTrade, getTradingAccounts, getStrategies, persistTradeScreenshot } from "@/lib/localStorage";
import { useLanguage } from "@/components/LanguageProvider";
import { X, Plus, ListChecks, AlertTriangle, Brain, Star } from "lucide-react";
import ImageViewer from "@/components/common/ImageViewer";
import { normalizeDirection } from "@/lib/utils";
import {
  EmotionsInlinePanel,
  createEmptyEmotions,
  normalizeEmotions,
  countFilledEmotionStages,
} from "@/components/EmotionsPanel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getTradeTimeSource, TIMEZONE_OPTIONS } from "@/lib/userSettings";
import { loadTradeTagLists, saveTradeTagLists } from "@/lib/tradeTags";
import EditableTagChips from "@/components/EditableTagChips";

const SCREENSHOT_KEYS = ["screenshot_1", "screenshot_2", "screenshot_3"];
const SELECT_NONE = "__none__";

const fieldClass =
  "h-8 rounded-md border-border/70 bg-muted/30 dark:bg-white/[0.04] px-2.5 text-[12px] shadow-none " +
  "placeholder:text-muted-foreground/55 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40";
const selectTriggerClass =
  "h-8 rounded-md border-border/70 bg-muted/30 dark:bg-white/[0.04] px-2.5 text-[12px] shadow-none " +
  "focus:ring-1 focus:ring-primary/30 justify-start [&>span]:justify-start [&>span]:text-left [&>span]:pr-5";
const labelClass = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 block";
const sectionClass = "rounded-xl border border-border/60 p-2.5 sm:p-3 space-y-2";

function FormSelect({ value, onValueChange, placeholder, children, className, disabled }) {
  const resolved = value === "" || value == null ? SELECT_NONE : String(value);
  return (
    <Select
      value={resolved}
      onValueChange={(v) => onValueChange(v === SELECT_NONE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn(selectTriggerClass, className)}>
        <SelectValue placeholder={placeholder || "—"} />
      </SelectTrigger>
      <SelectContent
        className="bg-card text-card-foreground border-border z-[120]"
        position="popper"
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions
      >
        {children}
      </SelectContent>
    </Select>
  );
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
}

function ScreenshotField({
  slotId,
  label,
  value,
  pending,
  onPickFile,
  onRemove,
  onView,
  addLabel,
  changeLabel,
  removeLabel,
  viewLabel,
  uploadError,
}) {
  return (
    <div>
      <Label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</Label>
      <input
        id={slotId}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        onChange={onPickFile}
      />
      <label
        htmlFor={slotId}
        className="relative flex items-center justify-center h-20 w-full border border-dashed border-border/70 rounded-lg bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition cursor-pointer overflow-hidden"
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            {pending && (
              <div className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-medium text-white bg-blue-600/90 rounded px-1 py-0.5 pointer-events-none">
                Zapisze po „Zapisz”
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-1">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{addLabel}</span>
          </div>
        )}
      </label>
      {uploadError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{uploadError}</p>
      )}
      {value && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={onRemove}>
            {removeLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={onView}>
            {viewLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] px-2" asChild>
            <label htmlFor={slotId} className="cursor-pointer">
              {changeLabel}
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}

const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

export default function TradeFormNew({ trade = null, onSuccess, onClose, defaultStatus = "Open", embedded = false }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [manualPLOvride, setManualPLOvride] = useState(false);
  const [manualOutcomeOverride, setManualOutcomeOverride] = useState(false);
  const [emotionsOpen, setEmotionsOpen] = useState(false);
  const [tagLists, setTagLists] = useState(() => loadTradeTagLists());

  const emptyTradeForm = (status = defaultStatus) => ({
    symbol: "",
    direction: "Long",
    entry_price: "",
    exit_price: "",
    position_size: "",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
    strategy_id: "",
    status,
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
    screenshot_3: "",
    setup_confidence: 0,
    setup_confidence_comment: "",
    emotions: createEmptyEmotions(),
    confluences: [],
    mistakes: [],
    entry_confirmation: false,
  });

  const [formData, setFormData] = useState(() => emptyTradeForm());

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [screenshotErrors, setScreenshotErrors] = useState({});
  const [pendingScreenshotKeys, setPendingScreenshotKeys] = useState(() => new Set());
  const formUid = useId().replace(/:/g, "");
  const tradeInitRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const pendingScreenshotsRef = useRef({});

  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const normalized = typeof value === "string" ? value.replace(",", ".") : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Wczytaj konta i strategie
  useEffect(() => {
    setTagLists(loadTradeTagLists({ cloudSettings: user }));
  }, [user]);

  useEffect(() => {
    const syncTags = () => setTagLists(loadTradeTagLists({ cloudSettings: user }));
    window.addEventListener("user-settings-changed", syncTags);
    return () => window.removeEventListener("user-settings-changed", syncTags);
  }, [user]);

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
    if (!trade?.id) {
      tradeInitRef.current = null;
      return;
    }
    if (tradeInitRef.current === trade.id) return;
    tradeInitRef.current = trade.id;

    const useImportedNetPL = Boolean(trade.fees_included_in_pl && trade.profit_loss != null);
    setManualPLOvride(useImportedNetPL);
    setManualOutcomeOverride(Boolean(trade.outcome));
    setScreenshotErrors({});
    pendingScreenshotsRef.current = {};
    setPendingScreenshotKeys(new Set());
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
      stop_loss_amount: trade.stop_loss_amount != null
        ? String(trade.stop_loss_amount)
        : trade.stop_loss != null ? String(trade.stop_loss) : "",
      take_profit_amount: trade.take_profit_amount != null
        ? String(trade.take_profit_amount)
        : trade.take_profit != null ? String(trade.take_profit) : "",
      commission: trade.commission != null
        ? String(
            trade.commission_operation
              ? (trade.commission_operation === "add" ? Math.abs(Number(trade.commission)) : -Math.abs(Number(trade.commission)))
              : Number(trade.commission)
          )
        : "",
      fees_included_in_pl: Boolean(trade.fees_included_in_pl),
      profit_loss_manual: useImportedNetPL
        ? String(trade.profit_loss)
        : trade.profit_loss_manual != null ? String(trade.profit_loss_manual) : "",
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
      screenshot_3: trade.screenshot_3 || "",
      setup_confidence: Number(trade.setup_confidence) || 0,
      setup_confidence_comment: trade.setup_confidence_comment || "",
      emotions: normalizeEmotions(trade.emotions),
      confluences: Array.isArray(trade.confluences) ? trade.confluences : [],
      mistakes: Array.isArray(trade.mistakes) ? trade.mistakes : [],
      entry_confirmation: Boolean(trade.entry_confirmation),
    });
  }, [trade]);

  const toggleChip = (key, value) => {
    setFormData((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const persistTagLists = async (partial) => {
    setTagLists((prev) => {
      const next = { ...prev, ...partial };
      void saveTradeTagLists({ ...next, userId: user?.id });
      return next;
    });
  };

  const confluenceOptions = useMemo(() => {
    const base = tagLists.confluences || [];
    const extras = (formData.confluences || []).filter(
      (t) => !base.some((b) => String(b).toLowerCase() === String(t).toLowerCase())
    );
    return extras.length ? [...base, ...extras] : base;
  }, [tagLists.confluences, formData.confluences]);

  const mistakeOptions = useMemo(() => {
    const base = tagLists.mistakes || [];
    const extras = (formData.mistakes || []).filter(
      (t) => !base.some((b) => String(b).toLowerCase() === String(t).toLowerCase())
    );
    return extras.length ? [...base, ...extras] : base;
  }, [tagLists.mistakes, formData.mistakes]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  const trackBlobUrl = (url) => {
    if (url?.startsWith('blob:')) {
      blobUrlsRef.current.push(url);
    }
  };

  const revokeBlobUrl = (url) => {
    if (!url?.startsWith('blob:')) return;
    URL.revokeObjectURL(url);
    blobUrlsRef.current = blobUrlsRef.current.filter((item) => item !== url);
  };

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

  const handleScreenshotPick = (fieldName) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!user?.id) {
      setScreenshotErrors((prev) => ({ ...prev, [fieldName]: "Musisz być zalogowany." }));
      return;
    }

    if (!isImageFile(file)) {
      setScreenshotErrors((prev) => ({ ...prev, [fieldName]: "Wybierz plik graficzny (JPG, PNG, WebP)." }));
      return;
    }

    setScreenshotErrors((prev) => ({ ...prev, [fieldName]: null }));
    setError(null);

    setFormData((prev) => {
      revokeBlobUrl(prev[fieldName]);
      return prev;
    });

    const previewUrl = URL.createObjectURL(file);
    trackBlobUrl(previewUrl);
    pendingScreenshotsRef.current[fieldName] = file;
    setPendingScreenshotKeys((prev) => new Set(prev).add(fieldName));

    setFormData((prev) => ({
      ...prev,
      [fieldName]: previewUrl,
    }));
  };

  const resolveScreenshotsForSubmit = async () => {
    const resolved = {};
    for (const key of SCREENSHOT_KEYS) {
      const pendingFile = pendingScreenshotsRef.current[key];
      if (pendingFile) {
        try {
          resolved[key] = await persistTradeScreenshot(user.id, pendingFile);
        } catch (uploadErr) {
          const message = uploadErr?.message || "Nie udało się wysłać zdjęcia.";
          setScreenshotErrors((prev) => ({ ...prev, [key]: message }));
          throw new Error(message);
        }
        revokeBlobUrl(formData[key]);
        pendingScreenshotsRef.current[key] = null;
        continue;
      }

      const current = formData[key];
      resolved[key] = current && !String(current).startsWith("blob:") ? current : null;
    }
    setPendingScreenshotKeys(new Set());
    return resolved;
  };

  const clearScreenshot = (fieldName) => {
    pendingScreenshotsRef.current[fieldName] = null;
    setPendingScreenshotKeys((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
    setFormData((prev) => {
      revokeBlobUrl(prev[fieldName]);
      return { ...prev, [fieldName]: "" };
    });
    setScreenshotErrors((prev) => ({ ...prev, [fieldName]: null }));
  };

  const openViewer = (imageUrl) => {
    if (!imageUrl) return;
    setViewerImage(imageUrl);
    setViewerOpen(true);
  };

  const calculatePL = () => {
    if (formData.status === "Planned" || formData.status === "Missed") {
      return null;
    }

    const commissionAdjustment = formData.fees_included_in_pl ? 0 : (toNumber(formData.commission) || 0);

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

    if ((formData.status === "Closed" || formData.status === "Breakeven") && remainingToClose > 0 && exit !== null) {
      totalRealized += (exit - entry) * remainingToClose * directionSign;
      hasRealizedPart = true;
      remainingToClose = 0;
    }

    if (!hasRealizedPart) {
      if (formData.status === "Breakeven") {
        const finalRealized = commissionAdjustment;
        return {
          profit_loss: finalRealized.toFixed(2),
          profit_loss_percent: "",
          outcome: finalRealized === 0 ? "Breakeven" : finalRealized > 0 ? "Win" : "Loss",
        };
      }
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

  const resolveOutcome = () => {
    if (manualOutcomeOverride && formData.outcome) return formData.outcome;
    return calculatePL()?.outcome || formData.outcome || "";
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

      const isUnexecuted = formData.status === "Planned" || formData.status === "Missed";
      if (!isUnexecuted && (!formData.entry_price || !formData.position_size)) {
        throw new Error(t('requiredFieldsSymbolEntrySize'));
      }

      if (scaleOutSummary.overClosed) {
        throw new Error("Suma zamkniec nie moze byc wieksza niz wielkosc pozycji.");
      }

      const pl = calculatePL();
      const resolvedOutcome =
        manualOutcomeOverride && formData.outcome
          ? formData.outcome
          : pl?.outcome || null;
      const screenshots = await resolveScreenshotsForSubmit();

      const submitData = stripUndefined({
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
        screenshot_1: screenshots.screenshot_1,
        screenshot_2: screenshots.screenshot_2,
        screenshot_3: screenshots.screenshot_3,
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
        }),
        ...(resolvedOutcome && { outcome: resolvedOutcome }),
        confluences: Array.isArray(formData.confluences) ? formData.confluences : [],
        mistakes: Array.isArray(formData.mistakes) ? formData.mistakes : [],
        entry_confirmation: Boolean(formData.entry_confirmation),
      });

      console.log('Submitting trade:', submitData);
      
      const result = trade?.id
        ? await updateTrade(user.id, trade.id, submitData)
        : await createTrade(user.id, submitData);
      
      console.log('Trade created:', result);
      
      if (!trade?.id) {
        setManualOutcomeOverride(false);
        setEmotionsOpen(false);
        setFormData(emptyTradeForm(defaultStatus));
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
    <div className="w-full max-w-4xl mx-auto text-[12px]">
      <div className="flex flex-col lg:flex-row gap-0 items-start">
        {emotionsOpen && (
          <EmotionsInlinePanel
            value={formData.emotions}
            onChange={(next) => setFormData((prev) => ({ ...prev, emotions: next }))}
            setupConfidence={formData.setup_confidence}
            onSetupConfidenceChange={(n) =>
              setFormData((prev) => ({ ...prev, setup_confidence: n }))
            }
            setupConfidenceComment={formData.setup_confidence_comment}
            onSetupConfidenceCommentChange={(comment) =>
              setFormData((prev) => ({ ...prev, setup_confidence_comment: comment }))
            }
            showSetupConfidence={false}
            onClose={() => setEmotionsOpen(false)}
            className="lg:rounded-l-xl lg:rounded-r-none lg:sticky lg:top-2"
          />
        )}

        <Card
          className={cn(
            "flex-1 min-w-0 bg-background dark:bg-card",
            embedded
              ? "border-0 shadow-none"
              : "border border-border/70 shadow-md",
            emotionsOpen && "lg:rounded-l-none"
          )}
        >
          {!embedded && (
            <CardHeader className="border-b border-border/70 py-2.5 px-3 sm:px-4 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent">
              <div className="flex justify-between items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  {trade?.id ? t("editTrade") : t("addTrade")}
                </CardTitle>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-muted-foreground hover:bg-muted/80 p-1 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CardHeader>
          )}

          <CardContent className={embedded ? "p-0" : "p-3 sm:p-4"}>
            {error && (
              <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-[12px]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className={cn(sectionClass, "bg-sky-500/[0.04] dark:bg-sky-400/[0.06] border-sky-500/15")}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/80 dark:text-sky-300/90">Setup</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label className={labelClass}>{t("date")} *</Label>
                  <Input type="date" name="date" value={formData.date} onChange={handleChange} required className={fieldClass} />
                </div>
                <div>
                  <Label className={labelClass}>{t("symbol")} *</Label>
                  <Input
                    type="text"
                    name="symbol"
                    placeholder="EURUSD"
                    value={formData.symbol}
                    onChange={handleChange}
                    required
                    className={cn(fieldClass, "uppercase")}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className={labelClass}>{t("direction")}</Label>
                  <FormSelect
                    value={formData.direction}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, direction: v || "Long" }))}
                    className={cn(
                      formData.direction === "Long" && "text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                      formData.direction === "Short" && "text-rose-700 dark:text-rose-300 border-rose-500/30"
                    )}
                  >
                    <SelectItem value="Long">{t("longLabel") || "Long (kupno)"}</SelectItem>
                    <SelectItem value="Short">{t("shortLabel") || "Short (sprzedaż)"}</SelectItem>
                  </FormSelect>
                </div>
                <div>
                  <Label className={labelClass}>Sesja</Label>
                  <FormSelect
                    value={formData.session}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, session: v }))}
                    placeholder="—"
                  >
                    <SelectItem value={SELECT_NONE}>—</SelectItem>
                    <SelectItem value="Asia">Asia</SelectItem>
                    <SelectItem value="Londyn">Londyn</SelectItem>
                    <SelectItem value="Nowy Jork">Nowy Jork</SelectItem>
                  </FormSelect>
                </div>
                <div>
                  <Label className={labelClass}>{t("timeframe")}</Label>
                  <FormSelect
                    value={formData.timeframe}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, timeframe: v }))}
                    placeholder="—"
                  >
                    <SelectItem value={SELECT_NONE}>—</SelectItem>
                    {["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
                      <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <Label className={labelClass}>{t("strategy")}</Label>
                  <FormSelect
                    value={formData.strategy_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, strategy_id: v }))}
                    placeholder={t("selectStrategyPlaceholder")}
                  >
                    <SelectItem value={SELECT_NONE}>{t("selectStrategyPlaceholder")}</SelectItem>
                    {strategies.map((str) => (
                      <SelectItem key={str.id} value={String(str.id)}>{str.name}</SelectItem>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <Label className={labelClass}>{t("tradingAccount")}</Label>
                  <FormSelect
                    value={formData.account_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, account_id: v }))}
                    placeholder={t("selectAccountPlaceholder")}
                  >
                    <SelectItem value={SELECT_NONE}>{t("selectAccountPlaceholder")}</SelectItem>
                    {availableAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency || "USD"})
                      </SelectItem>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <Label className={labelClass}>{t("statusLabel")}</Label>
                  <FormSelect
                    value={formData.status}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                  >
                    <SelectItem value="Open">{t("openStatus")}</SelectItem>
                    <SelectItem value="Closed">{t("closedStatus")}</SelectItem>
                    <SelectItem value="Breakeven">{t("breakevenStatus")}</SelectItem>
                    <SelectItem value="Planned">{t("plannedStatus")}</SelectItem>
                    <SelectItem value="Missed">{t("missedStatus")}</SelectItem>
                  </FormSelect>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className={labelClass}>{t("entryTime")}</Label>
                  <Input type="time" name="entry_time" value={formData.entry_time} onChange={handleChange} className={fieldClass} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className={labelClass}>{t("exitTime")}</Label>
                  <Input type="time" name="exit_time" value={formData.exit_time} onChange={handleChange} className={fieldClass} />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Godziny w strefie:{" "}
                <span className="font-medium text-foreground/90">
                  {TIMEZONE_OPTIONS.find((o) => o.value === getTradeTimeSource())?.label || getTradeTimeSource()}
                </span>
              </p>
              </div>

              {/* Poziomy cen */}
              {formData.status !== "Planned" && formData.status !== "Missed" && (
                <div className={cn(sectionClass, "bg-violet-500/[0.05] dark:bg-violet-400/[0.07] border-violet-500/20")}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/90">Poziomy cen</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className={labelClass}>{t("entryPrice")} *</Label>
                      <Input type="number" name="entry_price" placeholder="1.1050" step="0.00001" value={formData.entry_price} onChange={handleChange} required className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>{t("stopLossPips")}</Label>
                      <Input type="number" name="stop_loss_pips" placeholder="1.1000" step="0.00001" value={formData.stop_loss_pips} onChange={handleChange} className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>{t("takeProfitPips")}</Label>
                      <Input type="number" name="take_profit_pips" placeholder="1.1150" step="0.00001" value={formData.take_profit_pips} onChange={handleChange} className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>{t("exitPrice")}</Label>
                      <Input type="number" name="exit_price" placeholder="1.1100" step="0.00001" value={formData.exit_price} onChange={handleChange} className={fieldClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className={labelClass}>{t("lotSize")} *</Label>
                      <Input type="number" name="position_size" placeholder="1.0" step="0.01" value={formData.position_size} onChange={handleChange} required className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>Kwota SL</Label>
                      <Input type="number" name="stop_loss_amount" placeholder="150" step="0.01" value={formData.stop_loss_amount} onChange={handleChange} className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>Kwota TP</Label>
                      <Input type="number" name="take_profit_amount" placeholder="300" step="0.01" value={formData.take_profit_amount} onChange={handleChange} className={fieldClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>Commission</Label>
                      <Input type="number" name="commission" placeholder="5" step="0.01" value={formData.commission} onChange={handleChange} className={fieldClass} />
                    </div>
                  </div>
                  {calculateRR() && (
                    <p className="text-xs text-cyan-700 dark:text-cyan-300">
                      Planowany RR: <span className="font-semibold tabular-nums">1 : {calculateRR()}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Wynik */}
              {formData.status !== "Planned" && formData.status !== "Missed" && (
                <div className={cn(sectionClass, "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06] border-emerald-500/15")}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/90">Wynik</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className={labelClass}>{t("outcome")}</Label>
                    <FormSelect
                      value={resolveOutcome() || SELECT_NONE}
                      onValueChange={(v) => {
                        setManualOutcomeOverride(true);
                        setFormData((prev) => ({ ...prev, outcome: v }));
                      }}
                      placeholder={t("outcome")}
                    >
                      <SelectItem value={SELECT_NONE}>{t("outcome")}</SelectItem>
                      <SelectItem value="Win">Win</SelectItem>
                      <SelectItem value="Loss">Loss</SelectItem>
                      <SelectItem value="Breakeven">{t("breakeven")}</SelectItem>
                    </FormSelect>
                    {manualOutcomeOverride && (
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-primary"
                        onClick={() => {
                          setManualOutcomeOverride(false);
                          setFormData((prev) => ({ ...prev, outcome: "" }));
                        }}
                      >
                        Użyj auto-wyniku
                      </button>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Label className={labelClass}>{t("profitLoss")}</Label>
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => applyQuickPnlFromRiskTarget("SL")} className="h-6 px-1.5 text-[10px]">SL</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyQuickPnlFromRiskTarget("TP")} className="h-6 px-1.5 text-[10px]">TP</Button>
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
                      className={fieldClass}
                    />
                    {manualPLOvride && (
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-primary"
                        onClick={() => {
                          setManualPLOvride(false);
                          setFormData((prev) => ({ ...prev, profit_loss_manual: "" }));
                        }}
                      >
                        Użyj auto-wyliczenia P&L
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className={labelClass}>{t("rr")}</Label>
                    <Input type="text" readOnly value={calculateRR() ? `1:${calculateRR()}` : "—"} className={cn(fieldClass, "bg-muted/40")} />
                  </div>
                </div>
                </div>
              )}

              {/* Partial closes — zachowana logika, kompaktowy panel */}
              {formData.status !== "Planned" && formData.status !== "Missed" && (
                <div className={cn(sectionClass, "bg-amber-500/[0.04] dark:bg-amber-400/[0.06] border-amber-500/15")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-300/90">Częściowe zamknięcia</p>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={addScaleOut}>
                      <Plus className="w-3 h-3 mr-1" /> Dodaj
                    </Button>
                  </div>
                  {(formData.scale_outs || []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Brak częściowych zamknięć.</p>
                  )}
                  <div className="space-y-2">
                    {(formData.scale_outs || []).map((item) => {
                      const partialPnl = getScaleOutPnl(item);
                      return (
                        <div key={item.id} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md border border-border/70 p-2">
                          <div>
                            <Label className="text-[10px]">Lot</Label>
                            <Input type="number" step="0.01" value={item.size} onChange={(e) => updateScaleOut(item.id, { size: e.target.value })} className={fieldClass} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Cena</Label>
                            <Input type="number" step="0.00001" value={item.price} onChange={(e) => updateScaleOut(item.id, { price: e.target.value })} className={fieldClass} />
                          </div>
                          <div>
                            <Label className="text-[10px]">P&L</Label>
                            <Input type="number" step="0.01" value={item.pnl || ""} onChange={(e) => updateScaleOut(item.id, { pnl: e.target.value })} className={fieldClass} />
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-8 text-[11px] px-2" onClick={() => removeScaleOut(item.id)}>Usuń</Button>
                          <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
                            Kwota:{" "}
                            <span className={cn("font-semibold", partialPnl == null ? "" : partialPnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {partialPnl == null ? "—" : `${partialPnl.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(formData.scale_outs || []).length > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md border border-border p-2">
                        <div className="text-muted-foreground">Suma</div>
                        <div className="font-semibold">{totalScaleOutSize.toFixed(2)}</div>
                      </div>
                      <div className="rounded-md border border-border p-2">
                        <div className="text-muted-foreground">Pozostało</div>
                        <div className="font-semibold">{remainingSize.toFixed(2)}</div>
                      </div>
                      <div className="rounded-md border border-border p-2">
                        <div className="text-muted-foreground">P&L</div>
                        <div className={cn("font-semibold", scaleOutSummary.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {scaleOutSummary.totalPnl >= 0 ? "+" : ""}{scaleOutSummary.totalPnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                  {scaleOutSummary.overClosed && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300">
                      Suma zamknięć przekracza wielkość pozycji.
                    </div>
                  )}
                  <div className="rounded-md border border-border p-2 space-y-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.breakeven_moved}
                        onChange={(e) => setFormData((prev) => ({ ...prev, breakeven_moved: e.target.checked }))}
                      />
                      Przenieś SL na BE
                    </label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={formData.breakeven_price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, breakeven_price: e.target.value }))}
                      placeholder="Cena BE"
                      className={fieldClass}
                      disabled={!formData.breakeven_moved}
                    />
                  </div>
                </div>
              )}

              <EditableTagChips
                kind="confluences"
                accent="emerald"
                label="Confluencje / warunki wejścia"
                icon={ListChecks}
                options={confluenceOptions}
                selected={formData.confluences}
                onToggle={(tag) => toggleChip("confluences", tag)}
                onOptionsChange={(confluences) => persistTagLists({ confluences })}
                onSelectedChange={(confluences) => setFormData((prev) => ({ ...prev, confluences }))}
              />

              <EditableTagChips
                kind="mistakes"
                accent="rose"
                label="Błędy w zagraniu"
                icon={AlertTriangle}
                options={mistakeOptions}
                selected={formData.mistakes}
                onToggle={(tag) => toggleChip("mistakes", tag)}
                onOptionsChange={(mistakes) => persistTagLists({ mistakes })}
                onSelectedChange={(mistakes) => setFormData((prev) => ({ ...prev, mistakes }))}
              />

              {/* Ocena + emocje */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className={cn(sectionClass, "bg-amber-500/[0.05] border-amber-500/20")}>
                  <Label className={labelClass}>Ocena jakości zagrania</Label>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            setup_confidence: prev.setup_confidence === n ? 0 : n,
                          }))
                        }
                        className="p-0.5 transition-transform hover:scale-110"
                        aria-label={`Ocena ${n}`}
                      >
                        <Star
                          className={cn(
                            "w-5 h-5",
                            n <= formData.setup_confidence
                              ? "fill-amber-400 text-amber-400"
                              : "fill-transparent text-slate-300 dark:text-slate-600"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmotionsOpen((open) => !open)}
                  className={cn(
                    "rounded-xl border p-2.5 transition flex items-center justify-between gap-2 text-left",
                    emotionsOpen
                      ? "border-violet-400 dark:border-violet-600 bg-violet-100 dark:bg-violet-950/50"
                      : "border-violet-300/50 dark:border-violet-800/50 bg-violet-500/[0.07] hover:border-violet-400"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-600 text-white shrink-0">
                      <Brain className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      <span className="block text-[12px] font-semibold text-foreground">Dziennik emocji</span>
                      <span className="block text-[10px] text-muted-foreground">przed · w trakcie · po</span>
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 bg-background/90 rounded-full px-1.5 py-0.5 shrink-0">
                    {countFilledEmotionStages(formData.emotions)}/3
                  </span>
                </button>
              </div>

              <div>
                <Label className={labelClass}>{t("notes")}</Label>
                <Textarea
                  name="notes"
                  placeholder={t("notesPlaceholder") || "dowolne notkiâ€¦"}
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="min-h-[64px] text-[12px] rounded-lg border-border/70 bg-muted/25 dark:bg-white/[0.03]"
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5">
                <Checkbox
                  id={`${formUid}-entry-confirm`}
                  checked={Boolean(formData.entry_confirmation)}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, entry_confirmation: v === true }))
                  }
                />
                <div className="space-y-0.5">
                  <Label htmlFor={`${formUid}-entry-confirm`} className="cursor-pointer font-medium text-[12px]">
                    Potwierdzenie wejścia w transakcję
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Zaznacz, jeśli zapisujesz zgodność z planem wejścia (skrót w tabeli: Wej.).
                  </p>
                </div>
              </div>

              {/* Screenshots */}
              <div className={cn(sectionClass, "bg-slate-500/[0.03] dark:bg-white/[0.02]")}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Screeny — podgląd od razu, wysyłka po „Zapisz”
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SCREENSHOT_KEYS.map((key, idx) => (
                    <ScreenshotField
                      key={key}
                      slotId={`${formUid}-${key}`}
                      label={`${t("screenshot")} ${idx + 1}`}
                      value={formData[key]}
                      pending={pendingScreenshotKeys.has(key)}
                      uploadError={screenshotErrors[key]}
                      onPickFile={handleScreenshotPick(key)}
                      onRemove={() => clearScreenshot(key)}
                      onView={() => openViewer(formData[key])}
                      addLabel={t("add")}
                      changeLabel={t("change")}
                      removeLabel={t("remove")}
                      viewLabel={t("view")}
                    />
                  ))}
                </div>
              </div>

              {(calculatePL() || resolveOutcome()) && (
                <div className="p-2.5 rounded-xl bg-muted/40 text-[12px] border border-border/50">
                  {t("profitLoss")}:{" "}
                  <span className="font-bold">
                    {manualPLOvride ? formData.profit_loss_manual : (calculatePL()?.profit_loss ?? "—")}
                  </span>
                  {resolveOutcome() ? (
                    <>
                      {" · "}
                      {t("outcome")}:{" "}
                      <span
                        className={cn(
                          "font-bold",
                          resolveOutcome() === "Win"
                            ? "text-emerald-600"
                            : resolveOutcome() === "Loss"
                              ? "text-rose-600"
                              : "text-amber-600"
                        )}
                      >
                        {resolveOutcome() === "Breakeven" ? "BE" : resolveOutcome()}
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-border/60">
                {onClose && (
                  <Button type="button" variant="outline" className="h-8 text-[12px]" onClick={onClose}>
                    {t("cancel")}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-8 text-[12px] cyber-primary-btn"
                >
                  {submitting ? t("save") : trade?.id ? t("save") : t("addTrade")}
                </Button>
              </div>
            </form>
            <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

