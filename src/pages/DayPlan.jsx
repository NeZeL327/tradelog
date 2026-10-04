import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { getTradingAccounts } from "@/lib/localStorage";
import { isTradingAccountActive, cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import {
  applyTemplateToPlan,
  createId,
  CHECKLIST_STAGES,
  checklistProgress,
  DAY_PLAN_STATUSES,
  DAY_PLAN_STATUS_LABELS,
  emptyDayPlan,
  formatIsoDisplay,
  groupChecklistByStage,
  MOOD_OPTIONS,
  planHasContent,
  planToTemplatePayload,
  PROCESS_GOALS,
  shiftIsoDate,
  todayIso,
  validatePlanParameters,
} from "@/lib/dayPlanModel";
import {
  createDayPlanTemplate,
  deleteDayPlan,
  deleteDayPlanTemplate,
  duplicateDayPlanTemplate,
  getDayPlan,
  HEADER_ACCOUNT_STORAGE_KEY,
  listDayPlans,
  listDayPlanTemplates,
  saveDayPlan,
} from "@/lib/dayPlanStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const AUTOSAVE_MS = 1200;

function statusLabel(status, language) {
  const row = DAY_PLAN_STATUS_LABELS[status] || DAY_PLAN_STATUS_LABELS.draft;
  return language === "en" ? row.en : row.pl;
}

function CharCount({ value, max }) {
  const len = String(value || "").length;
  return (
    <span className="text-[11px] tabular-nums text-muted-foreground">
      {len}/{max}
    </span>
  );
}

function SectionCard({ title, children, className }) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function DayPlan() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = language === "en" ? "en" : "pl";

  const [tab, setTab] = useState(searchParams.get("tab") || "day");
  const [date, setDate] = useState(searchParams.get("date") || todayIso());
  const [accountId, setAccountId] = useState(searchParams.get("account") || "");
  const [plan, setPlan] = useState(null);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [quickNote, setQuickNote] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckStage, setNewCheckStage] = useState("plan");
  const [templateName, setTemplateName] = useState("");
  const [historyFilters, setHistoryFilters] = useState({ accountId: "all", status: "all", from: "", to: "" });
  const [confirm, setConfirm] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const autosaveRef = useRef(null);
  const skipDirtyRef = useRef(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user.id),
    enabled: !!user?.id,
  });
  const activeAccounts = useMemo(() => accounts.filter(isTradingAccountActive), [accounts]);

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["dayPlanTemplates", user?.id],
    queryFn: () => listDayPlanTemplates(user.id),
    enabled: !!user?.id,
  });

  const { data: history = [], refetch: refetchHistory, isFetching: historyLoading } = useQuery({
    queryKey: ["dayPlansHistory", user?.id, historyFilters],
    queryFn: () =>
      listDayPlans(user.id, {
        accountId: historyFilters.accountId === "all" ? "" : historyFilters.accountId,
        status: historyFilters.status === "all" ? "" : historyFilters.status,
        from: historyFilters.from || "",
        to: historyFilters.to || "",
      }),
    enabled: !!user?.id && tab === "history",
  });

  useEffect(() => {
    if (!user?.id || !activeAccounts.length) return;
    if (accountId && activeAccounts.some((a) => String(a.id) === String(accountId))) return;
    const saved = localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id));
    const pick = activeAccounts.find((a) => String(a.id) === String(saved)) || activeAccounts[0];
    setAccountId(String(pick.id));
  }, [user?.id, activeAccounts, accountId]);

  useEffect(() => {
    if (!user?.id || !accountId) return;
    localStorage.setItem(HEADER_ACCOUNT_STORAGE_KEY(user.id), accountId);
  }, [user?.id, accountId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("date", date);
    if (accountId) next.set("account", accountId);
    if (tab !== "day") next.set("tab", tab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [date, accountId, tab]);

  const dirty = useMemo(() => {
    if (!plan) return false;
    return JSON.stringify(plan) !== baseline;
  }, [plan, baseline]);

  const loadPlan = useCallback(async () => {
    if (!user?.id || !accountId || !date) return;
    setLoading(true);
    try {
      const existing = await getDayPlan(user.id, accountId, date);
      const next = existing || emptyDayPlan({ accountId, date, language: lang });
      skipDirtyRef.current = true;
      setPlan(next);
      setBaseline(JSON.stringify(next));
      setSaveState("idle");
    } catch (err) {
      toast.error(err?.message || t("dayPlanLoadError") || "Nie udało się wczytać planu.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, accountId, date, lang, t]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const persist = useCallback(async (nextPlan, { silent = false } = {}) => {
    if (!user?.id || !nextPlan) return false;
    const errors = validatePlanParameters(nextPlan.parameters);
    if (errors.length) {
      setSaveState("error");
      if (!silent) toast.error(t("dayPlanValidationError") || "Sprawdź limit transakcji i ryzyko (0–100).");
      return false;
    }
    setSaveState("saving");
    try {
      const saved = await saveDayPlan(user.id, nextPlan);
      setPlan(saved);
      setBaseline(JSON.stringify(saved));
      setSavedAt(new Date());
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["dayPlansHistory", user.id] });
      if (!silent) toast.success(t("dayPlanSaved") || "Plan zapisany");
      return true;
    } catch (err) {
      setSaveState("error");
      toast.error(err?.message || t("dayPlanSaveError") || "Zapis nie powiódł się.");
      return false;
    }
  }, [user?.id, t, queryClient]);

  useEffect(() => {
    if (!plan || !dirty || skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return undefined;
    }
    setSaveState("dirty");
    clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      persist(plan, { silent: true });
    }, AUTOSAVE_MS);
    return () => clearTimeout(autosaveRef.current);
  }, [plan, dirty, persist]);

  const patchPlan = (updater) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
    });
  };

  const requestContextChange = (action) => {
    if (dirty) {
      setPendingNav(() => action);
      setConfirm({ type: "unsaved" });
      return;
    }
    action();
  };

  const selectedAccount = activeAccounts.find((a) => String(a.id) === String(accountId));

  const saveStatusText = () => {
    if (saveState === "saving") return t("dayPlanSaving") || "Zapisywanie…";
    if (saveState === "dirty") return t("dayPlanUnsaved") || "Niezapisane zmiany";
    if (saveState === "error") return t("dayPlanSaveError") || "Błąd zapisu";
    if (saveState === "saved" && savedAt) {
      return `${t("dayPlanSavedAt") || "Zapisano"} ${savedAt.toLocaleTimeString(lang === "en" ? "en-GB" : "pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return t("dayPlanReady") || "Gotowe";
  };

  const addSessionNote = () => {
    const text = quickNote.trim();
    if (!text) return;
    const note = {
      id: createId(),
      text,
      created_at: new Date().toISOString(),
    };
    patchPlan((prev) => ({
      ...prev,
      session_notes: [note, ...(prev.session_notes || [])],
    }));
    setQuickNote("");
  };

  const applyTemplate = async (template) => {
    if (!plan || !template) return;
    const apply = () => {
      patchPlan((prev) => applyTemplateToPlan(prev, template));
      toast.success(t("dayPlanTemplateApplied") || "Szablon zastosowany");
    };
    if (planHasContent(plan)) {
      setConfirm({ type: "applyTemplate", template, onConfirm: apply });
      return;
    }
    apply();
  };

  const clearDay = async () => {
    if (!user?.id || !accountId || !date) return;
    try {
      await deleteDayPlan(user.id, accountId, date);
      const blank = emptyDayPlan({ accountId, date, language: lang });
      setPlan(blank);
      setBaseline(JSON.stringify(blank));
      setSaveState("idle");
      toast.success(t("dayPlanCleared") || "Dzień wyczyszczony");
    } catch (err) {
      toast.error(err?.message || "Nie udało się wyczyścić dnia.");
    }
  };

  if (!user?.id) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("loginRequired") || "Zaloguj się, aby korzystać z Planu dnia."}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="cyber-page-title mb-0.5 flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-primary" />
            {t("dayPlan") || "Plan dnia"}
          </h1>
          <p className="cyber-page-sub">
            {t("dayPlanSubtitle") || "Przygotuj sesję, monitoruj plan i wyciągnij wnioski."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {[
          { id: "day", label: t("dayPlanTabDay") || "Dzień" },
          { id: "templates", label: t("dayPlanTabTemplates") || "Szablony" },
          { id: "history", label: t("dayPlanTabHistory") || "Historia" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === item.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "day" && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    plan?.status === "ready" && "bg-primary",
                    plan?.status === "active" && "bg-amber-400",
                    plan?.status === "closed" && "bg-emerald-400",
                    (!plan?.status || plan?.status === "draft") && "bg-yellow-400"
                  )}
                />
                {t("dayPlanStatus") || "Plan"}: {statusLabel(plan?.status || "draft", lang)}
              </span>
              <Select
                value={plan?.template_id || "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") return;
                  const template = templates.find((row) => row.id === value);
                  if (template) applyTemplate(template);
                }}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder={t("dayPlanTemplate") || "Szablon"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("dayPlanNoTemplate") || "Bez szablonu"}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setTemplateName(plan?.template_name || `${t("dayPlan") || "Plan"} ${date}`);
                  setConfirm({ type: "saveTemplate" });
                }}
              >
                {t("dayPlanSaveAsTemplate") || "Zapisz jako szablon"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  requestContextChange(() => {
                    setDate(todayIso());
                    setPlan(emptyDayPlan({ accountId, date: todayIso(), language: lang }));
                    setBaseline("");
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t("dayPlanNew") || "Nowy plan"}
              </Button>
              {plan && activeAccounts.length > 0 ? (
                <>
                  <span className="mx-0.5 hidden h-5 w-px bg-border sm:inline" aria-hidden />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => persist(plan)}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" />
                    {t("dayPlanSave") || "Zapisz plan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => persist({ ...plan, status: "ready" })}
                  >
                    {t("dayPlanMarkReady") || "Oznacz jako gotowy"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => persist({ ...plan, status: "active" })}
                  >
                    {t("dayPlanStartSession") || "Rozpocznij sesję"}
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={t("previous") || "Poprzedni dzień"}
                  onClick={() => requestContextChange(() => setDate((d) => shiftIsoDate(d, -1)))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className="px-2 text-xs font-medium tabular-nums"
                  onClick={() => requestContextChange(() => setDate(todayIso()))}
                >
                  {date === todayIso()
                    ? `${t("today") || "Dziś"} · ${formatIsoDisplay(date, lang === "en" ? "en-GB" : "pl-PL")}`
                    : formatIsoDisplay(date, lang === "en" ? "en-GB" : "pl-PL")}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={t("next") || "Następny dzień"}
                  onClick={() => requestContextChange(() => setDate((d) => shiftIsoDate(d, 1)))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Select
                value={accountId || undefined}
                onValueChange={(value) => requestContextChange(() => setAccountId(value))}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder={t("account") || "Konto"} />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!activeAccounts.length ? (
            <Card className="border-border">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("dayPlanNoAccounts") || "Dodaj aktywne konto tradingowe, aby tworzyć plan dnia."}
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link to={createPageUrl("Accounts")}>{t("accounts") || "Konta"}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : loading || !plan ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("loading") || "Ładowanie…"}
            </div>
          ) : (
            <>
              <div className="grid gap-3 xl:grid-cols-3">
                <SectionCard title={t("dayPlanPreSession") || "Plan przed sesją"}>
                  {[
                    ["market_context", t("dayPlanMarketContext") || "Kontekst rynku", 1000],
                    ["scenario_levels", t("dayPlanScenario") || "Scenariusz / poziomy", 1000],
                    ["watchlist", t("dayPlanWatchlist") || "Instrumenty do obserwacji", 500],
                    ["avoid_today", t("dayPlanAvoid") || "Czego dziś unikam?", 500],
                  ].map(([key, label, max]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{label}</Label>
                        <CharCount value={plan.pre_session?.[key]} max={max} />
                      </div>
                      <Textarea
                        value={plan.pre_session?.[key] || ""}
                        maxLength={max}
                        rows={key === "watchlist" || key === "avoid_today" ? 2 : 4}
                        onChange={(e) =>
                          patchPlan((prev) => ({
                            ...prev,
                            pre_session: { ...prev.pre_session, [key]: e.target.value },
                          }))
                        }
                        className="resize-y text-sm"
                      />
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title={t("dayPlanChecklist") || "Checklista dnia"}>
                  {(() => {
                    const progress = checklistProgress(plan.checklist || []);
                    const stages = groupChecklistByStage(plan.checklist || [], lang);
                    const addItem = () => {
                      if (!newCheckItem.trim()) return;
                      patchPlan((prev) => ({
                        ...prev,
                        checklist: [
                          ...(prev.checklist || []),
                          {
                            id: createId(),
                            text: newCheckItem.trim(),
                            stage: newCheckStage,
                            done: false,
                            custom: true,
                          },
                        ],
                      }));
                      setNewCheckItem("");
                    };
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div>
                            <p className="text-[11px] text-muted-foreground">{t("dayPlanProgress") || "Postęp realizacji"}</p>
                            <p className="text-sm font-semibold tabular-nums">
                              {progress.done} / {progress.total}
                            </p>
                          </div>
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-primary/15">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${progress.ratio * 100}%` }} />
                          </div>
                        </div>

                        {stages.map((stage) => (
                          <div key={stage.id} className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/90">
                              {stage.label}
                            </p>
                            {(stage.items || []).length === 0 && (
                              <p className="text-[11px] text-muted-foreground">{t("dayPlanStageEmpty") || "Brak punktów w tym etapie"}</p>
                            )}
                            {stage.items.map((item) => (
                              <div key={item.id} className="flex items-start gap-2 rounded-md border border-border/70 px-2 py-1.5">
                                <Checkbox
                                  checked={!!item.done}
                                  onCheckedChange={(checked) =>
                                    patchPlan((prev) => ({
                                      ...prev,
                                      checklist: prev.checklist.map((row) =>
                                        row.id === item.id ? { ...row, done: !!checked } : row
                                      ),
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                                <Input
                                  value={item.text}
                                  onChange={(e) =>
                                    patchPlan((prev) => ({
                                      ...prev,
                                      checklist: prev.checklist.map((row) =>
                                        row.id === item.id ? { ...row, text: e.target.value, custom: true } : row
                                      ),
                                    }))
                                  }
                                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                />
                                <Select
                                  value={item.stage || "plan"}
                                  onValueChange={(value) =>
                                    patchPlan((prev) => ({
                                      ...prev,
                                      checklist: prev.checklist.map((row) =>
                                        row.id === item.id ? { ...row, stage: value } : row
                                      ),
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-7 w-[96px] shrink-0 text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CHECKLIST_STAGES.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {lang === "en" ? s.en : s.pl}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground"
                                  onClick={() =>
                                    patchPlan((prev) => ({
                                      ...prev,
                                      checklist: prev.checklist.filter((row) => row.id !== item.id),
                                    }))
                                  }
                                  aria-label={t("delete") || "Usuń"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ))}

                        {progress.open.length > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
                              {t("dayPlanToClose") || "Do domknięcia"}
                            </p>
                            <ul className="space-y-1">
                              {progress.open.slice(0, 6).map((item) => (
                                <li key={item.id} className="truncate text-[12px] text-foreground/85">
                                  • {item.text}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Select value={newCheckStage} onValueChange={setNewCheckStage}>
                            <SelectTrigger className="h-8 w-full sm:w-[120px] text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHECKLIST_STAGES.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {lang === "en" ? s.en : s.pl}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={newCheckItem}
                            onChange={(e) => setNewCheckItem(e.target.value)}
                            placeholder={t("dayPlanAddCheck") || "Nowy punkt"}
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addItem();
                              }
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addItem}>
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t("add") || "Dodaj"}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </SectionCard>

                <SectionCard title={t("dayPlanParameters") || "Parametry dnia"}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("dayPlanTradeLimit") || "Limit transakcji"}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={plan.parameters?.trade_limit ?? ""}
                        onChange={(e) =>
                          patchPlan((prev) => ({
                            ...prev,
                            parameters: { ...prev.parameters, trade_limit: e.target.value === "" ? "" : Number(e.target.value) },
                          }))
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("dayPlanMaxRisk") || "Maks. ryzyko %"}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={plan.parameters?.max_risk_percent ?? ""}
                        onChange={(e) =>
                          patchPlan((prev) => ({
                            ...prev,
                            parameters: {
                              ...prev.parameters,
                              max_risk_percent: e.target.value === "" ? "" : Number(e.target.value),
                            },
                          }))
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("dayPlanProcessGoal") || "Cel procesu"}</Label>
                    <Select
                      value={plan.parameters?.process_goal || "stick_to_plan"}
                      onValueChange={(value) =>
                        patchPlan((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, process_goal: value },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROCESS_GOALS.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {lang === "en" ? goal.en : goal.pl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t("dayPlanExtraRules") || "Dodatkowe zasady"}</Label>
                      <CharCount value={plan.parameters?.extra_rules} max={500} />
                    </div>
                    <Textarea
                      value={plan.parameters?.extra_rules || ""}
                      maxLength={500}
                      rows={4}
                      onChange={(e) =>
                        patchPlan((prev) => ({
                          ...prev,
                          parameters: { ...prev.parameters, extra_rules: e.target.value },
                        }))
                      }
                      className="text-sm"
                    />
                  </div>
                </SectionCard>
              </div>

              <div className="grid gap-3 xl:grid-cols-3">
                <SectionCard title={t("dayPlanSessionNotes") || "Notatki z sesji"}>
                  <div className="flex gap-2">
                    <Input
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder={t("dayPlanQuickNote") || "Szybka notatka…"}
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSessionNote();
                        }
                      }}
                    />
                    <Button type="button" size="sm" className="h-8" onClick={addSessionNote}>
                      {t("add") || "Dodaj"}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(plan.session_notes || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        {t("dayPlanNoNotes") || "Brak notatek z tej sesji."}
                      </p>
                    ) : (
                      (plan.session_notes || []).map((note) => (
                        <div key={note.id} className="rounded-md border border-border/70 p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {note.created_at
                                ? new Date(note.created_at).toLocaleTimeString(lang === "en" ? "en-GB" : "pl-PL", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "--:--"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                patchPlan((prev) => ({
                                  ...prev,
                                  session_notes: prev.session_notes.filter((row) => row.id !== note.id),
                                }))
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={note.text}
                            rows={2}
                            onChange={(e) =>
                              patchPlan((prev) => ({
                                ...prev,
                                session_notes: prev.session_notes.map((row) =>
                                  row.id === note.id ? { ...row, text: e.target.value } : row
                                ),
                              }))
                            }
                            className="text-sm"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </SectionCard>

                <SectionCard title={t("dayPlanPostSession") || "Podsumowanie po sesji"}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t("dayPlanWentWell") || "Co poszło dobrze?"}</Label>
                      <CharCount value={plan.post_session?.went_well} max={2000} />
                    </div>
                    <Textarea
                      value={plan.post_session?.went_well || ""}
                      maxLength={2000}
                      rows={4}
                      onChange={(e) =>
                        patchPlan((prev) => ({
                          ...prev,
                          post_session: { ...prev.post_session, went_well: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t("dayPlanImprove") || "Co poprawię następnym razem?"}</Label>
                      <CharCount value={plan.post_session?.improve_next} max={2000} />
                    </div>
                    <Textarea
                      value={plan.post_session?.improve_next || ""}
                      maxLength={2000}
                      rows={4}
                      onChange={(e) =>
                        patchPlan((prev) => ({
                          ...prev,
                          post_session: { ...prev.post_session, improve_next: e.target.value },
                        }))
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard title={t("dayPlanMoodDiscipline") || "Samopoczucie i dyscyplina"}>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("dayPlanMood") || "Twoje samopoczucie"}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {MOOD_OPTIONS.map((mood) => {
                        const active = plan.post_session?.mood === mood.id;
                        return (
                          <button
                            key={mood.id}
                            type="button"
                            onClick={() =>
                              patchPlan((prev) => ({
                                ...prev,
                                post_session: {
                                  ...prev.post_session,
                                  mood: prev.post_session?.mood === mood.id ? "" : mood.id,
                                },
                              }))
                            }
                            className={cn(
                              "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                              active
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {lang === "en" ? mood.en : mood.pl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("dayPlanDiscipline") || "Ocena dyscypliny"}</Label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => {
                        const active = Number(plan.post_session?.discipline) === score;
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={() =>
                              patchPlan((prev) => ({
                                ...prev,
                                post_session: {
                                  ...prev.post_session,
                                  discipline: prev.post_session?.discipline === score ? null : score,
                                },
                              }))
                            }
                            className={cn(
                              "h-9 w-9 rounded-md border text-sm font-semibold",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Actions in normal flow — no fixed bar over dock/content */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="h-9" onClick={() => persist(plan)}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {t("dayPlanSave") || "Zapisz plan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => persist({ ...plan, status: "ready" })}
                  >
                    {t("dayPlanMarkReady") || "Oznacz jako gotowy"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => persist({ ...plan, status: "active" })}
                  >
                    {t("dayPlanStartSession") || "Rozpocznij sesję"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => persist({ ...plan, status: "closed" })}
                  >
                    {t("dayPlanCloseDay") || "Zamknij dzień"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-destructive hover:text-destructive"
                    onClick={() => setConfirm({ type: "clearDay" })}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t("dayPlanClearDay") || "Wyczyść dzień"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {saveStatusText()}
                  {selectedAccount ? ` · ${selectedAccount.name}` : ""}
                  {" · "}
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setTab("history")}>
                    {t("dayPlanViewHistory") || "Zobacz poprzednie plany"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("dayPlanTemplatesHint") || "Szablony zawierają plan przed sesją, checklistę i parametry dnia."}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                const name = window.prompt(t("dayPlanTemplateName") || "Nazwa szablonu", "NY Open");
                if (!name?.trim()) return;
                const payload = planToTemplatePayload(
                  plan || emptyDayPlan({ accountId, date, language: lang }),
                  name
                );
                await createDayPlanTemplate(user.id, payload);
                refetchTemplates();
                toast.success(t("dayPlanTemplateCreated") || "Szablon utworzony");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("dayPlanNewTemplate") || "Nowy szablon"}
            </Button>
          </div>
          {!templates.length ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t("dayPlanNoTemplates") || "Brak szablonów. Zapisz bieżący plan jako szablon lub utwórz nowy."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <p className="line-clamp-3">
                      {template.pre_session?.market_context || template.pre_session?.scenario_levels || "—"}
                    </p>
                    <p>
                      {(template.checklist || []).length} {t("dayPlanChecks") || "punktów checklisty"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => {
                        setTab("day");
                        applyTemplate(template);
                      }}>
                        {t("dayPlanUseTemplate") || "Zastosuj"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={async () => {
                          await duplicateDayPlanTemplate(user.id, template);
                          refetchTemplates();
                          toast.success(t("dayPlanTemplateCopied") || "Skopiowano szablon");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        onClick={() => setConfirm({ type: "deleteTemplate", template })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select
              value={historyFilters.accountId}
              onValueChange={(value) => setHistoryFilters((prev) => ({ ...prev, accountId: value }))}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder={t("account") || "Konto"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allAccounts") || "Wszystkie konta"}</SelectItem>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={historyFilters.status}
              onValueChange={(value) => setHistoryFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder={t("status") || "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all") || "Wszystkie"}</SelectItem>
                {DAY_PLAN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabel(status, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={historyFilters.from}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, from: e.target.value }))}
              className="h-8 w-[150px] text-xs"
            />
            <Input
              type="date"
              value={historyFilters.to}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, to: e.target.value }))}
              className="h-8 w-[150px] text-xs"
            />
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !history.length ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t("dayPlanNoHistory") || "Brak zapisanych planów dla wybranych filtrów."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((row) => {
                const accountName =
                  activeAccounts.find((a) => String(a.id) === String(row.account_id))?.name ||
                  row.account_id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() =>
                      requestContextChange(() => {
                        setAccountId(String(row.account_id));
                        setDate(String(row.date));
                        setTab("day");
                      })
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-3 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-sm">
                        {formatIsoDisplay(row.date, lang === "en" ? "en-GB" : "pl-PL")} · {accountName}
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {statusLabel(row.status || "draft", lang)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {row.pre_session?.market_context ||
                        row.pre_session?.scenario_levels ||
                        row.post_session?.went_well ||
                        "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "unsaved" && (t("dayPlanUnsavedTitle") || "Niezapisane zmiany")}
              {confirm?.type === "clearDay" && (t("dayPlanClearTitle") || "Wyczyścić dzień?")}
              {confirm?.type === "deleteTemplate" && (t("dayPlanDeleteTemplateTitle") || "Usunąć szablon?")}
              {confirm?.type === "applyTemplate" && (t("dayPlanApplyTemplateTitle") || "Zastąpić pola planu?")}
              {confirm?.type === "saveTemplate" && (t("dayPlanSaveAsTemplate") || "Zapisz jako szablon")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "unsaved" &&
                (t("dayPlanUnsavedDesc") || "Masz niezapisane zmiany. Zapisać przed kontynuacją?")}
              {confirm?.type === "clearDay" &&
                (t("dayPlanClearDesc") || "Usuniesz plan tylko dla wybranej daty i konta.")}
              {confirm?.type === "deleteTemplate" &&
                (t("dayPlanDeleteTemplateDesc") || "Tej operacji nie można cofnąć.")}
              {confirm?.type === "applyTemplate" &&
                (t("dayPlanApplyTemplateDesc") ||
                  "Szablon nadpisze plan przed sesją, checklistę i parametry. Notatki sesji pozostaną.")}
              {confirm?.type === "saveTemplate" && (
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="mt-2"
                  placeholder={t("dayPlanTemplateName") || "Nazwa szablonu"}
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirm?.type === "unsaved" ? t("dayPlanDiscard") || "Odrzuć" : t("cancel") || "Anuluj"}
            </AlertDialogCancel>
            {confirm?.type === "unsaved" && (
              <AlertDialogAction
                onClick={async () => {
                  const ok = await persist(plan);
                  if (ok && pendingNav) pendingNav();
                  setPendingNav(null);
                  setConfirm(null);
                }}
              >
                {t("dayPlanSave") || "Zapisz plan"}
              </AlertDialogAction>
            )}
            {confirm?.type === "unsaved" && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  pendingNav?.();
                  setPendingNav(null);
                  setConfirm(null);
                }}
              >
                {t("dayPlanContinueAnyway") || "Kontynuuj bez zapisu"}
              </Button>
            )}
            {confirm?.type === "clearDay" && (
              <AlertDialogAction
                onClick={async () => {
                  await clearDay();
                  setConfirm(null);
                }}
              >
                {t("dayPlanClearDay") || "Wyczyść dzień"}
              </AlertDialogAction>
            )}
            {confirm?.type === "deleteTemplate" && (
              <AlertDialogAction
                onClick={async () => {
                  await deleteDayPlanTemplate(user.id, confirm.template.id);
                  refetchTemplates();
                  toast.success(t("dayPlanTemplateDeleted") || "Szablon usunięty");
                  setConfirm(null);
                }}
              >
                {t("delete") || "Usuń"}
              </AlertDialogAction>
            )}
            {confirm?.type === "applyTemplate" && (
              <AlertDialogAction
                onClick={() => {
                  confirm.onConfirm?.();
                  setConfirm(null);
                }}
              >
                {t("dayPlanUseTemplate") || "Zastosuj"}
              </AlertDialogAction>
            )}
            {confirm?.type === "saveTemplate" && (
              <AlertDialogAction
                onClick={async () => {
                  if (!templateName.trim() || !plan) return;
                  await createDayPlanTemplate(user.id, planToTemplatePayload(plan, templateName));
                  refetchTemplates();
                  toast.success(t("dayPlanTemplateCreated") || "Szablon utworzony");
                  setConfirm(null);
                }}
              >
                {t("save") || "Zapisz"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
