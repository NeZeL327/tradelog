import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
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
  createId,
  CHECKLIST_STAGES,
  checklistProgress,
  DAY_PLAN_STATUSES,
  DAY_PLAN_STATUS_LABELS,
  DEFAULT_DAY_PLAN_TAGS,
  emptyDayPlan,
  formatIsoDisplay,
  groupChecklistByStage,
  MOOD_OPTIONS,
  normalizeDayPlan,
  processBandForScore,
  processCriteriaScore,
  PROCESS_GOALS,
  shiftIsoDate,
  todayIso,
  validatePlanParameters,
} from "@/lib/dayPlanModel";
import {
  deleteDayPlan,
  getDayPlan,
  HEADER_ACCOUNT_STORAGE_KEY,
  listDayPlans,
  saveDayPlan,
} from "@/lib/dayPlanStorage";
import DayPlanGuidedFlow from "@/components/DayPlanGuidedFlow";
import DayPlanTaggedNote from "@/components/DayPlanTaggedNote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const AUTOSAVE_MS = 1200;

function statusLabel(status, language) {
  const row = DAY_PLAN_STATUS_LABELS[status] || DAY_PLAN_STATUS_LABELS.draft;
  return language === "en" ? row.en : row.pl;
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

  const [tab, setTab] = useState(() => {
    const raw = searchParams.get("tab") || "day";
    return raw === "templates" ? "day" : raw;
  });
  const [date, setDate] = useState(searchParams.get("date") || todayIso());
  const [accountId, setAccountId] = useState(searchParams.get("account") || "");
  const [plan, setPlan] = useState(null);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteTags, setQuickNoteTags] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckStage, setNewCheckStage] = useState("plan");
  const [historyFilters, setHistoryFilters] = useState({ accountId: "all", status: "all", from: "", to: "" });
  const [confirm, setConfirm] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const [classicOpen, setClassicOpen] = useState(false);
  const autosaveRef = useRef(null);
  const skipDirtyRef = useRef(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user.id),
    enabled: !!user?.id,
  });
  const activeAccounts = useMemo(() => accounts.filter(isTradingAccountActive), [accounts]);

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

  const planView = searchParams.get("view") || "";
  const planSession = searchParams.get("session") || "";
  const planHorizon = searchParams.get("horizon") || "";

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
      const next = normalizeDayPlan(existing || emptyDayPlan({ accountId, date, language: lang }), {
        accountId,
        date,
        language: lang,
      });
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
      queryClient.invalidateQueries({ queryKey: ["dayPlanProgress", user.id] });
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
    if (!text && !(quickNoteTags || []).length) return;
    const note = {
      id: createId(),
      text,
      tags: [...(quickNoteTags || [])],
      created_at: new Date().toISOString(),
    };
    patchPlan((prev) => ({
      ...prev,
      session_notes: [note, ...(prev.session_notes || [])],
    }));
    setQuickNote("");
    setQuickNoteTags([]);
  };

  const patchTagList = (key, next) =>
    patchPlan((prev) => ({
      ...prev,
      tag_lists: { ...prev.tag_lists, [key]: next },
    }));

  const clearDay = async () => {
    if (!user?.id || !accountId || !date) return;
    try {
      await deleteDayPlan(user.id, accountId, date);
      const blank = normalizeDayPlan(emptyDayPlan({ accountId, date, language: lang }), {
        accountId,
        date,
        language: lang,
      });
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
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  requestContextChange(() => {
                    const nextDate = todayIso();
                    const blank = normalizeDayPlan(
                      emptyDayPlan({ accountId, date: nextDate, language: lang }),
                      { accountId, date: nextDate, language: lang }
                    );
                    setDate(nextDate);
                    setPlan(blank);
                    setBaseline(JSON.stringify(blank));
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
                    className="h-8 text-xs cyber-primary-btn"
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
                    disabled={plan.status === "ready" || plan.status === "active" || plan.status === "closed"}
                    onClick={() => persist({ ...plan, status: "ready" })}
                  >
                    {t("dayPlanMarkReady") || "Oznacz jako gotowy"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={plan.status === "active" || plan.status === "closed"}
                    onClick={() => persist({ ...plan, status: "active" })}
                  >
                    {t("dayPlanStartSession") || "Rozpocznij sesję"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={plan.status === "closed"}
                    onClick={() => persist({ ...plan, status: "closed" })}
                  >
                    {t("dayPlanCloseDay") || "Zakończ sesję"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirm({ type: "clearDay" })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("dayPlanClearDay") || "Wyczyść"}
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-[11px] text-muted-foreground lg:inline">
                {saveStatusText()}
                {selectedAccount ? ` · ${selectedAccount.name}` : ""}
              </span>
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
              <DayPlanGuidedFlow
                plan={plan}
                lang={lang}
                patchPlan={patchPlan}
                onPersist={() => {
                  window.setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["dayPlanProgress", user?.id] });
                  }, AUTOSAVE_MS + 200);
                }}
                initialView={planView === "mapping" || planView === "focus" ? planView : undefined}
                initialSession={["asia", "london", "ny"].includes(planSession) ? planSession : undefined}
                initialHorizon={["htf", "mtf", "ltf"].includes(planHorizon) ? planHorizon : undefined}
              />

              <Collapsible open={classicOpen} onOpenChange={setClassicOpen}>
                <div className="rounded-xl border border-border bg-card/50">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/20"
                    >
                      <span>{t("dayPlanClassicSections") || "Dodatkowe sekcje planu"}</span>
                      <span className="text-xs text-muted-foreground">
                        {classicOpen
                          ? t("hide") || "Ukryj"
                          : t("show") || "Pokaż"}{" "}
                        · {t("dayPlanClassicHint") || "pre-sesja, checklista, parametry, notatki"}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 border-t border-border px-3 pb-3 pt-3">
              <div className="grid gap-3 xl:grid-cols-3">
                <SectionCard title={t("dayPlanPreSession") || "Plan przed sesją"}>
                  {[
                    ["market_context", t("dayPlanMarketContext") || "Kontekst rynku", 1000, ["News risk", "Trend day", "Range day", "High impact"]],
                    ["scenario_levels", t("dayPlanScenario") || "Scenariusz / poziomy", 1000, ["Scenariusz A", "Scenariusz B", "Kluczowe poziomy"]],
                    ["watchlist", t("dayPlanWatchlist") || "Instrumenty do obserwacji", 500, ["Watchlist", "Tylko A+", "Asia first"]],
                    ["avoid_today", t("dayPlanAvoid") || "Czego dziś unikam?", 500, ["Unikaj FOMO", "No revenge", "Overtrade"]],
                  ].map(([key, label, max, suggest], idx) => (
                    <DayPlanTaggedNote
                      key={key}
                      label={label}
                      text={plan.pre_session?.[key] || ""}
                      tags={plan.pre_session_tags?.[key] || []}
                      suggestTags={suggest}
                      options={plan.tag_lists?.pre_session || DEFAULT_DAY_PLAN_TAGS.pre_session}
                      defaultOptions={DEFAULT_DAY_PLAN_TAGS.pre_session}
                      rows={key === "watchlist" || key === "avoid_today" ? 2 : 3}
                      maxLength={max}
                      noteCollapsible
                      showVocabManager={idx === 0}
                      onTextChange={(value) =>
                        patchPlan((prev) => ({
                          ...prev,
                          pre_session: { ...prev.pre_session, [key]: value },
                        }))
                      }
                      onTagsChange={(tags) =>
                        patchPlan((prev) => ({
                          ...prev,
                          pre_session_tags: { ...prev.pre_session_tags, [key]: tags },
                        }))
                      }
                      onOptionsChange={(next) => patchTagList("pre_session", next)}
                    />
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
                  <DayPlanTaggedNote
                    label={t("dayPlanExtraRules") || "Dodatkowe zasady"}
                    text={plan.parameters?.extra_rules || ""}
                    tags={plan.parameters?.extra_rules_tags || []}
                    suggestTags={DEFAULT_DAY_PLAN_TAGS.parameters}
                    options={plan.tag_lists?.parameters || DEFAULT_DAY_PLAN_TAGS.parameters}
                    defaultOptions={DEFAULT_DAY_PLAN_TAGS.parameters}
                    rows={3}
                    maxLength={500}
                    noteCollapsible
                    showVocabManager
                    onTextChange={(value) =>
                      patchPlan((prev) => ({
                        ...prev,
                        parameters: { ...prev.parameters, extra_rules: value },
                      }))
                    }
                    onTagsChange={(tags) =>
                      patchPlan((prev) => ({
                        ...prev,
                        parameters: { ...prev.parameters, extra_rules_tags: tags },
                      }))
                    }
                    onOptionsChange={(next) => patchTagList("parameters", next)}
                  />
                </SectionCard>
              </div>

              <div className="grid gap-3 xl:grid-cols-3">
                <SectionCard title={t("dayPlanSessionNotes") || "Notatki z sesji"}>
                  <DayPlanTaggedNote
                    label={t("dayPlanQuickNote") || "Nowa notatka"}
                    hint={t("dayPlanTaggedHint") || "Kliknij tagi albo napisz — albo jedno i drugie."}
                    text={quickNote}
                    tags={quickNoteTags}
                    suggestTags={DEFAULT_DAY_PLAN_TAGS.session}
                    options={plan.tag_lists?.session || DEFAULT_DAY_PLAN_TAGS.session}
                    defaultOptions={DEFAULT_DAY_PLAN_TAGS.session}
                    rows={2}
                    showVocabManager
                    onTextChange={setQuickNote}
                    onTagsChange={setQuickNoteTags}
                    onOptionsChange={(next) => patchTagList("session", next)}
                  />
                  <Button type="button" size="sm" className="h-8 w-full" onClick={addSessionNote}>
                    {t("add") || "Dodaj"}
                  </Button>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
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
                          <DayPlanTaggedNote
                            text={note.text || ""}
                            tags={note.tags || []}
                            suggestTags={DEFAULT_DAY_PLAN_TAGS.session}
                            options={plan.tag_lists?.session || DEFAULT_DAY_PLAN_TAGS.session}
                            defaultOptions={DEFAULT_DAY_PLAN_TAGS.session}
                            rows={2}
                            noteCollapsible
                            onTextChange={(value) =>
                              patchPlan((prev) => ({
                                ...prev,
                                session_notes: prev.session_notes.map((row) =>
                                  row.id === note.id ? { ...row, text: value } : row
                                ),
                              }))
                            }
                            onTagsChange={(tags) =>
                              patchPlan((prev) => ({
                                ...prev,
                                session_notes: prev.session_notes.map((row) =>
                                  row.id === note.id ? { ...row, tags } : row
                                ),
                              }))
                            }
                            onOptionsChange={(next) => patchTagList("session", next)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </SectionCard>

                <SectionCard title={t("dayPlanPostSession") || "Podsumowanie po sesji"}>
                  <DayPlanTaggedNote
                    label={t("dayPlanWentWell") || "Co poszło dobrze?"}
                    text={plan.post_session?.went_well || ""}
                    tags={plan.post_session?.went_well_tags || []}
                    suggestTags={["Dyscyplina", "Proces OK", "Trzymałem plan", "Journal done"]}
                    options={plan.tag_lists?.post || DEFAULT_DAY_PLAN_TAGS.post}
                    defaultOptions={DEFAULT_DAY_PLAN_TAGS.post}
                    rows={3}
                    maxLength={2000}
                    noteCollapsible
                    showVocabManager
                    onTextChange={(value) =>
                      patchPlan((prev) => ({
                        ...prev,
                        post_session: { ...prev.post_session, went_well: value },
                      }))
                    }
                    onTagsChange={(tags) =>
                      patchPlan((prev) => ({
                        ...prev,
                        post_session: { ...prev.post_session, went_well_tags: tags },
                      }))
                    }
                    onOptionsChange={(next) => patchTagList("post", next)}
                  />
                  <DayPlanTaggedNote
                    label={t("dayPlanImprove") || "Co poprawię następnym razem?"}
                    text={plan.post_session?.improve_next || ""}
                    tags={plan.post_session?.improve_next_tags || []}
                    suggestTags={["Lekcja", "Revenge", "Overtrade", "FOMO"]}
                    options={plan.tag_lists?.post || DEFAULT_DAY_PLAN_TAGS.post}
                    defaultOptions={DEFAULT_DAY_PLAN_TAGS.post}
                    rows={3}
                    maxLength={2000}
                    noteCollapsible
                    onTextChange={(value) =>
                      patchPlan((prev) => ({
                        ...prev,
                        post_session: { ...prev.post_session, improve_next: value },
                      }))
                    }
                    onTagsChange={(tags) =>
                      patchPlan((prev) => ({
                        ...prev,
                        post_session: { ...prev.post_session, improve_next_tags: tags },
                      }))
                    }
                    onOptionsChange={(next) => patchTagList("post", next)}
                  />
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
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] text-muted-foreground">
                <span className="lg:hidden">{saveStatusText()}</span>
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => setTab("history")}>
                  {t("dayPlanViewHistory") || "Zobacz poprzednie plany"}
                </button>
              </div>
            </>
          )}
        </>
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
                const processPct = processCriteriaScore(row.post_session?.process);
                const processBand = processBandForScore(processPct);
                const focusScore = row.focus?.score;
                const tradeMode = row.focus?.trade_mode;
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
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      {focusScore != null ? (
                        <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                          Skupienie {focusScore}
                        </span>
                      ) : null}
                      {tradeMode ? (
                        <span className="rounded border border-border/70 px-1.5 py-0.5 uppercase text-muted-foreground">
                          {tradeMode}
                        </span>
                      ) : null}
                      {Object.values(row.post_session?.process || {}).some(Boolean) ? (
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5",
                            processBand.tone === "profit" && "border-profit/40 text-profit",
                            processBand.tone === "loss" && "border-loss/40 text-loss",
                            processBand.tone === "amber" && "border-amber-500/40 text-amber-400"
                          )}
                        >
                          Proces {processPct}% · {lang === "en" ? processBand.en : processBand.pl}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {row.mapping?.htf?.notes ||
                        row.pre_session?.market_context ||
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
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "unsaved" &&
                (t("dayPlanUnsavedDesc") || "Masz niezapisane zmiany. Zapisać przed kontynuacją?")}
              {confirm?.type === "clearDay" &&
                (t("dayPlanClearDesc") || "Usuniesz plan tylko dla wybranej daty i konta.")}
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
