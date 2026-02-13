import React, { useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getStrategies, createStrategy, updateStrategy, getTrades } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Brain, TrendingUp, Target, Award, X, Eye, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";

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

  // Strategy comparison data
  const strategyStats = strategies.map(strategy => {
    const strategyTrades = trades.filter(t => t.strategy_id === strategy.id);
    const wins = strategyTrades.filter(t => t.outcome === "Win").length;
    const totalPL = strategyTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
    const avgPL = strategyTrades.length > 0 ? totalPL / strategyTrades.length : 0;
    const winRate = strategyTrades.length > 0 ? (wins / strategyTrades.length) * 100 : 0;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('tradingStrategies')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('manageAnalyzeStrategies')}</p>
          </div>
          <Button
            onClick={() => {
              setEditingStrategy(null);
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('addStrategy')}
          </Button>
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
        {strategyStats.length > 0 && strategyStats.some(s => s.trades > 0) && (
          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <TrendingUp className="w-5 h-5" />
                {t('strategiesComparison')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={strategyStats.filter(s => s.trades > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                  <Bar dataKey="avgPL" fill="#10b981" name="Średni P&L" />
                  <Bar dataKey="trades" fill="#8b5cf6" name="Liczba transakcji" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Strategy Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategies.map((strategy) => {
            const stats = strategyStats.find(s => s.id === strategy.id);
            return (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                stats={stats}
                onEdit={() => {
                  setEditingStrategy(strategy);
                  setShowForm(true);
                }}
              />
            );
          })}
        </div>

        {strategies.length === 0 && !showForm && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
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
    color: "#3b82f6",
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
      <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
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
                  <Badge key={idx} className="bg-blue-100 text-blue-700">
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
                  <Badge key={idx} className="bg-purple-100 text-purple-700">
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
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Zarządzanie ryzykiem</h3>
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
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Ocena i komentarze</h3>
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
                          color={rating <= (formData.performance_rating || 0) ? '#f59e0b' : '#d1d5db'}
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
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                {strategy ? "Zapisz" : "Dodaj strategię"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StrategyCard({ strategy, stats, onEdit }) {
  const statusColors = {
    Aktywna: "bg-green-100 text-green-700",
    Testowa: "bg-amber-100 text-amber-700",
    Archiwalna: "bg-slate-100 text-slate-700"
  };

  return (
    <Card className="bg-white dark:bg-slate-800 shadow-xl border-l-4" style={{ borderLeftColor: strategy.color || "#3b82f6" }}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-xl dark:text-white">{strategy.name}</CardTitle>
              <Badge className={statusColors[strategy.status]}>{strategy.status}</Badge>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">{strategy.category}</p>
              {strategy.performance_rating > 0 && (
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3"
                      fill={i < strategy.performance_rating ? '#fbbf24' : 'none'}
                      color={i < strategy.performance_rating ? '#f59e0b' : '#d1d5db'}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.href = `${createPageUrl('StrategyDetails')}?id=${strategy.id}`}
              title="Szczegóły strategii"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && stats.trades > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Target className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.winRate}%</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Win Rate</p>
            </div>
            
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <TrendingUp className="w-5 h-5 mx-auto text-green-600 dark:text-green-400 mb-1" />
              <p className={`text-lg font-bold ${parseFloat(stats.avgPL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {parseFloat(stats.avgPL) > 0 ? '+' : ''}{stats.avgPL}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Średni P&L</p>
            </div>

            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <Award className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.trades}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Transakcje</p>
            </div>
          </div>
        )}

        {stats && stats.trades > 0 && (
          <div className={`p-4 rounded-xl ${parseFloat(stats.totalPL) >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Łączny P&L:</span>
              <span className={`text-2xl font-bold ${parseFloat(stats.totalPL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {parseFloat(stats.totalPL) > 0 ? '+' : ''}{stats.totalPL}
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        {strategy.description && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Opis</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{strategy.description}</p>
          </div>
        )}

        {/* Rules */}
        {strategy.rules && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Zasady</p>
            <p className="text-sm text-blue-900 dark:text-blue-300 whitespace-pre-wrap">{strategy.rules}</p>
          </div>
        )}

        {/* Timeframes & Instruments */}
        <div className="space-y-2">
          {strategy.timeframes && strategy.timeframes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Timeframe'y</p>
              <div className="flex flex-wrap gap-2">
                {strategy.timeframes.map((tf, idx) => (
                  <Badge key={idx} variant="outline">{tf}</Badge>
                ))}
              </div>
            </div>
          )}

          {strategy.instruments && strategy.instruments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Instrumenty</p>
              <div className="flex flex-wrap gap-2">
                {strategy.instruments.map((inst, idx) => (
                  <Badge key={idx} className="bg-purple-100 text-purple-700">{inst}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Target R:R */}
        {strategy.target_rr && (
          <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <span className="text-sm font-medium text-amber-900 dark:text-amber-300">Docelowy R:R:</span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-400">1:{strategy.target_rr}</span>
          </div>
        )}

        {strategy.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notatki</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{strategy.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}