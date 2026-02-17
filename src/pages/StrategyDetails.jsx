import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getStrategies, getTrades } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Target, Award, Star, AlertCircle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { createPageUrl } from "@/utils";

export default function StrategyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedMetric, setSelectedMetric] = useState("pl");

  const { data: strategy } = useQuery({
    queryKey: ['strategy', id],
    enabled: Boolean(user?.id && id),
    queryFn: async () => {
      if (!user?.id || !id) return null;
      const strategies = await getStrategies(user.id);
      return strategies.find(s => s.id === id) || null;
    }
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    enabled: Boolean(user?.id),
    queryFn: () => getTrades(user?.id)
  });

  if (!user?.id || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p>Ładowanie strategii...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p>Strategia nie znaleziona</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pobierz transakcje dla tej strategii
  const strategyTrades = trades.filter(t => t.strategy_id === id);
  const wins = strategyTrades.filter(t => t.outcome === "Win").length;
  const losses = strategyTrades.filter(t => t.outcome === "Loss").length;
  const breakevens = strategyTrades.filter(t => t.outcome === "Breakeven").length;

  // Kalkulacje
  const winRate = strategyTrades.length > 0 ? ((wins / strategyTrades.length) * 100).toFixed(1) : 0;
  const totalPL = strategyTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
  const avgPL = strategyTrades.length > 0 ? (totalPL / strategyTrades.length).toFixed(2) : 0;
  const profitFactor = strategyTrades.length > 0 ? (wins / (losses || 1)).toFixed(2) : 0;

  // Dane do wykresu - P&L po transakcjach
  const cumulativePL = strategyTrades
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .reduce((acc, trade, idx) => {
      const pl = parseFloat(trade.profit_loss) || 0;
      const cumulative = (acc[idx - 1]?.cumulative || 0) + pl;
      acc.push({
        date: trade.date,
        symbol: trade.symbol,
        cumulative: parseFloat(cumulative.toFixed(2)),
        trade_pl: parseFloat(pl.toFixed(2)),
        outcome: trade.outcome
      });
      return acc;
    }, []);

  // Wydajność po miesiącach
  const monthlyStats = strategyTrades.reduce((acc, trade) => {
    const month = new Date(trade.date).toLocaleString('pl-PL', { year: 'numeric', month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, trades: 0, wins: 0, pl: 0 };
    }
    acc[month].trades += 1;
    if (trade.outcome === "Win") acc[month].wins += 1;
    acc[month].pl += parseFloat(trade.profit_loss) || 0;
    return acc;
  }, {});

  const monthlyData = Object.values(monthlyStats).map(m => ({
    ...m,
    pl: parseFloat(m.pl.toFixed(2)),
    winRate: m.trades > 0 ? ((m.wins / m.trades) * 100).toFixed(1) : 0
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-none mx-0 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Strategies'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{strategy.name}</h1>
            <p className="text-slate-600 dark:text-slate-400">{strategy.category}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Statystyki */}
          <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{winRate}%</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Win Rate</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <Award className="w-8 h-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{strategyTrades.length}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Transakcji</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700`}>
            <CardContent className="pt-6">
              <div className="text-center">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: totalPL >= 0 ? '#10b981' : '#ef4444' }} />
                <p className={`text-3xl font-bold ${totalPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPL > 0 ? '+' : ''}{totalPL.toFixed(2)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Łączny P&L</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <Star className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <div className="flex justify-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      fill={i < (strategy.performance_rating || 0) ? '#fbbf24' : '#e5e7eb'}
                      color={i < (strategy.performance_rating || 0) ? '#f59e0b' : '#d1d5db'}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Ocena</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="text-center p-6 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Wygrane</div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{wins}</p>
          </Card>
          <Card className="text-center p-6 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Przegrane</div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{losses}</p>
          </Card>
          <Card className="text-center p-6 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Średni P&L</div>
            <p className={`text-2xl font-bold ${avgPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {parseFloat(avgPL) > 0 ? '+' : ''}{avgPL}
            </p>
          </Card>
        </div>

        {/* Setup i wskaźniki */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategy.setup_description && (
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Setup handlowy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm">{strategy.setup_description}</p>
              </CardContent>
            </Card>
          )}

          {strategy.entry_indicators && (
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Wskaźniki wejścia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm">{strategy.entry_indicators}</p>
              </CardContent>
            </Card>
          )}

          {strategy.exit_indicators && (
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Wskaźniki wyjścia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm">{strategy.exit_indicators}</p>
              </CardContent>
            </Card>
          )}

          {strategy.risk_management && (
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Zarządzanie ryzykiem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategy.risk_management.max_risk_percent && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Max ryzyko na transakcję</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{strategy.risk_management.max_risk_percent}%</p>
                  </div>
                )}
                {strategy.risk_management.position_size_method && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rozmiar pozycji</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{strategy.risk_management.position_size_method}</p>
                  </div>
                )}
                {strategy.risk_management.stop_loss_method && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stop Loss</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{strategy.risk_management.stop_loss_method}</p>
                  </div>
                )}
                {strategy.risk_management.take_profit_method && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Take Profit</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{strategy.risk_management.take_profit_method}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Wykresy wydajności */}
        {strategyTrades.length > 0 && (
          <>
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Kumulacyjny P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={cumulativePL}>
                    <defs>
                      <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value) => value.toFixed(2)}
                    />
                    <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCum)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Wydajność miesięczna</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="pl" fill="#3b82f6" name="P&L" />
                    <Bar dataKey="trades" fill="#8b5cf6" name="Transakcje" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* Komentarz */}
        {strategy.comments && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 shadow-lg">
            <CardHeader>
              <CardTitle className="dark:text-white text-lg">Opinia o strategii</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{strategy.comments}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}