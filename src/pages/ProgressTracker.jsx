// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { getTrades, getTradingAccounts } from '@/lib/localStorage';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, CalendarDays, Wallet } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { format } from "date-fns";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ProgressTracker() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const today = format(new Date(), 'MMM d');

  const progressDays = Array.from({ length: 35 }).map((_, idx) => ({
    id: idx,
    count: idx % 7 === 0 ? 3 : idx % 5 === 0 ? 2 : idx % 3 === 0 ? 1 : 0,
  }));

  const [checklist, setChecklist] = useState([
    { id: 1, label: "Start my day by", value: "09:30", done: false },
    { id: 2, label: "Link trades to playbook", value: "0 / 0", done: false },
    { id: 3, label: "Input Stop loss to all trades", value: "0 / 0", done: false },
    { id: 4, label: "Net max loss / trade", value: "$0 / $100", done: false },
    { id: 5, label: "Net max loss / day", value: "$0 / $100", done: false },
  ]);

  const [rules, setRules] = useState([
    { id: 1, label: "Start my day by 09:30", status: "fail", condition: "09:30", streak: 0, avg: "12:58", follow: "0%" },
    { id: 2, label: "Link trades to playbook", status: "fail", condition: "100%", streak: 0, avg: "0%", follow: "0%" },
    { id: 3, label: "Input Stop loss to all trades", status: "ok", condition: "100%", streak: 7, avg: "11%", follow: "91%" },
    { id: 4, label: "Net max loss / trade", status: "warn", condition: "$100", streak: 2, avg: "$8.56", follow: "54%" },
    { id: 5, label: "Net max loss / day", status: "warn", condition: "$100", streak: 2, avg: "$11.2", follow: "60%" },
  ]);

  const [isEditRulesOpen, setIsEditRulesOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return undefined;
    const refDoc = doc(db, "users", String(user.id), "progress", "tracker");
    const unsubscribe = onSnapshot(refDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.rules)) setRules(data.rules);
        if (Array.isArray(data.checklist)) setChecklist(data.checklist);
      }
      hydratedRef.current = true;
    });
    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !hydratedRef.current) return;
    const refDoc = doc(db, "users", String(user.id), "progress", "tracker");
    setDoc(refDoc, {
      rules,
      checklist,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, [rules, checklist, user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] p-6">
      <div className="max-w-screen-2xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Progress Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <CalendarDays className="w-4 h-4" />
              Date range
            </Button>
            <Select value="all">
              <SelectTrigger className="w-40">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <SelectValue placeholder="My Account" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card className="bg-white shadow-xl border border-slate-200/60">
              <CardContent className="p-5">
                <p className="text-xs text-slate-500">Current streak</p>
                <div className="mt-2 text-2xl font-bold">7 days</div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-xl border border-slate-200/60">
              <CardContent className="p-5">
                <p className="text-xs text-slate-500">Current period score</p>
                <div className="mt-3 h-24 flex items-center justify-center">
                  <div className="w-28 h-14 rounded-b-full border-4 border-rose-400 border-t-0" />
                  <div className="absolute text-xl font-bold">5%</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-xl border border-slate-200/60">
              <CardContent className="p-5">
                <p className="text-xs text-slate-500">Today’s progress</p>
                <div className="mt-2 text-2xl font-bold">0/5</div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-0 rounded-full bg-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white shadow-xl border border-slate-200/60">
            <CardHeader>
              <CardTitle className="text-slate-900">Daily checklist, {today}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500 font-semibold">AUTOMATED RULES (5)</p>
              <div className="space-y-3">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))}
                    className="w-full flex items-center justify-between text-sm"
                  >
                    <div className={`flex items-center gap-2 ${item.done ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.done ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-500">{item.done ? item.value : item.value}</div>
                  </button>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={() => setIsChecklistOpen(true)}>
                View this day
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-xl border border-slate-200/60">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-slate-900">Progress tracker</CardTitle>
              <Button variant="outline" size="sm">Today</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {progressDays.map(day => (
                  <div
                    key={day.id}
                    className={`progress-square ${day.count === 0 ? 'progress-0' : day.count === 1 ? 'progress-1' : day.count === 2 ? 'progress-2' : 'progress-3'}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-3">
                <span>Less</span>
                <div className="flex items-center gap-1">
                  <span className="progress-0 progress-legend" />
                  <span className="progress-1 progress-legend" />
                  <span className="progress-2 progress-legend" />
                  <span className="progress-3 progress-legend" />
                </div>
                <span>More</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-xl border border-slate-200/60">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-slate-900">Current rules</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsEditRulesOpen(true)}>Edit rules</Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">Rule</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">Condition</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">Rule streak</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">Average performance</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">Follow rate</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b border-slate-100">
                    <td className="p-3 text-sm text-slate-700 flex items-center gap-2">
                      {rule.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {rule.status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {rule.status === "fail" && <XCircle className="w-4 h-4 text-rose-600" />}
                      {rule.label}
                    </td>
                    <td className="p-3 text-sm text-slate-700">{rule.condition}</td>
                    <td className="p-3 text-sm text-slate-700">{rule.streak}</td>
                    <td className="p-3 text-sm text-slate-700">{rule.avg}</td>
                    <td className="p-3 text-sm text-rose-600">{rule.follow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Dialog open={isEditRulesOpen} onOpenChange={setIsEditRulesOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit rules</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {rules.map((rule, idx) => (
                <div key={rule.id} className="grid grid-cols-5 gap-3 items-end">
                  <div className="col-span-2">
                    <Label>Rule</Label>
                    <Input
                      value={rule.label}
                      onChange={(e) => setRules(prev => prev.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
                    />
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <Input
                      value={rule.condition}
                      onChange={(e) => setRules(prev => prev.map((r, i) => i === idx ? { ...r, condition: e.target.value } : r))}
                    />
                  </div>
                  <div>
                    <Label>Avg perf.</Label>
                    <Input
                      value={rule.avg}
                      onChange={(e) => setRules(prev => prev.map((r, i) => i === idx ? { ...r, avg: e.target.value } : r))}
                    />
                  </div>
                  <div>
                    <Label>Follow</Label>
                    <Input
                      value={rule.follow}
                      onChange={(e) => setRules(prev => prev.map((r, i) => i === idx ? { ...r, follow: e.target.value } : r))}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditRulesOpen(false)}>Cancel</Button>
                <Button onClick={() => setIsEditRulesOpen(false)}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Daily checklist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-6 gap-2 items-center">
                  <Button
                    variant="outline"
                    className={item.done ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-600"}
                    onClick={() => setChecklist(prev => prev.map((i, j) => j === idx ? { ...i, done: !i.done } : i))}
                  >
                    {item.done ? "Done" : "Todo"}
                  </Button>
                  <Input
                    className="col-span-3"
                    value={item.label}
                    onChange={(e) => setChecklist(prev => prev.map((i, j) => j === idx ? { ...i, label: e.target.value } : i))}
                  />
                  <Input
                    className="col-span-2"
                    value={item.value}
                    onChange={(e) => setChecklist(prev => prev.map((i, j) => j === idx ? { ...i, value: e.target.value } : i))}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsChecklistOpen(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
