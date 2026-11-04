// Nowa strona "Dzień" (Mój dzień / Dziennik dni). Wzorzec: docs/design-reference/makieta-dzien.html.
// Zapis: dokument dnia users/{uid}/day_plans/{konto}_{data} — nowe pola są opcjonalne (patrz docs/dzien-v2.md).
// Transakcje tylko czytamy; setup i ocenę dyscypliny zapisujemy istniejącą funkcją updateTrade.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getStrategies, getTrades, getTradingAccounts, updateUser } from "@/lib/localStorage";
import { HEADER_ACCOUNT_STORAGE_KEY, getDayPlan, listDayPlans, saveDayPlan } from "@/lib/dayPlanStorage";
import { createId, emptyDayPlan, normalizeDayPlan } from "@/lib/dayPlanModel";
import { accountBaseBalance } from "@/lib/pnlDisplay";
import { isTradingAccountActive } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import {
  DEFAULT_BIAS_PAIRS,
  averageScore,
  badgeProgress,
  closedStreak,
  dailyStopPercent,
  dayTradesFor,
  disciplineOf,
  effectiveTradeLimit,
  flowPhase,
  heatmap,
  isClosed,
  isImportDone,
  newsOfDay,
  nextStep,
  planMissing,
  shiftDays,
  statsOf,
} from "@/lib/dayFlow";
import { nowInWarsaw, sessionsForDate } from "@/lib/daySessions";
import DayHero from "@/components/dayv2/DayHero";
import StepPlan from "@/components/dayv2/StepPlan";
import StepTrade from "@/components/dayv2/StepTrade";
import StepImport from "@/components/dayv2/StepImport";
import StepReview from "@/components/dayv2/StepReview";
import DayAside from "@/components/dayv2/DayAside";
import DayJournal from "@/components/dayv2/DayJournal";
import WorkMode from "@/components/dayv2/WorkMode";
import "@/components/dayv2/day.css";

const SAVE_DELAY_MS = 800;
const STEP_NAMES = ["Plan", "Handel", "Import", "Przegląd"];
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const dateOf = (iso) => new Date(`${iso}T12:00:00`);

