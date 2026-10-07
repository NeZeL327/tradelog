import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Settings2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { getDayPlan, HEADER_ACCOUNT_STORAGE_KEY } from "@/lib/dayPlanStorage";
import {
  dayPlanNextAction,
  focusStatusLabel,
  isFocusComplete,
  normalizeDayPlan,
  todayIso,
} from "@/lib/dayPlanModel";
import {
  formatSessionRange,
  getActiveTradingSession,
} from "@/lib/tradingSessions";
import { getTrades, getTradingAccounts, updateTradingAccount } from "@/lib/localStorage";
import { createPageUrl } from "@/utils";
import { getTradeRealizedPL, isClosedTrade, isTradingAccountActive, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

function ringStyle(ratio) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return {
    background: `conic-gradient(hsl(var(--primary)) ${pct}%, hsl(var(--muted)) 0)`,
  };
}

function Meter({ label, current, max, unit }) {
  const configured = Number.isFinite(max) && max > 0;
  const value = Number.isFinite(current) ? Math.abs(current) : 0;
  const ratio = configured ? Math.min(1, value / max) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium leading-tight text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/20" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: configured ? `${Math.max(pct, value > 0 ? 4 : 0)}%` : "0%",
              opacity: configured ? 1 : 0,
            }}
          />
        </div>
        <p className="data-mono shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
          {configured
            ? `${Math.round(value).toLocaleString()} / ${Math.round(max).toLocaleString()}${unit ? ` ${unit}` : ""}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

export default function SessionRhythmBar() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitForm, setLimitForm] = useState({
    max_daily_loss_percent: "",
    max_account_loss: "",
    profit_target: "",
  });
  const date = todayIso();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const sync = () => {
      const saved = localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id));
      if (saved) setAccountId(String(saved));
    };
    sync();
    window.addEventListener("storage", sync);
    const timer = setInterval(sync, 1500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(timer);
    };
  }, [user?.id]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user.id),
    enabled: !!user?.id,
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", user?.id],
    queryFn: () => getTrades(user.id),
    enabled: !!user?.id,
  });

  const account = useMemo(() => {
    const active = accounts.filter(isTradingAccountActive);
    return active.find((a) => String(a.id) === String(accountId)) || active[0] || null;
  }, [accounts, accountId]);

  useEffect(() => {
    if (account?.id && !accountId) setAccountId(String(account.id));
  }, [account, accountId]);

  const { data: planRaw } = useQuery({
    queryKey: ["dayPlanProgress", user?.id, account?.id, date],
    queryFn: () => getDayPlan(user.id, account.id, date),
    enabled: !!user?.id && !!account?.id,
  });

  const plan = useMemo(
    () =>
      planRaw
        ? normalizeDayPlan(planRaw, {
            accountId: account?.id,
            date,
            language: language === "en" ? "en" : "pl",
          })
        : null,
    [planRaw, account?.id, date, language]
  );

  const focusDone = isFocusComplete(plan?.focus);
  const progressRatio = focusDone ? 1 : plan?.focus?.score != null ? 0.5 : 0;

  const session = getActiveTradingSession(now);
  const sessionLabel = session
    ? language === "en"
      ? session.labelEn
      : session.labelPl
    : t("sessionClosed") || "Poza sesją";

  const next = dayPlanNextAction(plan, session?.id || plan?.mapping_session, language === "en" ? "en" : "pl");
  const nextAction = next.label;
  const nextHref = (() => {
    const base = createPageUrl("DayPlan");
    const params = new URLSearchParams();
    if (account?.id) params.set("account", String(account.id));
    params.set("date", date);
    if (next.view) params.set("view", next.view);
    if (next.session) params.set("session", next.session);
    if (next.horizon) params.set("horizon", next.horizon);
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  })();
  const focusLabel = plan
    ? focusStatusLabel(plan.focus, language === "en" ? "en" : "pl")
    : language === "en"
      ? "no plan"
      : "brak planu";

  const accountTrades = useMemo(
    () => trades.filter((tr) => String(tr.account_id) === String(account?.id) && isClosedTrade(tr)),
    [trades, account?.id]
  );

  const todayPl = useMemo(
    () =>
      accountTrades
        .filter((tr) => String(tr.date || "").slice(0, 10) === date)
        .reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0),
    [accountTrades, date]
  );

  const totalPl = useMemo(
    () => accountTrades.reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0),
    [accountTrades]
  );

  const initial = Number(account?.initial_balance) || 0;
  const current = Number.isFinite(Number(account?.current_balance))
    ? Number(account.current_balance)
    : initial + totalPl;
  const currency = account?.currency || "";

  const dailyLimit =
    initial > 0 && Number(account?.max_daily_loss_percent) > 0
      ? (initial * Number(account.max_daily_loss_percent)) / 100
      : null;

  const ddLimit =
    initial > 0 && Number(account?.max_account_loss) > 0
      ? (initial * Number(account.max_account_loss)) / 100
      : null;

  const peak = useMemo(() => {
    let running = initial;
    let peakEq = initial;
    const sorted = [...accountTrades].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    for (const tr of sorted) {
      running += getTradeRealizedPL(tr) ?? 0;
      if (running > peakEq) peakEq = running;
    }
    return peakEq;
  }, [accountTrades, initial]);

  const currentDd = Math.max(0, peak - current);
  const challengeTarget = Number(account?.profit_target);
  const challengeCurrent = Math.max(0, current - initial);

  const openLimits = () => {
    if (!account) {
      toast.error(t("noAccountSelected") || "Brak konta");
      return;
    }
    setLimitForm({
      max_daily_loss_percent: account.max_daily_loss_percent?.toString() || "",
      max_account_loss: account.max_account_loss?.toString() || "",
      profit_target: account.profit_target?.toString() || "",
    });
    setLimitsOpen(true);
  };

  const saveLimits = useMutation({
    mutationFn: async () => {
      if (!user?.id || !account?.id) throw new Error("Brak konta");
      return updateTradingAccount(user.id, account.id, {
        max_daily_loss_percent: limitForm.max_daily_loss_percent
          ? parseFloat(limitForm.max_daily_loss_percent)
          : null,
        max_account_loss: limitForm.max_account_loss ? parseFloat(limitForm.max_account_loss) : null,
        profit_target: limitForm.profit_target ? parseFloat(limitForm.profit_target) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", user?.id] });
      toast.success(t("limitsSaved") || "Limity konta zapisane");
      setLimitsOpen(false);
    },
    onError: (err) => {
      toast.error(err?.message || t("limitsSaveError") || "Nie udało się zapisać limitów");
    },
  });

  return (
    <section className="border-b border-border/50 bg-[hsl(var(--app-shell))] px-1 py-1.5 sm:px-2">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-2 xl:flex-row xl:items-stretch xl:gap-3">
        {/* Rytm Sesji — distinct navy card with separators */}
        <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-0 overflow-hidden rounded-lg border border-[hsl(var(--window-border)/0.9)] bg-[hsl(var(--window-bg))] shadow-[var(--window-shadow)] sm:flex-nowrap">
          <div className="flex min-w-[170px] flex-1 items-center gap-2 px-2.5 py-1.5 sm:px-3">
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={ringStyle(progressRatio)}
              aria-label={focusLabel}
            >
              <div className="data-mono flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--window-bg))] text-[10px] font-semibold tabular-nums text-foreground">
                {focusDone ? <Check className="h-3.5 w-3.5 text-profit" /> : plan?.focus?.score != null ? `${plan.focus.score}/2` : "—"}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("sessionRhythm") || "Rytm Sesji"}
              </p>
              <p className="truncate text-[12px] text-foreground">
                {plan
                  ? `${t("dayPlan") || "Plan dnia"} · ${focusLabel}`
                  : t("dayPlanNoChecklist") || "Brak planu na dziś"}
              </p>
              <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-primary/15 sm:w-36">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressRatio * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="hidden w-px self-stretch bg-[hsl(var(--window-border)/0.75)] sm:block" aria-hidden />

          <div className="flex min-w-[110px] flex-col justify-center px-2.5 py-1.5 sm:px-3">
            <p className="text-[10px] text-muted-foreground">{t("activeSession") || "Aktywna sesja"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", session ? "bg-profit" : "bg-muted-foreground")} />
              {sessionLabel}
            </p>
            <p className="data-mono mt-0.5 text-[10px] text-muted-foreground">
              {session ? formatSessionRange(session) : "—"}
            </p>
          </div>

          <div className="hidden w-px self-stretch bg-[hsl(var(--window-border)/0.75)] sm:block" aria-hidden />

          <div className="flex min-w-[120px] flex-col justify-center px-2.5 py-1.5 sm:px-3">
            <p className="text-[10px] text-muted-foreground">{t("account") || "Konto"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-medium text-foreground">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{account?.name || t("noAccountSelected") || "Brak konta"}</span>
            </p>
          </div>

          <div className="hidden w-px self-stretch bg-[hsl(var(--window-border)/0.75)] sm:block" aria-hidden />

          <div className="flex min-w-[110px] flex-col justify-center px-2.5 py-1.5 sm:px-3">
            <p className="text-[10px] text-muted-foreground">{t("dayPlanFocus") || "Skupienie"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-medium text-foreground">
              {focusDone ? <Check className="h-3.5 w-3.5 shrink-0 text-profit" /> : null}
              <span className="truncate">{focusLabel}</span>
            </p>
          </div>

          <div className="hidden w-px self-stretch bg-[hsl(var(--window-border)/0.75)] sm:block" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5 sm:px-3">
            <p className="text-[10px] text-muted-foreground">{t("nextAction") || "Następne działanie"}</p>
            <Link
              to={nextHref}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-primary hover:underline"
            >
              <span className="truncate">{nextAction}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </div>
        </div>

        {/* Limity konta — matching card with progress bars */}
        <div className="min-w-0 rounded-lg border border-[hsl(var(--window-border)/0.9)] bg-[hsl(var(--window-bg))] px-2.5 py-1.5 shadow-[var(--window-shadow)] xl:min-w-[420px] xl:w-[460px] xl:shrink-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("accountLimits") || "Limity konta"}
            </p>
            <button
              type="button"
              onClick={openLimits}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("configure") || "Ustaw"}
            </button>
          </div>
          {dailyLimit != null || ddLimit != null || (Number.isFinite(challengeTarget) && challengeTarget > 0) ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <Meter
                label={t("dailyLimit") || "Limit dzienny"}
                current={dailyLimit != null ? Math.abs(todayPl) : 0}
                max={dailyLimit}
                unit={currency}
              />
              <Meter
                label={t("maxDrawdown") || "Max drawdown"}
                current={ddLimit != null ? currentDd : 0}
                max={ddLimit}
                unit={currency}
              />
              <Meter
                label={t("challengeGoal") || "Cel challenge"}
                current={Number.isFinite(challengeTarget) && challengeTarget > 0 ? challengeCurrent : 0}
                max={Number.isFinite(challengeTarget) && challengeTarget > 0 ? challengeTarget : null}
                unit={currency}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={openLimits}
              className="flex w-full items-center justify-between rounded-lg border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:border-primary/55 hover:bg-primary/10"
            >
              <span className="text-[13px] text-muted-foreground">
                {t("limitsNotConfigured") || "Limity nie są skonfigurowane dla tego konta"}
              </span>
              <span className="shrink-0 text-[12px] font-medium text-primary">
                {t("configure") || "Ustaw"}
              </span>
            </button>
          )}
        </div>
      </div>

      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("accountLimits") || "Limity konta"}
              {account?.name ? ` — ${account.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{t("dailyLimitPercent") || "Max dzienna strata (%)"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={limitForm.max_daily_loss_percent}
                onChange={(e) => setLimitForm((prev) => ({ ...prev, max_daily_loss_percent: e.target.value }))}
                placeholder="np. 5"
              />
            </div>
            <div>
              <Label>{t("maxAccountLossPercent") || "Max drawdown konta (%)"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={limitForm.max_account_loss}
                onChange={(e) => setLimitForm((prev) => ({ ...prev, max_account_loss: e.target.value }))}
                placeholder="np. 10"
              />
            </div>
            <div>
              <Label>
                {t("challengeGoal") || "Cel challenge"} ({currency || t("amount") || "kwota"})
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={limitForm.profit_target}
                onChange={(e) => setLimitForm((prev) => ({ ...prev, profit_target: e.target.value }))}
                placeholder="np. 25000"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("limitsHelp") ||
                "Limit dzienny i drawdown liczone są od salda początkowego. Cel challenge to kwota zysku."}
            </p>
            {!account && (
              <p className="text-[12px] text-loss">
                <Link to={createPageUrl("Accounts")} className="underline">
                  {t("addAccountFirst") || "Najpierw dodaj konto"}
                </Link>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLimitsOpen(false)}>
              {t("cancel") || "Anuluj"}
            </Button>
            <Button
              type="button"
              disabled={!account || saveLimits.isPending}
              onClick={() => saveLimits.mutate()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("save") || "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
