// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getTrades, getTradingAccounts } from "@/lib/localStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Flame,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  XCircle
} from "lucide-react";
import { format, subDays } from "date-fns";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toDayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "yyyy-MM-dd");
};

const parseDateFromTrade = (trade) => {
  if (!trade) return null;
  const direct = trade.date || trade.createdAt || trade.updatedAt;
  if (direct?.toDate) return direct.toDate();
  if (direct) {
    const date = new Date(direct);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const parsePL = (trade) => {
  const candidates = [
    trade?.profit_loss,
    trade?.profitLoss,
    trade?.pnl,
    trade?.netPL,
    trade?.result
  ];
  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const isWin = (trade, pl) => {
  const raw = String(trade?.outcome || trade?.status || "").toLowerCase();
  if (raw.includes("win")) return true;
  if (raw.includes("loss")) return false;
  return pl > 0;
};

const isLoss = (trade, pl) => {
  const raw = String(trade?.outcome || trade?.status || "").toLowerCase();
  if (raw.includes("loss")) return true;
  if (raw.includes("win")) return false;
  return pl < 0;
};

const formatCurrency = (value) => {
  const num = Number(value || 0);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}`;
};

const createRule = (kind = "maxDailyLoss") => {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const presets = {
    maxDailyLoss: { name: "Max daily loss", threshold: 100 },
    maxLossTrade: { name: "Max loss per trade", threshold: 50 },
    minWinRate: { name: "Min win rate (%)", threshold: 45 },
    maxConsecutiveLosses: { name: "Max consecutive losses", threshold: 3 },
    minProfitFactor: { name: "Min profit factor", threshold: 1.2 }
  };
  const preset = presets[kind] || presets.maxDailyLoss;
  return {
    id,
    kind,
    name: preset.name,
    threshold: preset.threshold,
    enabled: true
  };
};

const defaultChecklistTemplate = [
  { id: "prep", label: "Przygotowałem plan sesji", required: true },
  { id: "risk", label: "Ryzyko na trade ustawione", required: true },
  { id: "setup", label: "Każdy trade zgodny z setupem", required: true },
  { id: "review", label: "Uzupełniłem review po sesji", required: true }
];

const evaluateRuleForDay = (rule, dayTrades) => {
  if (!rule?.enabled) return null;
  if (!Array.isArray(dayTrades) || dayTrades.length === 0) return null;

  const tradePL = dayTrades.map((trade) => ({ trade, pl: parsePL(trade) }));

  if (rule.kind === "maxDailyLoss") {
    const net = tradePL.reduce((sum, item) => sum + item.pl, 0);
    return Math.abs(Math.min(0, net)) <= Number(rule.threshold || 0);
  }

  if (rule.kind === "maxLossTrade") {
    const biggestLoss = Math.max(0, ...tradePL.map((item) => Math.abs(Math.min(0, item.pl))));
    return biggestLoss <= Number(rule.threshold || 0);
  }

  if (rule.kind === "minWinRate") {
    const wins = tradePL.filter((item) => isWin(item.trade, item.pl)).length;
    const rate = (wins / tradePL.length) * 100;
    return rate >= Number(rule.threshold || 0);
  }

  if (rule.kind === "maxConsecutiveLosses") {
    let current = 0;
    let max = 0;
    tradePL.forEach((item) => {
      if (isLoss(item.trade, item.pl)) {
        current += 1;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    });
    return max <= Number(rule.threshold || 0);
  }

  if (rule.kind === "minProfitFactor") {
    const grossProfit = tradePL.filter((item) => item.pl > 0).reduce((sum, item) => sum + item.pl, 0);
    const grossLossAbs = Math.abs(tradePL.filter((item) => item.pl < 0).reduce((sum, item) => sum + item.pl, 0));
    const pf = grossLossAbs === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLossAbs;
    return pf >= Number(rule.threshold || 0);
  }

  return null;
};

export default function ProgressTracker() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [range, setRange] = useState("30d");
  const [accountFilter, setAccountFilter] = useState("all");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);

  const [rules, setRules] = useState([
    createRule("maxDailyLoss"),
    createRule("maxLossTrade"),
    createRule("minWinRate")
  ]);
  const [checklistTemplate, setChecklistTemplate] = useState(defaultChecklistTemplate);
  const [dailyChecks, setDailyChecks] = useState({});
  const [ruleDraft, setRuleDraft] = useState({ kind: "maxDailyLoss", name: "", threshold: 100 });
  const [checklistDraft, setChecklistDraft] = useState("");

  const [selectedDay, setSelectedDay] = useState(() => toDayKey(new Date()));
  const hydratedRef = useRef(false);

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: Boolean(user?.id)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user?.id),
    enabled: Boolean(user?.id)
  });

  useEffect(() => {
    if (!user?.id) return undefined;
    const refDoc = doc(db, "users", String(user.id), "progress", "tracker");

    const unsubscribe = onSnapshot(refDoc, (snapshot) => {
      if (!snapshot.exists()) {
        hydratedRef.current = true;
        return;
      }

      const data = snapshot.data();
      if (Array.isArray(data.rules) && data.rules.length > 0) {
        setRules(data.rules);
      }
      if (Array.isArray(data.checklistTemplate) && data.checklistTemplate.length > 0) {
        setChecklistTemplate(data.checklistTemplate);
      }
      if (data.dailyChecks && typeof data.dailyChecks === "object") {
        setDailyChecks(data.dailyChecks);
      }
      hydratedRef.current = true;
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !hydratedRef.current) return;
    const refDoc = doc(db, "users", String(user.id), "progress", "tracker");
    void setDoc(
      refDoc,
      {
        rules,
        checklistTemplate,
        dailyChecks,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }, [rules, checklistTemplate, dailyChecks, user?.id]);

  const daysCount = useMemo(() => {
    if (range === "7d") return 7;
    if (range === "90d") return 90;
    if (range === "180d") return 180;
    return 30;
  }, [range]);

  const sinceDate = useMemo(() => subDays(new Date(), daysCount - 1), [daysCount]);

  const filteredTrades = useMemo(() => {
    return trades
      .filter((trade) => {
        const date = parseDateFromTrade(trade);
        if (!date) return false;
        if (date < sinceDate) return false;

        if (accountFilter === "all") return true;
        const tradeAccount = String(trade.account_id || trade.accountId || "");
        return tradeAccount === String(accountFilter);
      })
      .sort((a, b) => {
        const da = parseDateFromTrade(a)?.getTime() || 0;
        const db = parseDateFromTrade(b)?.getTime() || 0;
        return da - db;
      });
  }, [trades, sinceDate, accountFilter]);

  const tradesByDay = useMemo(() => {
    const map = {};
    filteredTrades.forEach((trade) => {
      const dayKey = toDayKey(parseDateFromTrade(trade));
      if (!dayKey) return;
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(trade);
    });
    return map;
  }, [filteredTrades]);

  const metrics = useMemo(() => {
    const withPL = filteredTrades.map((trade) => {
      const pl = parsePL(trade);
      return { trade, pl };
    });

    const totalTrades = withPL.length;
    const wins = withPL.filter((item) => isWin(item.trade, item.pl)).length;
    const losses = withPL.filter((item) => isLoss(item.trade, item.pl)).length;
    const breakeven = totalTrades - wins - losses;

    const grossProfit = withPL.filter((item) => item.pl > 0).reduce((sum, item) => sum + item.pl, 0);
    const grossLossAbs = Math.abs(withPL.filter((item) => item.pl < 0).reduce((sum, item) => sum + item.pl, 0));
    const net = grossProfit - grossLossAbs;
    const avgWin = wins ? grossProfit / wins : 0;
    const avgLoss = losses ? -grossLossAbs / losses : 0;
    const profitFactor = grossLossAbs === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLossAbs;
    const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
    const expectancy = totalTrades ? net / totalTrades : 0;

    let running = 0;
    let peak = 0;
    let maxDrawdown = 0;
    withPL.forEach((item) => {
      running += item.pl;
      peak = Math.max(peak, running);
      maxDrawdown = Math.max(maxDrawdown, peak - running);
    });

    return {
      totalTrades,
      wins,
      losses,
      breakeven,
      net,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      maxDrawdown
    };
  }, [filteredTrades]);

  const checklistForDay = useMemo(() => {
    const current = dailyChecks[selectedDay] || {};
    return checklistTemplate.map((item) => ({
      ...item,
      done: Boolean(current[item.id])
    }));
  }, [checklistTemplate, dailyChecks, selectedDay]);

  const checklistCompletion = useMemo(() => {
    if (!checklistForDay.length) return 0;
    const done = checklistForDay.filter((item) => item.done).length;
    return Math.round((done / checklistForDay.length) * 100);
  }, [checklistForDay]);

  const rulesSummary = useMemo(() => {
    const dayKeys = Object.keys(tradesByDay).sort();
    return rules.map((rule) => {
      let passDays = 0;
      let evalDays = 0;
      dayKeys.forEach((dayKey) => {
        const result = evaluateRuleForDay(rule, tradesByDay[dayKey] || []);
        if (result === null) return;
        evalDays += 1;
        if (result) passDays += 1;
      });

      const rate = evalDays ? Math.round((passDays / evalDays) * 100) : 0;
      return {
        ...rule,
        passDays,
        evalDays,
        rate,
        status: rate >= 80 ? "ok" : rate >= 60 ? "warn" : "fail"
      };
    });
  }, [rules, tradesByDay]);

  const heatmapDays = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, index) => {
      const date = subDays(new Date(), daysCount - 1 - index);
      const dayKey = toDayKey(date);
      const dayTrades = tradesByDay[dayKey] || [];
      const dayNet = dayTrades.reduce((sum, trade) => sum + parsePL(trade), 0);

      const checks = dailyChecks[dayKey] || {};
      const checklistDone = checklistTemplate.length
        ? checklistTemplate.filter((item) => checks[item.id]).length / checklistTemplate.length
        : 0;

      const dayRuleEvaluations = rules
        .map((rule) => evaluateRuleForDay(rule, dayTrades))
        .filter((value) => value !== null);
      const dayRulePass = dayRuleEvaluations.length
        ? dayRuleEvaluations.filter(Boolean).length / dayRuleEvaluations.length
        : 0;

      const score = Math.round(clamp(checklistDone * 50 + dayRulePass * 50, 0, 100));

      return {
        key: dayKey,
        date,
        trades: dayTrades.length,
        dayNet,
        checklistDone: Math.round(checklistDone * 100),
        rulePass: Math.round(dayRulePass * 100),
        score
      };
    });
  }, [daysCount, tradesByDay, dailyChecks, checklistTemplate, rules]);

  const selectedDayData = useMemo(() => {
    return heatmapDays.find((day) => day.key === selectedDay) || null;
  }, [heatmapDays, selectedDay]);

  const toggleChecklistForSelectedDay = (itemId) => {
    if (!itemId || !selectedDay) return;
    setDailyChecks((prev) => {
      const current = { ...(prev[selectedDay] || {}) };
      current[itemId] = !current[itemId];
      return {
        ...prev,
        [selectedDay]: current
      };
    });
  };

  const resetSelectedDayChecklist = () => {
    if (!selectedDay) return;
    setDailyChecks((prev) => ({
      ...prev,
      [selectedDay]: {}
    }));
    toast.success("Checklist for selected day has been reset");
  };

  const addRule = () => {
    const cleanName = ruleDraft.name?.trim();
    const nextRule = createRule(ruleDraft.kind || "maxDailyLoss");
    setRules((prev) => [
      ...prev,
      {
        ...nextRule,
        name: cleanName || nextRule.name,
        threshold: Number(ruleDraft.threshold || nextRule.threshold)
      }
    ]);
    setRuleDraft({ kind: "maxDailyLoss", name: "", threshold: 100 });
  };

  const removeRule = (ruleId) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  const addChecklistItem = () => {
    const label = checklistDraft.trim();
    if (!label) return;
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setChecklistTemplate((prev) => [...prev, { id, label, required: true }]);
    setChecklistDraft("");
  };

  const removeChecklistItem = (itemId) => {
    setChecklistTemplate((prev) => prev.filter((item) => item.id !== itemId));
    setDailyChecks((prev) => {
      const next = {};
      Object.entries(prev).forEach(([dayKey, checks]) => {
        const clone = { ...(checks || {}) };
        delete clone[itemId];
        next[dayKey] = clone;
      });
      return next;
    });
  };

  const exportCsv = () => {
    const lines = [
      ["Metric", "Value"].join(","),
      ["Trades", metrics.totalTrades].join(","),
      ["Win Rate", `${metrics.winRate.toFixed(2)}%`].join(","),
      ["Net P/L", metrics.net.toFixed(2)].join(","),
      ["Profit Factor", Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "Infinity"].join(","),
      ["Expectancy", metrics.expectancy.toFixed(2)].join(","),
      ["Max Drawdown", metrics.maxDrawdown.toFixed(2)].join(","),
      "",
      ["Day", "Trades", "Net", "Checklist %", "Rules %", "Score"].join(",")
    ];

    heatmapDays.forEach((day) => {
      lines.push([
        day.key,
        day.trades,
        day.dayNet.toFixed(2),
        day.checklistDone,
        day.rulePass,
        day.score
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `progress-tracker-${toDayKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const accountNameMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      map.set(String(account.id), account.name || account.id);
    });
    return map;
  }, [accounts]);

  const recentDaysTable = useMemo(() => {
    return [...heatmapDays].reverse().slice(0, 12);
  }, [heatmapDays]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] p-2 sm:p-3">
      <div className="max-w-none mx-0 space-y-6">
        <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("progressTracker")}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Zaawansowany monitoring dyscypliny i jakości tradingu</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger className="w-36 h-9">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-slate-500" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 dni</SelectItem>
                    <SelectItem value="30d">30 dni</SelectItem>
                    <SelectItem value="90d">90 dni</SelectItem>
                    <SelectItem value="180d">180 dni</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Konto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie konta</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>{acc.name || acc.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" className="h-9 gap-2" onClick={() => setIsChecklistOpen(true)}>
                  <CheckCircle2 className="w-4 h-4" /> Checklist dnia
                </Button>
                <Button variant="outline" className="h-9 gap-2" onClick={() => setIsRulesOpen(true)}>
                  <ShieldCheck className="w-4 h-4" /> Reguły
                </Button>
                <Button className="h-9 gap-2" onClick={exportCsv}>
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Trades</p>
                <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{metrics.totalTrades}</div>
                <p className="text-xs text-slate-500 mt-3">Win rate</p>
                <div className="text-xl font-semibold mt-1 text-slate-900 dark:text-white">{metrics.winRate.toFixed(1)}%</div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Net P/L</p>
                <div className={cn("text-2xl font-bold mt-1", metrics.net >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(metrics.net)}</div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <p className="text-[11px] text-slate-500">Profit factor</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞"}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <p className="text-[11px] text-slate-500">Expectancy</p>
                    <p className={cn("font-semibold", metrics.expectancy >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(metrics.expectancy)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Maks. drawdown</p>
                <div className="text-2xl font-bold mt-1 text-rose-600">-{metrics.maxDrawdown.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Flame className="w-4 h-4" /> Dzień: {selectedDay}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2"><div className="text-xs text-slate-500">Checklist</div><div className="font-semibold text-slate-900 dark:text-white">{checklistCompletion}%</div></div>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2"><div className="text-xs text-slate-500">Trades</div><div className="font-semibold text-slate-900 dark:text-white">{selectedDayData?.trades || 0}</div></div>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2"><div className="text-xs text-slate-500">Rules pass</div><div className="font-semibold text-slate-900 dark:text-white">{selectedDayData?.rulePass || 0}%</div></div>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2"><div className="text-xs text-slate-500">Net</div><div className={cn("font-semibold", (selectedDayData?.dayNet || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(selectedDayData?.dayNet || 0)}</div></div>
              </div>

              <div className="space-y-2 max-h-64 overflow-auto">
                {checklistForDay.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleChecklistForSelectedDay(item.id)}
                    className="w-full flex items-center justify-between text-sm rounded-md border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="text-left text-slate-700 dark:text-slate-200">{item.label}</span>
                    {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="flex-1" onClick={resetSelectedDayChecklist}>Reset dnia</Button>
                <Button className="flex-1" onClick={() => setIsChecklistOpen(true)}>Edytuj</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900 dark:text-white">Dzienny wynik i dyscyplina</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setIsDayOpen(true)}>Szczegóły</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {heatmapDays.slice(-35).map((day) => {
                  const intensity = day.score;
                  const bg = intensity >= 80
                    ? "bg-emerald-500"
                    : intensity >= 60
                      ? "bg-emerald-300"
                      : intensity >= 40
                        ? "bg-amber-300"
                        : intensity >= 20
                          ? "bg-rose-300"
                          : "bg-slate-200 dark:bg-slate-700";
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day.key);
                        setIsDayOpen(true);
                      }}
                      className={cn("h-8 rounded-sm border border-transparent hover:border-slate-400 transition-colors", bg, selectedDay === day.key && "ring-2 ring-blue-500")}
                      title={`${day.key} | trades: ${day.trades} | net: ${day.dayNet.toFixed(2)} | score: ${day.score}`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Mniej jakości</span>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                  <span className="h-3 w-3 rounded-sm bg-rose-300" />
                  <span className="h-3 w-3 rounded-sm bg-amber-300" />
                  <span className="h-3 w-3 rounded-sm bg-emerald-300" />
                  <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                </div>
                <span>Więcej jakości</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900 dark:text-white">Compliance reguł</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setIsRulesOpen(true)}>Edytuj reguły</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="text-left p-3">Rule</th>
                    <th className="text-left p-3">Threshold</th>
                    <th className="text-left p-3">Pass days</th>
                    <th className="text-left p-3">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesSummary.map((rule) => (
                    <tr key={rule.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">
                        <div className="font-medium text-slate-900 dark:text-white">{rule.name}</div>
                        <div className="text-xs text-slate-500">{rule.kind}</div>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{rule.threshold}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{rule.passDays} / {rule.evalDays}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={cn(rule.status === "ok" && "text-emerald-700 border-emerald-200", rule.status === "warn" && "text-amber-700 border-amber-200", rule.status === "fail" && "text-rose-700 border-rose-200")}>{rule.rate}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
            <CardHeader>
              <CardTitle className="text-base text-slate-900 dark:text-white">Tabela dni (najnowsze)</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="text-left p-3">Day</th>
                    <th className="text-left p-3">Trades</th>
                    <th className="text-left p-3">Net</th>
                    <th className="text-left p-3">Checklist</th>
                    <th className="text-left p-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDaysTable.map((day) => (
                    <tr key={day.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 text-slate-700 dark:text-slate-200">{day.key}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{day.trades}</td>
                      <td className={cn("p-3 font-medium", day.dayNet >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(day.dayNet)}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{day.checklistDone}%</td>
                      <td className="p-3 text-slate-700 dark:text-slate-200">{day.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Reguły dnia</DialogTitle>
              <DialogDescription>Edytuj automatyczne reguły oceny dyscypliny dla wybranego zakresu.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={rule.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                  <div className="col-span-4">
                    <Label>Nazwa</Label>
                    <Input
                      value={rule.name}
                      onChange={(event) => setRules((prev) => prev.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label>Typ</Label>
                    <Select
                      value={rule.kind}
                      onValueChange={(value) => setRules((prev) => prev.map((item, i) => i === index ? { ...item, kind: value } : item))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maxDailyLoss">Max daily loss</SelectItem>
                        <SelectItem value="maxLossTrade">Max loss per trade</SelectItem>
                        <SelectItem value="minWinRate">Min win rate</SelectItem>
                        <SelectItem value="maxConsecutiveLosses">Max consecutive losses</SelectItem>
                        <SelectItem value="minProfitFactor">Min profit factor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Próg</Label>
                    <Input
                      type="number"
                      value={rule.threshold}
                      onChange={(event) => setRules((prev) => prev.map((item, i) => i === index ? { ...item, threshold: Number(event.target.value) } : item))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Aktywna</Label>
                    <Button
                      variant={rule.enabled ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setRules((prev) => prev.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item))}
                    >
                      {rule.enabled ? "TAK" : "NIE"}
                    </Button>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-12 gap-2 items-center rounded-md border border-dashed p-2">
                <div className="col-span-4">
                  <Label>Nowa reguła</Label>
                  <Input
                    value={ruleDraft.name}
                    onChange={(event) => setRuleDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="np. Max daily loss"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Typ</Label>
                  <Select
                    value={ruleDraft.kind}
                    onValueChange={(value) => setRuleDraft((prev) => ({ ...prev, kind: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maxDailyLoss">Max daily loss</SelectItem>
                      <SelectItem value="maxLossTrade">Max loss per trade</SelectItem>
                      <SelectItem value="minWinRate">Min win rate</SelectItem>
                      <SelectItem value="maxConsecutiveLosses">Max consecutive losses</SelectItem>
                      <SelectItem value="minProfitFactor">Min profit factor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Próg</Label>
                  <Input
                    type="number"
                    value={ruleDraft.threshold}
                    onChange={(event) => setRuleDraft((prev) => ({ ...prev, threshold: event.target.value }))}
                  />
                </div>
                <div className="col-span-3 flex items-end">
                  <Button className="w-full gap-2" onClick={addRule}><Plus className="w-4 h-4" />Dodaj regułę</Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setIsRulesOpen(false)}>Zamknij</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Checklist dnia</DialogTitle>
              <DialogDescription>Ustaw punkty checklisty i oznacz wykonane dla wybranego dnia.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {checklistTemplate.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                  <div className="col-span-7">
                    <Input
                      value={item.label}
                      onChange={(event) => setChecklistTemplate((prev) => prev.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Button
                      variant={Boolean((dailyChecks[selectedDay] || {})[item.id]) ? "default" : "outline"}
                      className="w-full"
                      onClick={() => toggleChecklistForSelectedDay(item.id)}
                    >
                      {Boolean((dailyChecks[selectedDay] || {})[item.id]) ? "Zrobione" : "Do zrobienia"}
                    </Button>
                  </div>
                  <div className="col-span-2">
                    <Button
                      variant={item.required ? "secondary" : "outline"}
                      className="w-full"
                      onClick={() => setChecklistTemplate((prev) => prev.map((entry, i) => i === index ? { ...entry, required: !entry.required } : entry))}
                    >
                      {item.required ? "Ważne" : "Opcjonalne"}
                    </Button>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeChecklistItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-12 gap-2 items-center rounded-md border border-dashed p-2">
                <div className="col-span-9">
                  <Input
                    value={checklistDraft}
                    onChange={(event) => setChecklistDraft(event.target.value)}
                    placeholder="Dodaj nowy punkt checklisty"
                  />
                </div>
                <div className="col-span-3">
                  <Button className="w-full gap-2" onClick={addChecklistItem}><Plus className="w-4 h-4" />Dodaj</Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={resetSelectedDayChecklist}>Reset dnia</Button>
                <Button onClick={() => setIsChecklistOpen(false)}>Zamknij</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDayOpen} onOpenChange={setIsDayOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Day details: {selectedDay}</DialogTitle>
              <DialogDescription>Podsumowanie wynikow i transakcji dla wybranego dnia.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-md border p-2"><div className="text-xs text-slate-500">Trades</div><div className="font-semibold">{selectedDayData?.trades || 0}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-slate-500">Net</div><div className={cn("font-semibold", (selectedDayData?.dayNet || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(selectedDayData?.dayNet || 0)}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-slate-500">Checklist</div><div className="font-semibold">{selectedDayData?.checklistDone || 0}%</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-slate-500">Rules</div><div className="font-semibold">{selectedDayData?.rulePass || 0}%</div></div>
              </div>

              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Account</th>
                      <th className="text-left p-3">Symbol</th>
                      <th className="text-left p-3">Direction</th>
                      <th className="text-left p-3">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tradesByDay[selectedDay] || []).map((trade, index) => {
                      const pl = parsePL(trade);
                      return (
                        <tr key={`${trade.id || index}_${index}`} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-3">{toDayKey(parseDateFromTrade(trade)) || "-"}</td>
                          <td className="p-3">{accountNameMap.get(String(trade.account_id || trade.accountId || "")) || "-"}</td>
                          <td className="p-3">{trade.symbol || "-"}</td>
                          <td className="p-3">{trade.direction || "-"}</td>
                          <td className={cn("p-3 font-medium", pl >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(pl)}</td>
                        </tr>
                      );
                    })}
                    {(tradesByDay[selectedDay] || []).length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-500">Brak transakcji tego dnia</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setIsDayOpen(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