export default function Day() {
  const { user, patchUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [now, setNow] = useState(() => nowInWarsaw());
  useEffect(() => {
    const id = setInterval(() => setNow(nowInWarsaw()), 30000);
    return () => clearInterval(id);
  }, []);
  const todayIso = now.dateIso;

  const [date, setDate] = useState(() => (isIso(searchParams.get("date")) ? searchParams.get("date") : nowInWarsaw().dateIso));
  const [view, setView] = useState(() => (searchParams.get("tab") === "journal" ? "journal" : "day"));
  const [monthIso, setMonthIso] = useState(() => `${date.slice(0, 7)}-01`);
  const [accountId, setAccountId] = useState(searchParams.get("account") || "");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [workOpen, setWorkOpen] = useState(false);
  const [newBadgeKey, setNewBadgeKey] = useState(null);
  const timerRef = useRef(null);
  const docRef = useRef(null);
  const ctxRef = useRef(null);

  /* ---------------- dane */
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts", user?.id], queryFn: () => getTradingAccounts(user.id), enabled: !!user?.id });
  const { data: trades = [] } = useQuery({ queryKey: ["trades", user?.id], queryFn: () => getTrades(user.id), enabled: !!user?.id });
  const { data: strategies = [] } = useQuery({ queryKey: ["strategies", user?.id], queryFn: () => getStrategies(user.id), enabled: !!user?.id });
  const activeAccounts = useMemo(() => accounts.filter(isTradingAccountActive), [accounts]);
  const plansKey = ["dayPlansV2", user?.id, accountId];
  const { data: plans = [] } = useQuery({
    queryKey: plansKey,
    queryFn: () => listDayPlans(user.id, { accountId }),
    enabled: !!user?.id && !!accountId,
  });

  /* ---------------- konto: wspólne z wyborem w nagłówku */
  useEffect(() => {
    if (!user?.id || !activeAccounts.length) return;
    if (accountId && activeAccounts.some((a) => String(a.id) === String(accountId))) return;
    const saved = localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id));
    const pick = activeAccounts.find((a) => String(a.id) === String(saved)) || activeAccounts[0];
    setAccountId(String(pick.id));
  }, [user?.id, activeAccounts, accountId]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const sync = () => {
      const saved = localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id));
      if (saved && activeAccounts.some((a) => String(a.id) === saved)) setAccountId((cur) => (cur === saved ? cur : saved));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [user?.id, activeAccounts]);

  const chooseAccount = (value) => {
    flush();
    setAccountId(value);
    if (user?.id) {
      localStorage.setItem(HEADER_ACCOUNT_STORAGE_KEY(user.id), value);
      window.dispatchEvent(new Event("dz-account"));
    }
  };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("date", date);
    if (accountId) next.set("account", accountId);
    if (view === "journal") next.set("tab", "journal");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [date, accountId, view]);

  const account = activeAccounts.find((a) => String(a.id) === String(accountId)) || null;
  const balance = accountBaseBalance(account);
  const pairs = Array.isArray(user?.bias_pairs) && user.bias_pairs.length ? user.bias_pairs : DEFAULT_BIAS_PAIRS;

  /* ---------------- wyliczenia dnia */
  const sessions = useMemo(() => sessionsForDate(date), [date]);
  const views = useMemo(() => dayTradesFor(trades, accountId, date), [trades, accountId, date]);
  const stats = useMemo(() => statsOf(views), [views]);
  const isToday = date === todayIso;
  const nowMin = isToday ? now.minutes : 0;

  const discipline = useMemo(
    () => (doc ? disciplineOf({ doc, views, balance, sessions }) : { prep: { done: 0, total: 5, list: [] }, trade: { done: 0, total: 6, list: [] }, refl: { done: 0, total: 4, list: [] }, done: 0, total: 15, score: 0 }),
    [doc, views, balance, sessions]
  );
  ctxRef.current = { views, balance, sessions };

  /* ---------------- wczytanie dnia */
  const lastPlanBefore = useCallback(
    (iso) => plans.filter((p) => p.date < iso).sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    [plans]
  );

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !accountId) return undefined;
    setLoading(true);
    getDayPlan(user.id, accountId, date)
      .then((existing) => {
        if (cancelled) return;
        let base = existing;
        if (!base) {
          base = emptyDayPlan({ accountId, date, language: "pl" });
          base.parameters = { ...base.parameters, max_risk_percent: 0.5 };
          const prev = lastPlanBefore(date);
          if (prev?.parameters) base.parameters = { ...base.parameters, trade_limit: prev.parameters.trade_limit ?? 3, max_risk_percent: prev.parameters.max_risk_percent ?? 0.5 };
          if (prev?.limits) base.limits = { daily_stop_percent: prev.limits.daily_stop_percent };
        }
        const next = normalizeDayPlan(base, { accountId, date, language: "pl" });
        docRef.current = next;
        setDoc(next);
        setDirty(false);
        setSaveState("idle");
      })
      .catch((err) => !cancelled && toast.error(err?.message || "Nie udało się wczytać dnia."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id, accountId, date]);

  /* ---------------- zapis */
  const persist = useCallback(
    async (target) => {
      if (!user?.id || !target) return null;
      const ctx = ctxRef.current;
      const disc = disciplineOf({ doc: target, ...ctx });
      const payload = {
        ...target,
        discipline_day: { score: disc.score, prep: disc.prep.done, trade: disc.trade.done, review: disc.refl.done, total: disc.total },
      };
      setSaveState("saving");
      try {
        const saved = await saveDayPlan(user.id, payload);
        queryClient.setQueryData(["dayPlansV2", user.id, String(target.account_id)], (old) => {
          const list = Array.isArray(old) ? old.filter((p) => p.id !== saved.id) : [];
          return [saved, ...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        });
        queryClient.invalidateQueries({ queryKey: ["dayPlansHistory", user.id] });
        if (docRef.current === target) setDirty(false);
        setSaveState("saved");
        return saved;
      } catch (err) {
        setSaveState("error");
        toast.error(err?.message || "Nie udało się zapisać dnia.");
        return null;
      }
    },
    [user?.id, queryClient]
  );

  const flush = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (docRef.current && !isClosed(docRef.current)) persist(docRef.current);
  }, [persist]);

  useEffect(() => () => flush(), [flush]);

  const patch = useCallback(
    (updater) => {
      setDoc((prev) => {
        if (!prev) return prev;
        const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
        docRef.current = next;
        return next;
      });
      setDirty(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const current = docRef.current;
        if (current && !isClosed(current)) persist(current);
      }, SAVE_DELAY_MS);
    },
    [persist]
  );

  /* ---------------- historia dni, seria, odznaki */
  const plansWithCurrent = useMemo(() => {
    if (!doc) return plans;
    return [...plans.filter((p) => p.date !== doc.date), doc];
  }, [plans, doc]);
  const plansByDate = useMemo(() => new Map(plansWithCurrent.map((p) => [p.date, p])), [plansWithCurrent]);
  const heat = useMemo(() => heatmap(plansByDate, todayIso), [plansByDate, todayIso]);
  const streak = useMemo(() => closedStreak(plansByDate, todayIso), [plansByDate, todayIso]);
  const avg30 = useMemo(() => averageScore(plansWithCurrent.map((p) => (p === doc ? { ...p, discipline_day: { score: discipline.score } } : p)), todayIso), [plansWithCurrent, doc, discipline.score, todayIso]);
  const badges = useMemo(() => badgeProgress({ plans: plansWithCurrent, trades, accountId, pairs }), [plansWithCurrent, trades, accountId, pairs]);

  const promise = useMemo(() => {
    const prev = plans
      .filter((p) => p.date < date && p.status === "closed" && String(p?.promise?.tomorrow_rule || "").trim())
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return prev ? { rule: prev.promise.tomorrow_rule.trim(), dateLabel: format(dateOf(prev.date), "EEEE, d MMMM", { locale: pl }) } : null;
  }, [plans, date]);

  /* ---------------- akcje */
  const phase = flowPhase(doc);
  const closed = isClosed(doc);
  const missing = doc ? planMissing(doc, pairs) : [];
  const limit = effectiveTradeLimit(doc);
  const stopMoney = balance > 0 ? (balance * dailyStopPercent(doc)) / 100 : null;
  const news = useMemo(() => newsOfDay(doc?.news_manual), [doc?.news_manual]);
  const next = doc ? nextStep(doc, pairs, views) : { label: "…", action: "", disabled: true };

  const go = (p) => {
    patch((prev) => ({
      ...prev,
      flow_phase: p,
      status: isClosed(prev) ? prev.status : p >= 1 ? "active" : prev.status === "active" ? "ready" : prev.status,
    }));
    document.querySelector(".dz")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const addNote = (text) =>
    patch((prev) => ({
      ...prev,
      session_notes: [{ id: createId(), text: String(text).slice(0, 500), tags: [], created_at: new Date().toISOString() }, ...(prev.session_notes || [])],
    }));
  const removeNote = (note) => patch((prev) => ({ ...prev, session_notes: (prev.session_notes || []).filter((n) => n !== note && (!note.id || n.id !== note.id)) }));

  const closeDay = async () => {
    if (!doc) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const before = new Set(badges.filter((b) => b.earned).map((b) => b.key));
    const target = { ...doc, status: "closed", flow_phase: 3, closed_at: new Date().toISOString() };
    docRef.current = target;
    setDoc(target);
    const saved = await persist(target);
    if (!saved) return;
    const after = badgeProgress({ plans: [...plans.filter((p) => p.date !== target.date), target], trades, accountId, pairs });
    const fresh = after.find((b) => b.earned && !before.has(b.key));
    if (fresh) {
      setNewBadgeKey(fresh.key);
      toast.success(`Dzień zamknięty. Nowa odznaka: ${fresh.name}!`);
      setTimeout(() => setNewBadgeKey(null), 2500);
    } else {
      toast.success("Dzień zamknięty i wliczony do serii.");
    }
  };

  const saveChanges = async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if ((await persist(docRef.current)) != null) toast.success("Zapisano zmiany.");
  };

  const onNext = (action) => {
    if (action === "plan") {
      go(0);
      setTimeout(() => document.querySelector(".dz .mood, .dz .sess")?.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    } else if (action === "go1") {
      toast.success("Plan zapisany. Powodzenia na sesji.");
      go(1);
    } else if (action === "go2" || action === "import") go(2);
    else if (action === "go3") go(3);
    else if (action === "close") closeDay();
  };

  const changePairs = async (list) => {
    patchUser?.({ bias_pairs: list });
    try {
      await updateUser(user.id, { bias_pairs: list });
    } catch {
      toast.error("Nie udało się zapisać listy par.");
    }
  };

  const changeDate = (iso) => {
    flush();
    setDate(iso);
  };

  if (!user?.id) return <div className="p-6 text-center text-muted-foreground">Zaloguj się, aby korzystać ze strony Dzień.</div>;

  const dateLabel = format(dateOf(date), "EEEE, d MMMM", { locale: pl });
  const shortDate = format(dateOf(date), "EEEEEE · dd.MM.yyyy", { locale: pl });
  const notesCount = Array.isArray(doc?.session_notes) ? doc.session_notes.length : 0;
  const withSetup = views.filter((v) => v.strategyId).length;
  const importDone = doc ? isImportDone(doc, views) : false;
  const stepSubs = [
    missing.length ? `brakuje: ${missing.length}` : "gotowe",
    `${stats.n}/${limit} trans. · ${notesCount} notatek`,
    importDone ? (views.length ? `${withSetup}/${views.length} z setupem` : "brak transakcji") : "MT5",
    doc?.plan_adherence ? `ocena ${doc.plan_adherence}/5` : "wynik i wnioski",
  ];
  const stepDone = [!missing.length, phase > 1 || closed, importDone && views.every((v) => v.strategyId), closed];
  const liveScores = doc && !closed ? { [doc.date]: discipline.score } : {};

  return (
    <div className="dz">
      <div className="head">
        <h1>Dzień</h1>
        <div className="tabs" role="tablist" aria-label="Widok">
          <button type="button" role="tab" aria-selected={view === "day"} className={view === "day" ? "on" : ""} onClick={() => setView("day")}>
            Mój dzień
          </button>
          <button type="button" role="tab" aria-selected={view === "journal"} className={view === "journal" ? "on" : ""} onClick={() => setView("journal")}>
            Dziennik dni
          </button>
        </div>
        <div className="hctl">
          {view === "day" ? (
            <span className="pill">
              <button type="button" className="nav" aria-label="Poprzedni dzień" onClick={() => changeDate(shiftDays(date, -1))}>
                <ChevronLeft className="ico" />
              </button>
              <span className="mono" style={{ textTransform: "capitalize" }}>
                {shortDate}
              </span>
              <button type="button" className="nav" aria-label="Następny dzień" onClick={() => changeDate(shiftDays(date, 1))}>
                <ChevronRight className="ico" />
              </button>
              {!isToday ? (
                <button type="button" className="todaybtn" onClick={() => changeDate(todayIso)}>
                  Dziś
                </button>
              ) : null}
            </span>
          ) : null}
          <span className="pill">
            <span className="dot" />
            <select value={accountId} onChange={(e) => chooseAccount(e.target.value)} aria-label="Konto">
              {activeAccounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                  {a.account_number ? ` · ${a.account_number}` : ""}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      {!activeAccounts.length ? (
        <div className="empty">
          Dodaj konto w zakładce <Link to={createPageUrl("Accounts")}>Konta</Link>, żeby zaplanować dzień.
        </div>
      ) : view === "journal" ? (
        <DayJournal
          trades={trades}
          plans={plansWithCurrent}
          accountId={accountId}
          monthIso={monthIso}
          onMonth={setMonthIso}
          todayIso={todayIso}
          strategies={strategies}
          liveScores={liveScores}
          onOpenDay={(iso) => {
            changeDate(iso);
            setView("day");
            document.querySelector(".dz")?.scrollIntoView({ block: "start" });
          }}
        />
      ) : loading || !doc ? (
        <div className="empty">Wczytuję dzień…</div>
      ) : (
        <>
          <DayHero
            dateLabel={dateLabel}
            isToday={isToday}
            nowMin={nowMin}
            sessions={sessions}
            selectedId={doc.mapping_session}
            views={views}
            stats={stats}
            limit={limit}
            discipline={discipline}
            news={news}
            next={next}
            onNext={onNext}
            onWork={() => setWorkOpen(true)}
          />

          <div className="steps" role="tablist" aria-label="Etapy dnia">
            {STEP_NAMES.map((name, i) => (
              <button key={name} type="button" role="tab" aria-selected={phase === i} className={`step${phase === i ? " on" : ""}${phase !== i && stepDone[i] ? " done" : ""}`} onClick={() => go(i)}>
                <span className="num">{i + 1}</span>
                <div>
                  <div className="t">{name}</div>
                  <div className="s">{stepSubs[i]}</div>
                </div>
              </button>
            ))}
            <button type="button" className={`step lock${closed ? " done" : ""}`} onClick={() => go(3)}>
              <span className="num">
                <Lock className="ico" style={{ width: 14, height: 14 }} />
              </span>
              <div>
                <div className="t">Zamknij dzień</div>
                <div className="s">{closed ? "zamknięty" : "liczy się do serii"}</div>
              </div>
            </button>
          </div>

          <div className="dz-grid">
            <div className="dz-col">
              {closed && dirty && phase !== 3 ? (
                <div className="alert">
                  <span style={{ flex: 1 }}>
                    <b>Dzień jest zamknięty.</b> Zmiany zapiszą się dopiero po kliknięciu „Zapisz zmiany”.
                  </span>
                  <button type="button" className="btn sm ok" onClick={saveChanges}>
                    Zapisz zmiany
                  </button>
                </div>
              ) : null}
              {phase === 0 ? (
                <StepPlan
                  doc={doc}
                  patch={patch}
                  pairs={pairs}
                  onPairsChange={changePairs}
                  sessions={sessions}
                  nowMin={nowMin}
                  isToday={isToday}
                  promise={promise}
                  missing={missing}
                  onGoTrade={() => onNext("go1")}
                />
              ) : phase === 1 ? (
                <StepTrade
                  doc={doc}
                  dateIso={date}
                  isToday={isToday}
                  nowMin={nowMin}
                  stats={stats}
                  views={views}
                  limit={limit}
                  stopMoney={stopMoney}
                  session={sessions.find((s) => s.id === doc.mapping_session)}
                  checks={discipline.trade.list}
                  onAddNote={addNote}
                  onRemoveNote={removeNote}
                  onGo={go}
                />
              ) : phase === 2 ? (
                <StepImport
                  user={user}
                  account={account}
                  doc={doc}
                  views={views}
                  strategies={strategies}
                  onImportDone={() => patch((p) => ({ ...p, import_done_at: new Date().toISOString() }))}
                  onGo={go}
                />
              ) : (
                <StepReview
                  doc={doc}
                  patch={patch}
                  views={views}
                  stats={stats}
                  discipline={discipline}
                  promise={promise}
                  closed={closed}
                  dirty={dirty}
                  cardProps={{
                    dateLabel: `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} ${date.slice(0, 4)}`,
                    sessionName: sessions.find((s) => s.id === doc.mapping_session)?.name,
                    accountLabel: account?.name || "",
                    streak,
                  }}
                  onClose={closeDay}
                  onSaveChanges={saveChanges}
                  onGo={go}
                />
              )}
              <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span>
                  {saveState === "saving"
                    ? "Zapisuję…"
                    : saveState === "error"
                      ? "Błąd zapisu — spróbuj ponownie"
                      : closed
                        ? dirty
                          ? "Niezapisane zmiany"
                          : "Dzień zamknięty"
                        : saveState === "saved"
                          ? "Zapisano automatycznie"
                          : "Zapis automatyczny"}
                </span>
                <Link to={createPageUrl("DayPlan")} style={{ color: "var(--mute)", textDecoration: "underline" }}>
                  Poprzednia wersja strony
                </Link>
              </div>
            </div>
            <DayAside
              doc={doc}
              promise={promise}
              discipline={discipline}
              heat={heat}
              streak={streak}
              avg30={avg30}
              badges={badges}
              newBadgeKey={newBadgeKey}
              account={account}
              balance={balance}
              stats={stats}
              sessions={sessions}
              pairs={pairs}
            />
          </div>

          <WorkMode
            open={workOpen}
            onClose={() => setWorkOpen(false)}
            doc={doc}
            dateIso={date}
            nowMin={now.minutes}
            sessions={sessionsForDate(todayIso)}
            news={news}
            stats={stats}
            limit={limit}
            stopMoney={stopMoney}
            discipline={discipline}
            onAddNote={(text) => {
              addNote(text);
              toast.success("Notatka zapisana.");
            }}
          />
        </>
      )}
    </div>
  );
}
