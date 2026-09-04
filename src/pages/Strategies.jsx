import { useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getStrategies, createStrategy, updateStrategy, deleteStrategy, getTrades, getTradingAccounts } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Brain, TrendingUp, Target, Award, X, Eye, Star, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { cn, getTradeRealizedPL, isClosedTrade } from "@/lib/utils";
import { CHART, chartTooltipStyle, chartGridProps } from "@/lib/chartTheme";
import QuoteLine from "@/components/QuoteLine";

export default function Strategies() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const queryClient = useQueryClient();

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => getStrategies(user?.id),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const activeAccountIds = new Set(
    accounts
      .filter((account) => account.is_active !== false && account.status !== 'Inactive')
      .map((account) => String(account.id))
  );

  const createMutation = useMutation({
    mutationFn: (data) => createStrategy(user?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      setShowForm(false);
      setEditingStrategy(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStrategy(user?.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      setShowForm(false);
      setEditingStrategy(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStrategy(user?.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });

  const handleDeleteStrategy = (strategy) => {
    if (window.confirm(t('confirmDeleteStrategy').replace('{name}', strategy.name))) {
      deleteMutation.mutate(strategy.id);
    }
  };

  // Strategy comparison data
  const strategyStats = strategies.map(strategy => {
    const strategyTrades = trades.filter(
      (t) => t.strategy_id === strategy.id && isClosedTrade(t) && (!t.account_id || activeAccountIds.has(String(t.account_id)))
    );
    const wins = strategyTrades.filter(t => t.outcome === "Win").length;
    const losses = strategyTrades.filter(t => t.outcome === "Loss").length;
    const decided = wins + losses;
    const totalPL = strategyTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
    const avgPL = strategyTrades.length > 0 ? totalPL / strategyTrades.length : 0;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;

    return {
      ...strategy,
      trades: strategyTrades.length,
      wins,
      winRate: winRate.toFixed(1),
      totalPL: totalPL.toFixed(2),
      avgPL: avgPL.toFixed(2)
    };
  });

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="cyber-page-title">{t('tradingStrategies')}</h1>
            <p className="cyber-page-sub">{t('manageAnalyzeStrategies')}</p>
          </div>
          <div className="flex gap-3 items-center">
            <QuoteLine className="hidden lg:flex shrink-0" />
            <Button
              onClick={() => {
                setEditingStrategy(null);
                setShowForm(!showForm);
              }}
              className="cyber-primary-btn w-full sm:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('addStrategy')}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <StrategyForm
              strategy={editingStrategy}
              onSubmit={(data) => {
                if (editingStrategy) {
                  updateMutation.mutate({ id: editingStrategy.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingStrategy(null);
              }}
            />
          )}
        </AnimatePresence>

        {/* Strategy Comparison Chart */}
        {strategyStats.length > 0 && strategyStats.some(s => s.trades > 0) && (() => {
          const chartData = strategyStats.filter(s => s.trades > 0);
          const allValues = chartData.flatMap(s => [s.winRate, s.avgPL, s.trades]);
          const rawMin = Math.min(0, ...allValues);
          const rawMax = Math.max(0, ...allValues);
          const pad = (rawMax - rawMin) * 0.15 + 1;
          const yMin = Math.floor(rawMin - pad);
          const yMax = Math.ceil(rawMax + pad);
          return (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  {t('strategiesComparison')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis domain={[yMin, yMax]} stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Bar dataKey="winRate" fill={CHART.line} name="Win Rate (%)" />
                    <Bar dataKey="avgPL" fill={CHART.profit} name="Średni P&L" />
                    <Bar dataKey="trades" fill={CHART.accent} name="Liczba transakcji" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })()}

        {/* Strategy Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategies.map((strategy, index) => {
            const stats = strategyStats.find(s => s.id === strategy.id);
            return (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.05 }}
              >
                <StrategyCard
                  strategy={strategy}
                  stats={stats}
                  onEdit={() => {
                    setEditingStrategy(strategy);
                    setShowForm(true);
                  }}
                  onDelete={() => handleDeleteStrategy(strategy)}
                />
              </motion.div>
            );
          })}
        </div>

        {strategies.length === 0 && !showForm && (
          <Card className="shadow-md">
            <CardContent className="text-center py-12">
              <Brain className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">{t('noStrategiesYet')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StrategyForm({ strategy, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(strategy || {
    name: "",
    description: "",
    rules: "",
    target_rr: "",
    timeframes: [],
    instruments: [],
    category: "Trend Following",
    status: "Aktywna",
    notes: "",
    color: "#64748b",
    setup_description: "",
    entry_indicators: "",
    exit_indicators: "",
    risk_management: {
      max_risk_percent: "",
      position_size_method: "",
      stop_loss_method: "",
      take_profit_method: ""
    },
    performance_rating: 0,
    comments: ""
  });

  const [timeframeInput, setTimeframeInput] = useState("");
  const [instrumentInput, setInstrumentInput] = useState("");

  const addTimeframe = () => {
    if (timeframeInput && !formData.timeframes.includes(timeframeInput)) {
      setFormData({ ...formData, timeframes: [...formData.timeframes, timeframeInput] });
      setTimeframeInput("");
    }
  };

  const addInstrument = () => {
    if (instrumentInput && !formData.instruments.includes(instrumentInput)) {
      setFormData({ ...formData, instruments: [...formData.instruments, instrumentInput.toUpperCase()] });
      setInstrumentInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="dark:text-white">{strategy ? "Edytuj strategię" : "Nowa strategia"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nazwa strategii *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="np. Breakout H4"
                />
              </div>

              <div>
                <Label>Kategoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Trend Following">Trend Following</SelectItem>
                    <SelectItem value="Mean Reversion">Mean Reversion</SelectItem>
                    <SelectItem value="Breakout">Breakout</SelectItem>
                    <SelectItem value="Scalping">Scalping</SelectItem>
                    <SelectItem value="Swing">Swing</SelectItem>
                    <SelectItem value="Day Trading">Day Trading</SelectItem>
                    <SelectItem value="Position Trading">Position Trading</SelectItem>
                    <SelectItem value="News Trading">News Trading</SelectItem>
                    <SelectItem value="Arbitrage">Arbitrage</SelectItem>
                    <SelectItem value="Inne">Inne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Docelowy R:R</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.target_rr}
                  onChange={(e) => setFormData({ ...formData, target_rr: e.target.value })}
                  placeholder="np. 2.5"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktywna">Aktywna</SelectItem>
                    <SelectItem value="Testowa">Testowa</SelectItem>
                    <SelectItem value="Archiwalna">Archiwalna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kolor</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Opis strategii</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opisz główną ideę strategii..."
                rows={3}
              />
            </div>

            <div>
              <Label>Zasady wejścia i wyjścia</Label>
              <Textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="Szczegółowe zasady kiedy wchodzić i wychodzić z pozycji..."
                rows={4}
              />
            </div>

            <div>
              <Label>Timeframe'y</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={timeframeInput}
                  onChange={(e) => setTimeframeInput(e.target.value)}
                  placeholder="np. H4"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTimeframe())}
                />
                <Button type="button" onClick={addTimeframe} variant="outline">Dodaj</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.timeframes.map((tf, idx) => (
                  <Badge key={idx} className="bg-muted text-foreground">
                    {tf}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, timeframes: formData.timeframes.filter((_, i) => i !== idx) })}
                      className="ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Instrumenty/Pary</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={instrumentInput}
                  onChange={(e) => setInstrumentInput(e.target.value)}
                  placeholder="np. EURUSD"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInstrument())}
                />
                <Button type="button" onClick={addInstrument} variant="outline">Dodaj</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.instruments.map((inst, idx) => (
                  <Badge key={idx} className="bg-muted text-foreground">
                    {inst}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, instruments: formData.instruments.filter((_, i) => i !== idx) })}
                      className="ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Setup handlowy</Label>
              <Textarea
                value={formData.setup_description}
                onChange={(e) => setFormData({ ...formData, setup_description: e.target.value })}
                placeholder="Szczegółowy opis setupu handlowego..."
                rows={3}
              />
            </div>

            <div>
              <Label>Wskaźniki wejścia</Label>
              <Textarea
                value={formData.entry_indicators}
                onChange={(e) => setFormData({ ...formData, entry_indicators: e.target.value })}
                placeholder="Jakie wskaźniki sygnalizują wejście..."
                rows={3}
              />
            </div>

            <div>
              <Label>Wskaźniki wyjścia</Label>
              <Textarea
                value={formData.exit_indicators}
                onChange={(e) => setFormData({ ...formData, exit_indicators: e.target.value })}
                placeholder="Jakie wskaźniki sygnalizują wyjście..."
                rows={3}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold text-foreground mb-4">Zarządzanie ryzykiem</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Max ryzyko na transakcję (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.risk_management.max_risk_percent}
                    onChange={(e) => setFormData({
                      ...formData,
                      risk_management: { ...formData.risk_management, max_risk_percent: e.target.value }
                    })}
                    placeholder="np. 2.0"
                  />
                </div>

                <div>
                  <Label>Metoda rozmiaru pozycji</Label>
                  <Input
                    value={formData.risk_management.position_size_method}
                    onChange={(e) => setFormData({
                      ...formData,
                      risk_management: { ...formData.risk_management, position_size_method: e.target.value }
                    })}
                    placeholder="np. Fixed 0.1 lot"
                  />
                </div>

                <div>
                  <Label>Metoda Stop Loss</Label>
                  <Input
                    value={formData.risk_management.stop_loss_method}
                    onChange={(e) => setFormData({
                      ...formData,
                      risk_management: { ...formData.risk_management, stop_loss_method: e.target.value }
                    })}
                    placeholder="np. Poprzedni high/low"
                  />
                </div>

                <div>
                  <Label>Metoda Take Profit</Label>
                  <Input
                    value={formData.risk_management.take_profit_method}
                    onChange={(e) => setFormData({
                      ...formData,
                      risk_management: { ...formData.risk_management, take_profit_method: e.target.value }
                    })}
                    placeholder="np. 1:2 risk reward"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold text-foreground mb-4">Ocena i komentarze</h3>
              <div className="space-y-4">
                <div>
                  <Label>Ocena strategii (0-5 gwiazdek)</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({ ...formData, performance_rating: rating })}
                        className="focus:outline-none"
                      >
                        <Star
                          className="w-6 h-6"
                          fill={rating <= (formData.performance_rating || 0) ? '#fbbf24' : 'none'}
                          color={rating <= (formData.performance_rating || 0) ? 'hsl(var(--warning))' : '#d1d5db'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Opinia o strategii</Label>
                  <Textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Twoja opinia na temat działania tej strategii..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Dodatkowe notatki</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Dodatkowe uwagi, ulepszenia, itp..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Anuluj
              </Button>
              <Button type="submit" className="cyber-primary-btn">
                {strategy ? "Zapisz" : "Dodaj strategię"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StrategyCard({ strategy, stats, onEdit, onDelete }) {
  const accent = strategy.color || "#64748b";
  const statusStyles = {
    Aktywna: "bg-profit/12 text-profit dark:text-profit border-profit/25",
    Testowa: "bg-amber-500/12 text-amber-900 dark:text-amber-200 border-amber-500/25",
    Archiwalna: "bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/25",
  };

  return (
    <Card
      className={cn(
        "relative h-full overflow-hidden rounded-xl border border-border",
        "bg-card",
        "transition-colors duration-200 hover:border-primary/35",
      )}
    >
      {/* Top accent bar + soft glow */}
      <div
        className="absolute inset-x-0 top-0 z-[1] h-[4px]"
        style={{
          background: `linear-gradient(90deg, ${accent}, ${accent}cc, transparent)`,
        }}
      />
      <div
        className="pointer-events-none absolute -top-8 left-1/2 h-24 w-[70%] -translate-x-1/2 rounded-full opacity-[0.12] blur-2xl"
        style={{ backgroundColor: accent }}
      />

      <CardHeader className="relative z-[2] border-b border-border/60 bg-muted/25 pb-4 pt-5">
        <div className="flex justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                {strategy.name}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn("shrink-0 border font-medium", statusStyles[strategy.status] || statusStyles.Archiwalna)}
              >
                {strategy.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {strategy.category}
              </span>
              {strategy.performance_rating > 0 && (
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5"
                      fill={i < strategy.performance_rating ? "#fbbf24" : "none"}
                      color={i < strategy.performance_rating ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => { window.location.href = `${createPageUrl("StrategyDetails")}?id=${strategy.id}`; }}
              title="Szczegóły strategii"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={onEdit}
              title="Edytuj strategię"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-loss/10 hover:text-loss dark:hover:text-loss"
              onClick={onDelete}
              title="Usuń strategię"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-[2] space-y-4 pt-5">
        {stats && stats.trades > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-md border border-border bg-card p-3 text-center">
              <Target className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
              <p className="text-lg font-bold tabular-nums text-foreground">{stats.winRate}%</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Win Rate</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3 text-center">
              <TrendingUp className="mx-auto mb-1 h-5 w-5 text-profit dark:text-profit" />
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  parseFloat(stats.avgPL) >= 0
                    ? "text-profit dark:text-profit"
                    : "text-loss dark:text-loss"
                )}
              >
                {parseFloat(stats.avgPL) > 0 ? "+" : ""}
                {stats.avgPL}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Średni P&amp;L</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3 text-center">
              <Award className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
              <p className="text-lg font-bold tabular-nums text-foreground">{stats.trades}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Transakcje</p>
            </div>
          </div>
        )}

        {stats && stats.trades > 0 && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3 shadow-inner",
              parseFloat(stats.totalPL) >= 0
                ? "border-profit/80 bg-gradient-to-r from-profit/10 to-profit/5 dark:border-profit/25 dark:from-profit/10 dark:to-profit/5"
                : "border-loss/80 bg-gradient-to-r from-loss/10 to-loss/5 dark:border-loss/25 dark:from-loss/10 dark:to-loss/5"
            )}
          >
            <span className="text-sm font-semibold text-foreground/90">Łączny P&amp;L</span>
            <span
              className={cn(
                "text-2xl font-bold tabular-nums tracking-tight",
                parseFloat(stats.totalPL) >= 0
                  ? "text-profit dark:text-profit"
                  : "text-loss dark:text-loss"
              )}
            >
              {parseFloat(stats.totalPL) > 0 ? "+" : ""}
              {stats.totalPL}
            </span>
          </div>
        )}

        {strategy.description && (
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opis</p>
            <p className="text-sm leading-relaxed text-foreground/85">{strategy.description}</p>
          </div>
        )}

        {strategy.rules && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 dark:bg-primary/10">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Zasady</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{strategy.rules}</p>
          </div>
        )}

        <div className="space-y-3">
          {strategy.timeframes && strategy.timeframes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeframe&apos;y</p>
              <div className="flex flex-wrap gap-1.5">
                {strategy.timeframes.map((tf, idx) => (
                  <Badge key={idx} variant="secondary" className="rounded-md font-normal">
                    {tf}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {strategy.instruments && strategy.instruments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instrumenty</p>
              <div className="flex flex-wrap gap-1.5">
                {strategy.instruments.map((inst, idx) => (
                  <Badge key={idx} className="rounded-md border-0 bg-muted font-normal text-foreground">
                    {inst}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {strategy.target_rr && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-amber-50/30 px-4 py-3 dark:border-amber-500/20 dark:from-amber-950/35 dark:to-amber-950/10">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Docelowy R:R</span>
            <span className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">1:{strategy.target_rr}</span>
          </div>
        )}

        {strategy.notes && (
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notatki</p>
            <p className="text-sm leading-relaxed text-foreground/85">{strategy.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}