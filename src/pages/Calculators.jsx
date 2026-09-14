import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AppWindow,
  Calculator,
  Clock3,
  Copy,
  Crosshair,
  Droplets,
  ExternalLink,
  FileDown,
  FileUp,
  Flame,
  LayoutTemplate,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Pencil,
  Percent,
  PictureInPicture2,
  Plus,
  RotateCcw,
  Search,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QuoteLine from "@/components/QuoteLine";
import {
  openCalculatorPopupWindow,
  openFloatingCalculator,
  openFloatingCalculatorPip,
} from "@/components/calculators/FloatingCalculator";
import MathCalculatorBody from "@/components/calculators/MathCalculatorBody";
import SetupCalculatorBody from "@/components/calculators/SetupCalculatorBody";
import CalculatorWizard from "@/components/calculators/CalculatorWizard";
import { useAuth } from "@/lib/AuthContext";
import {
  emptyAPlusSelection,
  loadAPlusSelection,
  saveAPlusSelection,
  toggleAPlusOption,
} from "@/lib/aPlusConfigScore";
import {
  emptyM1Selection,
  loadM1Selection,
  saveM1Selection,
  toggleM1Option,
} from "@/lib/m1MasteryScore";
import {
  computePositionRisk,
  emptyPosition,
  formatNum,
} from "@/lib/calculatorMath";
import { DEFAULT_GRADES, evaluateSetup, uid } from "@/lib/calculatorScoring";
import {
  MATH_CALCULATORS,
  calculatorFromTemplate,
  displayName,
  emptyCustomCalculator,
  exportHubPayload,
  findCustom,
  getExtra,
  getMathState,
  getRuntime,
  importHubPayload,
  isBuiltinSetup,
  isMathId,
  loadHub,
  saveHub,
  setExtra,
  setMathState,
  setRuntime,
  snapshotAsTemplate,
  subscribeHub,
} from "@/lib/calculatorStore";
import { createTrade, imageFileToDataUrl } from "@/lib/localStorage";
import { cn } from "@/lib/utils";

const ICONS = {
  ListChecks,
  Crosshair,
  Calculator,
  Target,
  Flame,
  Star,
  Clock3,
  Droplets,
  MapPin,
  TrendingUp,
  Wallet,
  Percent,
};

function pipKind(id) {
  return id === "m1" ? "m1" : "aplus";
}

