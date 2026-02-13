import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { getTradingAccounts, getStrategies, uploadTradeScreenshot } from "@/lib/localStorage";
import { useQuery } from "@tanstack/react-query";
import { normalizeDirection } from "@/lib/utils";

export default function TradeForm({ trade, onSubmit, onCancel }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(trade ? { ...trade, direction: normalizeDirection(trade.direction) } : {
    // Basic Trade Info
    account_id: "",
    strategy_id: "",
    date: new Date().toISOString().split('T')[0],
    time: "",
    symbol: "",
    direction: "Long",
    position_size: "",
    entry_price: "",
    exit_price: "",

    // Risk Management
    stop_loss: "",
    take_profit: "",
    risk_amount: "",
    risk_percentage: "",

    // Market Conditions
    market_condition: "",
    timeframe: "",
    spread: "",
    commission: "",

    // Trade Setup
    entry_reason: "",
    exit_reason: "",
    setup_type: "",
    pattern: "",

    // Emotions & Psychology
    emotional_state: "",
    confidence_level: "",
    discipline_rating: "",

    // Results
    outcome: "",
    profit_loss: "",
    profit_loss_percent: "",
    holding_time: "",

    // Review & Learning
    mistakes: "",
    lessons_learned: "",
    improvements: "",
    notes: "",

    // Attachments
    screenshot_1: "",

    // Status
    status: "Planned"
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => user ? getTradingAccounts(user.id) : [],
    enabled: !!user
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies', user?.id],
    queryFn: () => user ? getStrategies(user.id) : [],
    enabled: !!user
  });

  const handleScreenshotUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      const url = await uploadTradeScreenshot(user.id, file);
      setFormData((prev) => ({ ...prev, screenshot_1: url }));
    } catch (error) {
      // Ignore upload errors for now
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Auto-calculate P&L and risk
    let profit_loss = formData.profit_loss || "";
    let profit_loss_percent = formData.profit_loss_percent || "";
    let outcome = formData.outcome;
    let risk_amount = formData.risk_amount || "";
    let risk_percentage = formData.risk_percentage || "";

    // Calculate P&L if entry and exit prices are provided
    if (formData.entry_price && formData.exit_price && formData.position_size) {
      const entry = parseFloat(formData.entry_price);
      const exit = parseFloat(formData.exit_price);
      const size = parseFloat(formData.position_size);
      const isLong = formData.direction === "Long";
      const priceDiff = isLong ? (exit - entry) : (entry - exit);
      const pl = priceDiff * size;
      profit_loss = pl.toFixed(2);
      profit_loss_percent = entry ? (priceDiff / entry * 100).toFixed(2) : "0.00";

      if (!outcome) {
        outcome = pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven";
      }
    }

    // Calculate risk amount if stop loss and position size are provided
    if (formData.stop_loss && formData.entry_price && formData.position_size && !risk_amount) {
      const entry = parseFloat(formData.entry_price);
      const stop = parseFloat(formData.stop_loss);
      const size = parseFloat(formData.position_size);
      const riskPerUnit = Math.abs(entry - stop);
      risk_amount = (riskPerUnit * size).toFixed(2);
    }

    // Calculate risk percentage if risk amount and account balance are available
    if (risk_amount && accounts.length > 0 && !risk_percentage) {
      const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
      if (selectedAccount && selectedAccount.balance) {
        risk_percentage = ((parseFloat(risk_amount) / parseFloat(selectedAccount.balance)) * 100).toFixed(2);
      }
    }

    const submitData = {
      ...formData,
      profit_loss,
      profit_loss_percent,
      risk_amount,
      risk_percentage,
      outcome: outcome || formData.outcome,
      status: formData.status || "Completed"
    };

    onSubmit(submitData);
  };

  if (!user?.id) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600">Please log in to add trades</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-transparent p-8 max-h-[80vh] overflow-y-auto">
      <div className="text-green-600 font-bold mb-4">✅ Professional Trade Journal Form</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Account & Strategy */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">📊 Account & Strategy</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Trading Account *</Label>
              <Select
                value={String(formData.account_id)}
                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.length === 0 ? (
                    <SelectItem value="" disabled>No accounts available</SelectItem>
                  ) : (
                    accounts.map(acc => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.account_type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Strategy</Label>
              <Select
                value={String(formData.strategy_id || '')}
                onValueChange={(value) => setFormData({ ...formData, strategy_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No strategy</SelectItem>
                  {strategies.length === 0 ? (
                    <SelectItem value="" disabled>No strategies available</SelectItem>
                  ) : (
                    strategies.map(str => (
                      <SelectItem key={str.id} value={String(str.id)}>{str.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Basic Trade Info */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">📈 Basic Trade Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
            <div>
              <Label>Symbol *</Label>
              <Input
                placeholder="EURUSD, AAPL, etc."
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div>
              <Label>Direction *</Label>
              <Select
                value={formData.direction}
                onValueChange={(value) => setFormData({ ...formData, direction: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Position & Prices */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">💰 Position & Prices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Position Size *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="1.5 lots"
                value={formData.position_size}
                onChange={(e) => setFormData({ ...formData, position_size: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Entry Price *</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.23456"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Exit Price</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.24567"
                value={formData.exit_price}
                onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Holding Time</Label>
              <Input
                placeholder="2h 30m, 1 day, etc."
                value={formData.holding_time}
                onChange={(e) => setFormData({ ...formData, holding_time: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">⚠️ Risk Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Stop Loss</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.22000"
                value={formData.stop_loss}
                onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
              />
            </div>
            <div>
              <Label>Take Profit</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.25000"
                value={formData.take_profit}
                onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
              />
            </div>
            <div>
              <Label>Risk Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="50.00"
                value={formData.risk_amount}
                onChange={(e) => setFormData({ ...formData, risk_amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Risk %</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.00"
                value={formData.risk_percentage}
                onChange={(e) => setFormData({ ...formData, risk_percentage: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Market Conditions */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3">🌍 Market Conditions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Market Condition</Label>
              <Select
                value={formData.market_condition}
                onValueChange={(value) => setFormData({ ...formData, market_condition: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Trending">Trending</SelectItem>
                  <SelectItem value="Ranging">Ranging</SelectItem>
                  <SelectItem value="Volatile">Volatile</SelectItem>
                  <SelectItem value="Calm">Calm</SelectItem>
                  <SelectItem value="News">News Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timeframe</Label>
              <Select
                value={formData.timeframe}
                onValueChange={(value) => setFormData({ ...formData, timeframe: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 minute</SelectItem>
                  <SelectItem value="5m">5 minutes</SelectItem>
                  <SelectItem value="15m">15 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                  <SelectItem value="1d">Daily</SelectItem>
                  <SelectItem value="1w">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Spread</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="2.5 pips"
                value={formData.spread}
                onChange={(e) => setFormData({ ...formData, spread: e.target.value })}
              />
            </div>
            <div>
              <Label>Commission</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.50"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Trade Setup */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3">🎯 Trade Setup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Setup Type</Label>
              <Select
                value={formData.setup_type}
                onValueChange={(value) => setFormData({ ...formData, setup_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select setup type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Breakout">Breakout</SelectItem>
                  <SelectItem value="Reversal">Reversal</SelectItem>
                  <SelectItem value="Continuation">Continuation</SelectItem>
                  <SelectItem value="Scalping">Scalping</SelectItem>
                  <SelectItem value="Swing">Swing Trade</SelectItem>
                  <SelectItem value="Position">Position Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pattern</Label>
              <Select
                value={formData.pattern}
                onValueChange={(value) => setFormData({ ...formData, pattern: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Double Top">Double Top</SelectItem>
                  <SelectItem value="Double Bottom">Double Bottom</SelectItem>
                  <SelectItem value="Head & Shoulders">Head & Shoulders</SelectItem>
                  <SelectItem value="Triangle">Triangle</SelectItem>
                  <SelectItem value="Flag">Flag</SelectItem>
                  <SelectItem value="Channel">Channel</SelectItem>
                  <SelectItem value="Support/Resistance">Support/Resistance</SelectItem>
                  <SelectItem value="Moving Average">Moving Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Psychology & Emotions */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-pink-50 dark:bg-pink-950/20 rounded-xl border border-pink-200 dark:border-pink-800">
          <h3 className="text-lg font-semibold text-pink-900 dark:text-pink-100 mb-3">🧠 Psychology & Emotions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Emotional State</Label>
              <Select
                value={formData.emotional_state}
                onValueChange={(value) => setFormData({ ...formData, emotional_state: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How did you feel?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Calm">Calm</SelectItem>
                  <SelectItem value="Excited">Excited</SelectItem>
                  <SelectItem value="Anxious">Anxious</SelectItem>
                  <SelectItem value="Greedy">Greedy</SelectItem>
                  <SelectItem value="Fearful">Fearful</SelectItem>
                  <SelectItem value="Confident">Confident</SelectItem>
                  <SelectItem value="Impatient">Impatient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Confidence Level</Label>
              <Select
                value={formData.confidence_level}
                onValueChange={(value) => setFormData({ ...formData, confidence_level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="1-10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Very Low</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 - Medium</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10 - Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discipline Rating</Label>
              <Select
                value={formData.discipline_rating}
                onValueChange={(value) => setFormData({ ...formData, discipline_rating: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="1-10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 - Average</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10 - Excellent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3">📊 Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Outcome</Label>
              <Select
                value={formData.outcome}
                onValueChange={(value) => setFormData({ ...formData, outcome: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Win/Loss/Breakeven" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                  <SelectItem value="Breakeven">Breakeven</SelectItem>
                  <SelectItem value="Partial Win">Partial Win</SelectItem>
                  <SelectItem value="Partial Loss">Partial Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>P&L ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="125.50"
                value={formData.profit_loss}
                onChange={(e) => setFormData({ ...formData, profit_loss: e.target.value })}
              />
            </div>
            <div>
              <Label>P&L (%)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.45"
                value={formData.profit_loss_percent}
                onChange={(e) => setFormData({ ...formData, profit_loss_percent: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Entry & Exit Reasons */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-teal-50 dark:bg-teal-950/20 rounded-xl border border-teal-200 dark:border-teal-800">
          <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-100 mb-3">📝 Entry & Exit Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Entry Reason</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={3}
                placeholder="Why did you enter this trade?"
                value={formData.entry_reason}
                onChange={(e) => setFormData({ ...formData, entry_reason: e.target.value })}
              />
            </div>
            <div>
              <Label>Exit Reason</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={3}
                placeholder="Why did you exit this trade?"
                value={formData.exit_reason}
                onChange={(e) => setFormData({ ...formData, exit_reason: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Review & Learning */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-gray-50 dark:bg-gray-950/20 rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">📚 Review & Learning</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Mistakes Made</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                rows={3}
                placeholder="What went wrong?"
                value={formData.mistakes}
                onChange={(e) => setFormData({ ...formData, mistakes: e.target.value })}
              />
            </div>
            <div>
              <Label>Lessons Learned</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                rows={3}
                placeholder="What did you learn?"
                value={formData.lessons_learned}
                onChange={(e) => setFormData({ ...formData, lessons_learned: e.target.value })}
              />
            </div>
            <div>
              <Label>Improvements</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                rows={3}
                placeholder="How to improve next time?"
                value={formData.improvements}
                onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* General Notes */}
        <div className="md:col-span-2 lg:col-span-3 p-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">📝 General Notes</h3>
          <div>
            <Label>Additional Notes</Label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              rows={4}
              placeholder="Any additional notes, screenshots, or observations..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <Label>Screenshot</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input type="file" accept="image/*" onChange={handleScreenshotUpload} />
              {formData.screenshot_1 && (
                <a
                  href={formData.screenshot_1}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-300"
                >
                  View uploaded screenshot
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          {trade ? "Save Changes" : "Add Trade"}
        </Button>
      </div>
    </form>
  );
}