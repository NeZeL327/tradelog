import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Edit, Calendar, Clock, Target } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { directionBadgeClass, directionLabel, getTradeRealizedPL, tradeOutcomeBadgeClass, tradeStatusBadgeClass, tradeStatusDisplay, tradeOutcomeDisplay } from "@/lib/utils";
import ImageViewer from "@/components/common/ImageViewer";
import { formatTradeDate, formatTradeClock, getDateFormat } from "@/lib/userSettings";

export default function TradeCard({ trade, onEdit = null }) {
  const { t } = useLanguage();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const dateFormat = getDateFormat();
  const isWin = trade.outcome === "Win";
  const isLoss = trade.outcome === "Loss";
  const plColor = isWin ? "text-emerald-600 dark:text-emerald-300" : isLoss ? "text-rose-600 dark:text-rose-300" : "text-amber-600 dark:text-amber-300";
  const bgColor = isWin ? "bg-emerald-50 border-emerald-200" : isLoss ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200";
  const directionText = directionLabel(trade.direction, t);
  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const normalized = typeof value === "string" ? value.replace(",", ".") : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const entryPrice = toNumber(trade.entry_price);
  const directionSign = String(trade.direction || "Long").toLowerCase() === "short" ? -1 : 1;
  const getScaleOutPnl = (scaleOut) => {
    const manualPnl = toNumber(scaleOut.pnl);
    if (manualPnl !== null) return manualPnl;
    const size = toNumber(scaleOut.size);
    const price = toNumber(scaleOut.price);
    if (size === null || price === null || entryPrice === null) return null;
    return (price - entryPrice) * size * directionSign;
  };

  const normalizeText = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text || text === "[object Object]") return null;
    return text;
  };

  const looksLikeTechnicalId = (value) => {
    const text = normalizeText(value);
    if (!text) return false;
    if (/\s|@/.test(text)) return false;
    return /^[A-Za-z0-9_-]{12,}$/.test(text) || /^[a-f0-9]{16,}$/i.test(text);
  };

  const accountLabel = normalizeText(trade.accountName || trade.account_name || trade.account);
  const strategyLabel = normalizeText(trade.strategyName || trade.strategy_name || trade.strategy);
  const accountId = normalizeText(trade.account_id);
  const strategyId = normalizeText(trade.strategy_id);
  const accountDisplay = accountLabel || (looksLikeTechnicalId(accountId) ? null : accountId) || "-";
  const strategyDisplay = strategyLabel || (looksLikeTechnicalId(strategyId) ? null : strategyId) || "-";

  const outcomeRaw = normalizeText(trade.outcome);
  const outcomeDisplay = outcomeRaw && /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(outcomeRaw) ? outcomeRaw : "-";

  return (
    <Card className={`hover:border-primary/30 transition-colors ${bgColor} dark:bg-card dark:border-border border`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-foreground">{trade.symbol}</h3>
              <Badge className={directionBadgeClass(trade.direction)}>
                {directionText}
              </Badge>
              {trade.outcome && (
                <Badge variant="outline" className={tradeOutcomeBadgeClass(trade.outcome)}>
                  {tradeOutcomeDisplay(trade.outcome)}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatTradeDate(trade.date, dateFormat)}
              </span>
              {trade.time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {trade.time}
                </span>
              )}
              {trade.timeframe && (
                <Badge variant="outline" className="text-xs">
                  {trade.timeframe}
                </Badge>
              )}
            </div>
          </div>

          {onEdit && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(trade)}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Summary */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-xs font-semibold text-foreground mb-3">{t('quickSummary')}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t('symbol')}: {trade.symbol || '-'}</Badge>
            <Badge variant="outline">{t('lotSize')}: {trade.position_size || '-'}</Badge>
            <Badge variant="outline">{t('entryPrice')}: {trade.entry_price || '-'}</Badge>
            <Badge variant="outline">{t('closePrice')}: {trade.exit_price || '-'}</Badge>
            <Badge variant="outline">{t('entryTime')}: {formatTradeClock(trade, "entry") || '-'}</Badge>
            <Badge variant="outline">{t('exitTime')}: {formatTradeClock(trade, "exit") || '-'}</Badge>
          </div>
        </div>

        {/* Symbol Analysis */}
        {trade.symbolStats && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border">
            <p className="text-xs font-semibold text-foreground mb-3">{t('symbolAnalysis')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('tradesCount')}</p>
                <p className="font-semibold text-foreground">{trade.symbolStats.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('winRateLabel')}</p>
                <p className="font-semibold text-foreground">{trade.symbolStats.winRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('totalPL')}</p>
                <p className={`font-semibold ${parseFloat(trade.symbolStats.totalPL) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                  {parseFloat(trade.symbolStats.totalPL) >= 0 ? '+' : ''}{trade.symbolStats.totalPL}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('avgPLLabel')}</p>
                <p className="font-semibold text-foreground">{trade.symbolStats.avgPL}</p>
              </div>
            </div>
          </div>
        )}
        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('statusLabel')}</p>
            <Badge className={`${tradeStatusBadgeClass(trade.status)} truncate max-w-full`} title={tradeStatusDisplay(trade.status)}>
              {tradeStatusDisplay(trade.status)}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('account')}</p>
            <p className="font-semibold text-foreground truncate" title={accountDisplay}>{accountDisplay}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('strategy')}</p>
            <p className="font-semibold text-foreground truncate" title={strategyDisplay}>{strategyDisplay}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('outcome')}</p>
            <Badge variant="outline" className={`truncate max-w-full ${tradeOutcomeBadgeClass(outcomeDisplay)}`} title={outcomeDisplay}>
              {outcomeDisplay}
            </Badge>
          </div>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('entryPrice')}</p>
            <p className="font-semibold text-foreground">{trade.entry_price}</p>
          </div>
          {trade.exit_price && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('exit')}</p>
              <p className="font-semibold text-foreground">{trade.exit_price}</p>
            </div>
          )}
          {trade.stop_loss_pips != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('stopLossPips')}</p>
              <p className="font-semibold text-rose-600 dark:text-rose-300">{trade.stop_loss_pips}</p>
            </div>
          )}
          {trade.take_profit_pips != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('takeProfitPips')}</p>
              <p className="font-semibold text-amber-600 dark:text-amber-300">{trade.take_profit_pips}</p>
            </div>
          )}
          {trade.remaining_size != null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('remainingSize')}</p>
              <p className="font-semibold text-foreground">{trade.remaining_size}</p>
            </div>
          )}
          {trade.breakeven_moved && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('breakevenMoved')}</p>
              <p className="font-semibold text-foreground">{trade.breakeven_price || '-'}</p>
            </div>
          )}
        </div>

        {/* Partial Closures */}
        {Array.isArray(trade.scale_outs) && trade.scale_outs.length > 0 && (
          <div className="p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-xs font-semibold text-foreground mb-2">Częściowe zamknięcia pozycji</p>
            <div className="space-y-2 text-sm">
              {trade.scale_outs.map((scaleOut, index) => {
                const partialPnl = getScaleOutPnl(scaleOut);
                return (
                <div key={scaleOut.id || `scale-out-${index}`} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-slate-800 dark:text-slate-200">
                    <span>
                      {t('size')}: {scaleOut.size || '-'} | {t('price')}: {scaleOut.price || '-'}
                    </span>
                    <span className="ml-2 text-sm">
                      | Kwota zamknięcia: <span className={`font-semibold ${partialPnl === null ? 'text-muted-foreground' : partialPnl >= 0 ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {partialPnl === null ? '-' : `${partialPnl.toFixed(2)}$`}
                      </span>
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scaleOut.time || scaleOut.reason || ''}
                  </span>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* P&L */}
        {trade.profit_loss != null && (
          <div className={`p-4 rounded-xl ${isWin ? 'bg-green-100 dark:bg-green-900/20' : isLoss ? 'bg-red-100 dark:bg-red-900/20' : 'bg-muted'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isWin ? (
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : isLoss ? (
                  <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                ) : (
                  <Target className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">{t('profitLoss')}</span>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${plColor}`}>
                  {(getTradeRealizedPL(trade) ?? 0) > 0 ? '+' : ''}{(getTradeRealizedPL(trade) ?? 0).toFixed(2)}
                </p>
                {trade.profit_loss_percent != null && (
                  <p className={`text-sm ${plColor}`}>
                    ({parseFloat(trade.profit_loss_percent) > 0 ? '+' : ''}{parseFloat(trade.profit_loss_percent).toFixed(2)}%)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Strategy & Quality */}
        <div className="flex flex-wrap gap-2">
          {(trade.strategyName || trade.strategy) && (
            <Badge className="bg-muted text-foreground">
              {trade.strategyName || trade.strategy}
            </Badge>
          )}
          {trade.setup_quality && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Setup: {trade.setup_quality}
            </Badge>
          )}
          {trade.market_condition && (
            <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">
              {trade.market_condition}
            </Badge>
          )}
          {trade.risk_reward_ratio && (
            <Badge className="bg-muted text-foreground">
              R:R {parseFloat(trade.risk_reward_ratio).toFixed(2)}
            </Badge>
          )}
        </div>

        {/* Notes */}
        {trade.notes && (
          <div className="p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-xs font-semibold text-foreground mb-2">{t('notes')}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trade.notes}</p>
          </div>
        )}

        {/* Screenshots */}
        {[
          trade.screenshot_1,
          trade.screenshot_2,
          trade.screenshot_3
        ].filter(Boolean).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">{t('screenshots')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[trade.screenshot_1, trade.screenshot_2, trade.screenshot_3]
                .filter(Boolean)
                .map((screenshot, index) => (
                  <img
                    key={index}
                    src={screenshot}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full rounded-[6px] border border-slate-200 hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      setViewerImage(screenshot);
                      setViewerOpen(true);
                    }}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {trade.chart_screenshots && trade.chart_screenshots.filter(s => s).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Wykresy</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {trade.chart_screenshots.filter(s => s).map((screenshot, index) => (
                <img 
                  key={index}
                  src={screenshot} 
                  alt={`Chart ${index + 1}`} 
                  className="w-full rounded-[6px] border border-slate-200 hover:scale-105 transition-transform cursor-pointer"
                  onClick={() => {
                    setViewerImage(screenshot);
                    setViewerOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {trade.tags && trade.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trade.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs dark:border-slate-600 dark:text-slate-300">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Emotional State */}
        {trade.emotional_state && (
          <div className="text-xs text-muted-foreground">
            Stan emocjonalny: <span className="font-medium text-foreground">{trade.emotional_state}</span>
          </div>
        )}
        <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />
      </CardContent>
    </Card>
  );
}