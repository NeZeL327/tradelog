import React, { useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar as CalendarIcon, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import { useLanguage } from "@/components/LanguageProvider";
import { directionBadgeClass, directionLabel } from "@/lib/utils";
import TradeCard from "../components/TradeCard";

export default function Calendar() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const locale = language === 'pl' ? pl : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => getStrategies(user?.id),
  });

  // Get calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group trades by date
  const tradesByDate = {};
  trades.forEach(trade => {
    if (!tradesByDate[trade.date]) {
      tradesByDate[trade.date] = [];
    }
    tradesByDate[trade.date].push(trade);
  });

  // Get trades for selected date
  const selectedTrades = selectedDate 
    ? trades.filter(t => isSameDay(new Date(t.date), selectedDate))
    : [];

  // Calculate stats for a day
  const getDayStats = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTrades = tradesByDate[dateStr] || [];
    const wins = dayTrades.filter(t => t.outcome === "Win").length;
    const losses = dayTrades.filter(t => t.outcome === "Loss").length;
    const totalPL = dayTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
    
    return { trades: dayTrades.length, wins, losses, totalPL };
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const weekDays = language === 'pl' 
    ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']
    : [t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday'), t('sunday')];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('tradingCalendar')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('browseTradesInCalendar')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {format(currentDate, 'LLLL yyyy', { locale })}
                  </h2>
                </div>

                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <Button onClick={handleToday} variant="outline" className="w-full mt-4">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {t('today')}
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-7 gap-2">
                {/* Week day headers */}
                {weekDays.map(day => (
                  <div key={day} className="calendar-weekday text-center text-sm font-semibold text-slate-600 dark:text-slate-400 py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((day, index) => {
                  const stats = getDayStats(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDay = isToday(day);
                  const hasTrades = stats.trades > 0;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        calendar-day relative p-3 rounded-lg transition-all duration-200 min-h-[80px]
                        ${!isCurrentMonth ? 'opacity-30 calendar-day-outside' : ''}
                        ${isSelected ? 'ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-950 calendar-day-selected' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                        ${isTodayDay && !isSelected ? 'ring-2 ring-purple-400 calendar-day-today' : ''}
                        ${hasTrades ? 'cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {format(day, 'd')}
                      </div>

                      {hasTrades && (
                        <div className="mt-1 space-y-1">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {stats.trades} {stats.trades === 1 ? t('transaction') : t('transactions')}
                          </div>
                          <div className={`text-xs font-bold ${stats.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.totalPL >= 0 ? '+' : ''}{stats.totalPL.toFixed(0)}
                          </div>
                          <div className="flex gap-1 justify-center">
                            {stats.wins > 0 && (
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            )}
                            {stats.losses > 0 && (
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="dark:text-white">
                {selectedDate 
                  ? format(selectedDate, 'd MMMM yyyy', { locale })
                  : t('selectDay')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selectedDate && selectedTrades.length > 0 ? (
                <div className="space-y-4">
                  {/* Day Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{t('trades')}</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{selectedTrades.length}</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${
                      selectedTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) >= 0 
                        ? 'bg-green-50 dark:bg-green-950' 
                        : 'bg-red-50 dark:bg-red-950'
                    }`}>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">P&L</p>
                      <p className={`text-xl font-bold ${
                        selectedTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Trade List */}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {selectedTrades.map(trade => {
                      const account = accounts.find(a => a.id === trade.account_id);
                      const strategy = strategies.find(s => s.id === trade.strategy_id);
                      
                      return (
                        <div key={trade.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{trade.symbol}</h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{trade.open_time || trade.time || '--:--'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={directionBadgeClass(trade.direction)}>
                                {directionLabel(trade.direction, t)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingTrade(trade)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {account && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                              <span className="font-medium">{t('account')}:</span> {account.name}
                            </p>
                          )}

                          {strategy && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                              <span className="font-medium">{t('strategy')}:</span> {strategy.name}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{t('entry')}</p>
                              <p className="font-semibold text-sm dark:text-slate-100">{trade.entry_price}</p>
                            </div>
                            {trade.exit_price && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('exit')}</p>
                                <p className="font-semibold text-sm dark:text-slate-100">{trade.exit_price}</p>
                              </div>
                            )}
                          </div>

                          {trade.profit_loss != null && (
                            <div className={`mt-3 p-2 rounded-lg text-center ${
                              trade.outcome === "Win" ? 'bg-green-100' : 
                              trade.outcome === "Loss" ? 'bg-red-100' : 
                              'bg-slate-100'
                            }`}>
                              <div className="flex items-center justify-center gap-2">
                                {trade.outcome === "Win" ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : trade.outcome === "Loss" ? (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                ) : null}
                                <span className={`font-bold ${
                                  trade.outcome === "Win" ? 'text-green-600' : 
                                  trade.outcome === "Loss" ? 'text-red-600' : 
                                  'text-slate-600'
                                }`}>
                                  {parseFloat(trade.profit_loss) > 0 ? '+' : ''}{parseFloat(trade.profit_loss).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {trade.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                              {trade.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedDate ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">{t('noTradesThisDay')}</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">{t('clickDayToSee')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Month Summary */}
        <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="dark:text-white">{t('monthSummary')} - {format(currentDate, 'LLLL yyyy', { locale })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const monthTrades = trades.filter(t => {
                  const tradeDate = new Date(t.date);
                  return isSameMonth(tradeDate, currentDate);
                });
                const wins = monthTrades.filter(t => t.outcome === "Win").length;
                const losses = monthTrades.filter(t => t.outcome === "Loss").length;
                const totalPL = monthTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
                const winRate = monthTrades.length > 0 ? ((wins / monthTrades.length) * 100).toFixed(1) : 0;

                return (
                  <>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('trades')}</p>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">{monthTrades.length}</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('winRate')}</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{winRate}%</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('wins')}</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">{wins}</p>
                    </div>
                    <div className={`p-4 rounded-xl text-center ${totalPL >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('totalPL')}</p>
                      <p className={`text-3xl font-bold ${totalPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Executed Trades List */}
        <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="dark:text-white">{t('completedTrades')} - {format(currentDate, 'LLLL yyyy', { locale })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{language === 'pl' ? 'Data' : 'Date'}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('symbol')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('account')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('strategy')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('direction')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('entry')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('exit')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('profitLoss')}</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('outcome')}</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const isClosedStatus = (status) => [
                      "Closed",
                      "closed",
                      "Wykonana",
                      "Zamknięta",
                      "Zamknieta",
                      "Zamknięte",
                      "Executed"
                    ].includes(status);

                    const monthExecutedTrades = trades
                      .filter(t => {
                        const tradeDate = new Date(t.date);
                        return isSameMonth(tradeDate, currentDate) && isClosedStatus(t.status);
                      })
                      .sort((a, b) => new Date(b.date) - new Date(a.date));

                    return monthExecutedTrades.map((trade) => {
                      const account = accounts.find(a => a.id === trade.account_id);
                      const strategy = strategies.find(s => s.id === trade.strategy_id);
                      
                      return (
                        <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <td className="p-4 text-sm text-slate-900 dark:text-slate-100">
                            {trade.date}
                            {trade.open_time && <div className="text-xs text-slate-500 dark:text-slate-400">{t('open')}: {trade.open_time}</div>}
                            {trade.close_time && <div className="text-xs text-slate-500 dark:text-slate-400">{t('close')}: {trade.close_time}</div>}
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{trade.symbol}</div>
                            {trade.timeframe && <div className="text-xs text-slate-500 dark:text-slate-400">{trade.timeframe}</div>}
                          </td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{account?.name || '-'}</td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{strategy?.name || '-'}</td>
                          <td className="p-4">
                            <Badge className={directionBadgeClass(trade.direction)}>
                              {directionLabel(trade.direction, t)}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-slate-900 dark:text-slate-100">{trade.entry_price}</td>
                          <td className="p-4 text-sm text-slate-900 dark:text-slate-100">{trade.exit_price || '-'}</td>
                          <td className="p-4">
                            {trade.profit_loss != null ? (
                              <div className="flex items-center gap-1">
                                {parseFloat(trade.profit_loss) > 0 ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : parseFloat(trade.profit_loss) < 0 ? (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                ) : null}
                                <span className={`font-semibold ${
                                  parseFloat(trade.profit_loss) > 0 ? 'text-green-600' : 
                                  parseFloat(trade.profit_loss) < 0 ? 'text-red-600' : 
                                  'text-slate-600'
                                }`}>
                                  {parseFloat(trade.profit_loss) > 0 ? '+' : ''}{parseFloat(trade.profit_loss).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            {trade.outcome && (
                              <Badge variant="outline" className={
                                trade.outcome === "Win" ? "border-green-600 text-green-600" :
                                trade.outcome === "Loss" ? "border-red-600 text-red-600" :
                                "border-slate-600 text-slate-600"
                              }>
                                {trade.outcome}
                              </Badge>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingTrade(trade)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {(() => {
                const isClosedStatus = (status) => [
                  "Closed",
                  "closed",
                  "Wykonana",
                  "Zamknięta",
                  "Zamknieta",
                  "Zamknięte",
                  "Executed"
                ].includes(status);

                const monthExecutedTrades = trades.filter(t => {
                  const tradeDate = new Date(t.date);
                  return isSameMonth(tradeDate, currentDate) && isClosedStatus(t.status);
                });
                
                return monthExecutedTrades.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500 dark:text-slate-400">{t('noCompletedTrades')}</p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Details Dialog */}
      <Dialog open={viewingTrade !== null} onOpenChange={() => setViewingTrade(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tradeDetails')}</DialogTitle>
          </DialogHeader>
          {viewingTrade && (
            <TradeCard trade={viewingTrade} onEdit={() => setViewingTrade(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}