function IconByName({ name, className }) {
  const Cmp = ICONS[name] || Calculator;
  return <Cmp className={className} />;
}

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Calculators() {
  const { user } = useAuth();
  const [hub, setHub] = useState(() => loadHub());
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [savingJournal, setSavingJournal] = useState(false);
  const importRef = useRef(null);
  const [aplusSelection, setAplusSelection] = useState(() => loadAPlusSelection());
  const [m1Selection, setM1Selection] = useState(() => loadM1Selection());

  useEffect(() => subscribeHub(setHub), []);

  useEffect(() => {
    const sync = (e) => {
      if (!e?.detail?.kind || e.detail.kind === "aplus") setAplusSelection(loadAPlusSelection());
      if (!e?.detail?.kind || e.detail.kind === "m1") setM1Selection(loadM1Selection());
    };
    window.addEventListener("aikeeptrade-calc-changed", sync);
    return () => window.removeEventListener("aikeeptrade-calc-changed", sync);
  }, []);

  const selectedId = hub.selectedId || hub.defaultId || "aplus";
  const custom = findCustom(hub, selectedId);
  const extra = getExtra(hub, selectedId);
  const runtime = getRuntime(hub, selectedId);
  const mathState = getMathState(hub, selectedId);
  const isMath = isMathId(selectedId);
  const isSetup = isBuiltinSetup(selectedId) || Boolean(custom);

  const setupKind = selectedId === "aplus" || selectedId === "m1" ? selectedId : "custom";
  const extraConditions = custom ? custom.conditions || [] : extra.conditions || [];
  const extraValues = runtime.values || {};
  const grades = custom?.grades || extra.grades || null;

  const setupScore = useMemo(
    () =>
      evaluateSetup({
        kind: setupKind === "custom" ? "custom" : setupKind,
        aplusSelection,
        m1Selection,
        extraConditions,
        extraValues,
        grades,
      }),
    [setupKind, aplusSelection, m1Selection, extraConditions, extraValues, grades]
  );

  const position = runtime.position || emptyPosition();
  const posRisk = useMemo(
    () =>
      computePositionRisk({
        symbol: position.instrument,
        direction: position.direction,
        balance: position.balance,
        riskPct: position.riskPct,
        entry: position.entry,
        sl: position.sl,
        tp: position.tp,
      }),
    [position]
  );

  const mine = useMemo(() => {
    const items = [
      { id: "aplus", name: displayName(hub, "aplus"), icon: "ListChecks", system: true },
      { id: "m1", name: displayName(hub, "m1"), icon: "Crosshair", system: true },
      ...(hub.custom || []).map((c) => ({ id: c.id, name: c.name, icon: c.icon || "Calculator", system: false })),
    ];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [hub, search]);

  const defaults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MATH_CALCULATORS.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [search]);

  const title = custom?.name || displayName(hub, selectedId);
  const description =
    custom?.description ||
    extra.description ||
    (selectedId === "aplus"
      ? "Sprawdź czy Twój setup spełnia wszystkie warunki. Edytuj parametry, dodawaj własne warunki i dostosuj kalkulator do swojej strategii."
      : selectedId === "m1"
        ? "Extra confluences / entry model na M1."
        : MATH_CALCULATORS.find((c) => c.id === selectedId)?.description || "");

  const persist = (next) => setHub(saveHub(next));

  const selectId = (id) => persist({ ...hub, selectedId: id });

  const toggleFavorite = (id) => {
    persist({ ...hub, favorites: { ...hub.favorites, [id]: !hub.favorites?.[id] } });
  };

  const updateRuntime = (partial) => persist(setRuntime(hub, selectedId, { ...runtime, ...partial }));
  const updatePosition = (partial) => updateRuntime({ position: { ...position, ...partial } });
  const updateExtra = (partial) => persist(setExtra(hub, selectedId, { ...extra, ...partial }));

  const resetPoints = () => {
    if (selectedId === "aplus") {
      const empty = emptyAPlusSelection();
      saveAPlusSelection(empty);
      setAplusSelection(empty);
    } else if (selectedId === "m1") {
      const empty = emptyM1Selection();
      saveM1Selection(empty);
      setM1Selection(empty);
    } else if (custom) {
      updateRuntime({ values: {} });
    } else if (isMath) {
      persist(setMathState(hub, selectedId, {}));
    }
    toast.success("Zresetowano punkty / wartości");
  };

  const duplicateCurrent = (fromId = selectedId) => {
    const srcCustom = findCustom(hub, fromId);
    const srcExtra = getExtra(hub, fromId);
    const srcRuntime = getRuntime(hub, fromId);
    const srcName = srcCustom?.name || displayName(hub, fromId);
    const srcConditions = srcCustom ? srcCustom.conditions || [] : srcExtra.conditions || [];
    const copy = emptyCustomCalculator({
      name: `${srcName} Copy`,
      description: srcCustom?.description || srcExtra.description || "",
      icon: srcCustom?.icon || (fromId === "m1" ? "Crosshair" : "ListChecks"),
      conditions: srcConditions.map((c) => ({ ...c, id: uid("cond") })),
      elements: (srcCustom?.elements || srcExtra.elements || []).map((e) => ({ ...e, id: uid("el") })),
      grades: (srcCustom?.grades || srcExtra.grades || DEFAULT_GRADES).map((g) => ({ ...g })),
      notes: srcCustom?.notes || srcExtra.notes || "",
    });
    persist({
      ...hub,
      custom: [...(hub.custom || []), copy],
      selectedId: copy.id,
      runtime: {
        ...hub.runtime,
        [copy.id]: {
          values: { ...(srcRuntime.values || {}) },
          position: { ...emptyPosition(), ...(srcRuntime.position || {}) },
        },
      },
    });
    toast.success("Utworzono kopię");
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    if (isBuiltinSetup(deleteId) || isMathId(deleteId)) {
      toast.error("Tego kalkulatora nie można usunąć.");
      setDeleteId(null);
      return;
    }
    persist({
      ...hub,
      custom: (hub.custom || []).filter((c) => c.id !== deleteId),
      selectedId: hub.selectedId === deleteId ? hub.defaultId || "aplus" : hub.selectedId,
    });
    setDeleteId(null);
    toast.success("Usunięto kalkulator");
  };

  const applyRename = () => {
    const name = renameValue.trim();
    if (!name || !renameId) return;
    if (isBuiltinSetup(renameId)) {
      persist(setExtra(hub, renameId, { ...getExtra(hub, renameId), name }));
    } else if (!isMathId(renameId)) {
      persist({
        ...hub,
        custom: (hub.custom || []).map((c) => (c.id === renameId ? { ...c, name, updatedAt: Date.now() } : c)),
      });
    }
    setRenameId(null);
  };

  const saveTemplate = () => {
    const calc = custom || {
      name: title,
      description,
      icon: selectedId === "m1" ? "Crosshair" : "ListChecks",
      category: "Setup",
      conditions: extraConditions,
      elements: extra.elements || [],
      grades: grades || DEFAULT_GRADES,
      notes: extra.notes || "",
    };
    persist({ ...hub, templates: [...(hub.templates || []), snapshotAsTemplate(calc, title)] });
    toast.success("Zapisano szablon");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportHubPayload(hub), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aikeeptrade-calculators.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Wyeksportowano konfiguracje");
  };

  const importJson = async (file) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      persist(importHubPayload(hub, payload));
      toast.success("Zaimportowano kalkulatory");
    } catch (err) {
      toast.error(err?.message || "Nie udało się zaimportować");
    }
  };

  const saveToJournal = async () => {
    if (!user?.id) {
      toast.error("Zaloguj się, aby zapisać do dziennika.");
      return;
    }
    if (!position.instrument) {
      toast.error("Podaj instrument.");
      return;
    }
    setSavingJournal(true);
    try {
      const notes = [
        `Kalkulator: ${title}`,
        `Ocena: ${setupScore.gradeLabel} (${setupScore.earned}/${setupScore.max})`,
        setupScore.requiredOk ? "Warunki wymagane: spełnione" : "Warunki wymagane: brakuje",
        `R:R 1:${formatNum(posRisk.rr, 2)} · Lot ${formatNum(posRisk.lots, 2)}`,
        extra.notes || custom?.notes || "",
      ].filter(Boolean).join("\n");
      await createTrade(user.id, {
        symbol: String(position.instrument).toUpperCase(),
        direction: position.direction === "short" ? "Short" : "Long",
        status: "Planned",
        date: todayIso(),
        entry_price: position.entry ? Number(position.entry) : null,
        stop_loss_amount: position.sl ? Number(position.sl) : null,
        take_profit_amount: position.tp ? Number(position.tp) : null,
        position_size: posRisk.lots || null,
        notes,
        calculator_name: title,
        setup_grade: setupScore.gradeLabel,
        setup_score: `${setupScore.earned}/${setupScore.max}`,
        screenshot_1: (custom?.images || extra.images || [])[0] || null,
      });
      toast.success("Zapisano setup do dziennika (Planned)");
    } catch (err) {
      toast.error(err?.message || "Nie udało się zapisać");
    } finally {
      setSavingJournal(false);
    }
  };

  const addImage = async (file) => {
    try {
      const url = await imageFileToDataUrl(file);
      if (custom) {
        persist({
          ...hub,
          custom: hub.custom.map((c) =>
            c.id === custom.id ? { ...c, images: [...(c.images || []), url], updatedAt: Date.now() } : c
          ),
        });
      } else {
        updateExtra({ images: [...(extra.images || []), url] });
      }
    } catch (err) {
      toast.error(err?.message || "Nie udało się dodać obrazu");
    }
  };

  const notesValue = custom?.notes ?? extra.notes ?? "";
  const images = custom?.images || extra.images || [];

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="cyber-page-title flex items-center gap-2">
            <Calculator className="w-7 h-7 text-primary shrink-0" />
            Kalkulatory
          </h1>
          <p className="cyber-page-sub mt-1">
            Narzędzia do analizy, planowania i zarządzania pozycją. Używaj gotowych kalkulatorów lub twórz własne.
          </p>
        </div>
        <QuoteLine className="hidden lg:flex shrink-0" />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => openFloatingCalculatorPip(pipKind(selectedId))}>
          <PictureInPicture2 className="w-3.5 h-3.5" />
          Picture-in-Picture
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openCalculatorPopupWindow(pipKind(selectedId))}>
          <ExternalLink className="w-3.5 h-3.5" />
          Osobne okno
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openFloatingCalculator(pipKind(selectedId))}>
          <AppWindow className="w-3.5 h-3.5" />
          Okienko w aplikacji
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={resetPoints}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset punktów
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_280px] gap-4 items-start">
        <aside className="rounded-2xl border border-border/70 bg-card/60 p-3 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Moje kalkulatory</p>
            <Button type="button" className="w-full gap-1 mb-2" size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Stwórz kalkulator
            </Button>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-xs" placeholder="Szukaj kalkulatora..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ul className="space-y-1">
              {mine.map((item) => (
                <li key={item.id}>
                  <div className={cn("flex items-center gap-1 rounded-lg px-1", selectedId === item.id && "bg-primary/10")}>
                    <button type="button" className="flex-1 flex items-center gap-2 min-w-0 px-2 py-1.5 text-left" onClick={() => selectId(item.id)}>
                      <IconByName name={item.icon} className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate text-sm">{item.name}</span>
                    </button>
                    <button type="button" className="p-1" onClick={() => toggleFavorite(item.id)} aria-label="Ulubione">
                      <Star className={cn("w-3.5 h-3.5", hub.favorites?.[item.id] ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                    </button>
                    <ItemMenu
                      onEdit={() => { selectId(item.id); setSettingsOpen(true); }}
                      onRename={() => { setRenameId(item.id); setRenameValue(item.name); }}
                      onDuplicate={() => duplicateCurrent(item.id)}
                      onDefault={() => persist({ ...hub, defaultId: item.id })}
                      onDelete={item.system ? undefined : () => setDeleteId(item.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Domyślne kalkulatory</p>
            <ul className="space-y-1">
              {defaults.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn("w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm", selectedId === item.id && "bg-primary/10")}
                    onClick={() => selectId(item.id)}
                  >
                    <Calculator className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IconByName name={custom?.icon || (selectedId === "m1" ? "Crosshair" : "ListChecks")} className="w-5 h-5 text-primary" />
                    {title}
                    {custom || isBuiltinSetup(selectedId) ? (
                      <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">Edytowalna</span>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="mt-1">{description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setSettingsOpen(true)}>
                    <Pencil className="w-3.5 h-3.5" /> Edytuj ustawienia
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={saveTemplate}>
                    <LayoutTemplate className="w-3.5 h-3.5" /> Zapisz jako szablon
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={duplicateCurrent}>
                    <Copy className="w-3.5 h-3.5" /> Duplikuj
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTemplatesOpen(true)}>Utwórz z szablonu</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportJson}><FileDown className="w-3.5 h-3.5" /> Eksportuj</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => importRef.current?.click()}><FileUp className="w-3.5 h-3.5" /> Importuj</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isMath ? (
                <MathCalculatorBody
                  id={selectedId}
                  state={mathState}
                  onChange={(next) => persist(setMathState(hub, selectedId, next))}
                />
              ) : (
                <Tabs value={runtime.tab || "conditions"} onValueChange={(tab) => updateRuntime({ tab })}>
                  <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                    <TabsTrigger value="conditions">Warunki setupu</TabsTrigger>
                    <TabsTrigger value="position">Pozycja i ryzyko</TabsTrigger>
                    <TabsTrigger value="result">Wynik i podsumowanie</TabsTrigger>
                    <TabsTrigger value="notes">Notatki</TabsTrigger>
                    <TabsTrigger value="images">Obrazki</TabsTrigger>
                  </TabsList>
                  <TabsContent value="conditions" className="overflow-visible">
                    <SetupCalculatorBody
                      kind={setupKind === "custom" ? "custom" : setupKind}
                      aplusSelection={aplusSelection}
                      m1Selection={m1Selection}
                      extraConditions={extraConditions}
                      extraValues={extraValues}
                      onToggleAplus={(groupId, optionId) => {
                        setAplusSelection((prev) => {
                          const next = toggleAPlusOption(prev, groupId, optionId);
                          saveAPlusSelection(next);
                          return next;
                        });
                      }}
                      onToggleM1={(id) => {
                        setM1Selection((prev) => {
                          const next = toggleM1Option(prev, id);
                          saveM1Selection(next);
                          return next;
                        });
                      }}
                      onExtraValues={(values) => updateRuntime({ values })}
                      onExtraConditions={(conditions) => {
                        if (custom) {
                          persist({
                            ...hub,
                            custom: hub.custom.map((c) => (c.id === custom.id ? { ...c, conditions, updatedAt: Date.now() } : c)),
                          });
                        } else {
                          updateExtra({ conditions });
                        }
                      }}
                    />
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button type="button" variant="outline" size="sm" onClick={() => importRef.current?.click()}>Importuj</Button>
                      <Button type="button" variant="outline" size="sm" onClick={exportJson}>Eksportuj</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={resetPoints}>Resetuj zaznaczenia</Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="position">
                    <PositionFields position={position} onChange={updatePosition} result={posRisk} />
                  </TabsContent>
                  <TabsContent value="result">
                    <ScoreSummary score={setupScore} />
                  </TabsContent>
                  <TabsContent value="notes">
                    <Textarea
                      rows={8}
                      placeholder="Dodaj swoje notatki, obserwacje, screener…"
                      value={notesValue}
                      onChange={(e) => {
                        if (custom) {
                          persist({
                            ...hub,
                            custom: hub.custom.map((c) => (c.id === custom.id ? { ...c, notes: e.target.value, updatedAt: Date.now() } : c)),
                          });
                        } else {
                          updateExtra({ notes: e.target.value });
                        }
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="images">
                    <input
                      type="file"
                      accept="image/*"
                      className="text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addImage(file);
                        e.target.value = "";
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {images.map((src, idx) => (
                        <img key={idx} src={src} alt="" className="rounded-lg border border-border object-cover max-h-40 w-full" />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-3">
          {isSetup && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Wynik setupu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-center">
                  <div className="relative h-28 w-28 rounded-full border-4 border-primary/40 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums">{setupScore.earned}/{setupScore.max || 0}</span>
                    <span className="text-xs text-muted-foreground">
                      {setupScore.max ? Math.round(setupScore.pct) : 0}%
                    </span>
                  </div>
                </div>
                <p className="text-center text-3xl font-bold text-primary">{setupScore.gradeLabel}</p>
                <p className={cn("text-center text-sm font-medium", setupScore.requiredOk ? "text-profit" : "text-amber-400")}>
                  {setupScore.requiredOk ? "Warunki spełnione" : "Warunki nie spełnione"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="Wymagane" value={`${setupScore.requiredMet} / ${setupScore.requiredTotal}`} />
                  <MiniStat label="Opcjonalne" value={`${setupScore.optionalMet} / ${setupScore.optionalTotal}`} />
                  <MiniStat label="Spełnione" value={`${setupScore.checked} / ${setupScore.total}`} />
                  <MiniStat label="Punkty" value={`${setupScore.earned} / ${setupScore.max}`} />
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pozycja i ryzyko</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <PositionFields compact position={position} onChange={updatePosition} result={posRisk} />
              <Button type="button" className="w-full mt-2 gap-1" onClick={saveToJournal} disabled={savingJournal}>
                {savingJournal ? "Zapisywanie…" : "Zapisz do dziennika"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) importJson(file);
        e.target.value = "";
      }} />

      <CalculatorWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(calc) => {
          persist({
            ...hub,
            custom: [...(hub.custom || []), calc],
            selectedId: calc.id,
            favorites: calc.favorite ? { ...hub.favorites, [calc.id]: true } : hub.favorites,
          });
          toast.success("Utworzono kalkulator");
        }}
      />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć kalkulator?</AlertDialogTitle>
            <AlertDialogDescription>Tej operacji nie można cofnąć. Konfiguracja A+ i M1 pozostaną nietknięte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(renameId)} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Zmień nazwę</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Anuluj</Button>
            <Button onClick={applyRename}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        extra={custom ? { ...extra, ...custom, conditions: custom.conditions, grades: custom.grades } : extra}
        onSave={(next) => {
          if (custom) {
            persist({
              ...hub,
              custom: hub.custom.map((c) => (c.id === custom.id ? { ...c, ...next, updatedAt: Date.now() } : c)),
            });
          } else if (isBuiltinSetup(selectedId)) {
            updateExtra(next);
          } else {
            toast.info("Domyślne kalkulatory mają stałe pola — zmień wartości w formularzu.");
          }
          setSettingsOpen(false);
        }}
      />

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Szablony</DialogTitle></DialogHeader>
          <ul className="space-y-2">
            {(hub.templates || []).map((tpl) => (
              <li key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span className="text-sm">{tpl.name}</span>
                <Button size="sm" onClick={() => {
                  const calc = calculatorFromTemplate(tpl);
                  persist({ ...hub, custom: [...hub.custom, calc], selectedId: calc.id });
                  setTemplatesOpen(false);
                  toast.success("Utworzono z szablonu");
                }}>Użyj</Button>
              </li>
            ))}
            {!hub.templates?.length && <p className="text-sm text-muted-foreground">Brak szablonów. Zapisz aktualny kalkulator jako szablon.</p>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemMenu({ onEdit, onRename, onDuplicate, onDefault, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> Edytuj</DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>Zmień nazwę</DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /> Duplikuj</DropdownMenuItem>
        <DropdownMenuItem onClick={onDefault}>Ustaw jako domyślny</DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-loss" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /> Usuń</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreSummary({ score }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">Ocena: <strong>{score.gradeLabel}</strong> · {score.earned}/{score.max} pkt ({Math.round(score.pct || 0)}%)</p>
      <p className="text-sm">{score.requiredOk ? "Wszystkie wymagane warunki są spełnione." : "Brakuje wymaganych warunków — setup nie jest gotowy do wejścia."}</p>
    </div>
  );
}

function PositionFields({ position, onChange, result, compact }) {
  const field = (key, label, extra = {}) => (
    <label className="space-y-1 block">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input className="h-8" value={position[key] ?? ""} onChange={(e) => onChange({ [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {field("instrument", "Instrument")}
        <label className="space-y-1 block">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Kierunek</span>
          <select className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={position.direction || "long"} onChange={(e) => onChange({ direction: e.target.value })}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        {field("balance", "Saldo konta (USD)", { type: "number" })}
        {field("riskPct", "Ryzyko %", { type: "number", step: "0.1" })}
        {field("entry", "Cena wejścia", { type: "number", step: "0.00001" })}
        {field("sl", "Stop Loss", { type: "number", step: "0.00001" })}
        {field("tp", "Take Profit", { type: "number", step: "0.00001" })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Risk $" value={formatNum(result.riskUsd, 2)} />
        <MiniStat label="SL pips" value={formatNum(result.slPips, 1)} />
        <MiniStat label="TP pips" value={formatNum(result.tpPips, 1)} />
        <MiniStat label="Lot" value={formatNum(result.lots, 2)} />
        <MiniStat label="R:R" value={result.rr ? `1:${formatNum(result.rr, 2)}` : "—"} />
        <MiniStat label="Pot. zysk" value={formatNum(result.potentialProfit, 2)} />
      </div>
    </div>
  );
}

function SettingsDialog({ open, onClose, extra, onSave }) {
  const [draft, setDraft] = useState(extra);
  useEffect(() => { if (open) setDraft(extra || {}); }, [open, extra]);
  const grades = Array.isArray(draft?.grades) && draft.grades.length ? draft.grades : null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edytuj ustawienia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs text-muted-foreground">Nazwa</span>
            <Input value={draft?.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs text-muted-foreground">Opis</span>
            <Textarea value={draft?.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
          </label>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Progi ocen (%)</p>
          <div className="space-y-2">
            {(grades || []).map((g, idx) => (
              <div key={g.id || idx} className="grid grid-cols-[80px_1fr_1fr] gap-2">
                <Input value={g.label} onChange={(e) => {
                  const next = grades.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row));
                  setDraft({ ...draft, grades: next });
                }} />
                <Input type="number" value={g.minPct} onChange={(e) => {
                  const next = grades.map((row, i) => (i === idx ? { ...row, minPct: Number(e.target.value) } : row));
                  setDraft({ ...draft, grades: next });
                }} />
                <Input type="number" value={g.maxPct} onChange={(e) => {
                  const next = grades.map((row, i) => (i === idx ? { ...row, maxPct: Number(e.target.value) } : row));
                  setDraft({ ...draft, grades: next });
                }} />
              </div>
            ))}
            {!grades && (
              <p className="text-xs text-muted-foreground">
                Konfiguracja A+ i M1 używają dotychczasowych progów punktowych, dopóki nie włączysz własnych ocen procentowych.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft({
                ...draft,
                grades: [...(grades || DEFAULT_GRADES.map((g) => ({ ...g }))), ...(grades ? [{ id: uid("g"), label: "S", minPct: 101, maxPct: 120 }] : [])],
              })}
            >
              {grades ? "Dodaj ocenę" : "Własne progi C / B / A / A+"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => onSave(draft)}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
