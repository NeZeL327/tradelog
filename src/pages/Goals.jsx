import React, { useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getGoals, createGoal, updateGoal, deleteGoal, getTrades, getTradingAccounts } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, CheckCircle2, Circle, AlertCircle, Target } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";

export default function Goals() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => getGoals(user?.id),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createGoal(user?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowForm(false);
      toast.success("Cel został dodany");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateGoal(user?.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowForm(false);
      setEditingGoal(null);
      toast.success("Cel został zaktualizowany");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteGoal(user?.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success("Cel został usunięty");
    },
  });

  const calculateProgress = (goal) => {
    const current = goal.current_value || 0;
    const target = goal.target_value || 1;
    return { current, target };
  };

  const activeGoals = goals.filter(g => g.status === "active");
  const completedGoals = goals.filter(g => g.status === "completed");
  const failedGoals = goals.filter(g => g.status === "failed");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-2 sm:p-3">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('financialGoals')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('defineTrackGoals')}</p>
          </div>
          <Button
            onClick={() => {
              setEditingGoal(null);
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('newGoal')}
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <GoalForm
              goal={editingGoal}
              onSubmit={(data) => {
                if (editingGoal) {
                  updateMutation.mutate({ id: editingGoal.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingGoal(null);
              }}
            />
          )}
        </AnimatePresence>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Circle className="w-5 h-5 text-blue-500" />
              {t('activeGoals')} ({activeGoals.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeGoals.map((goal) => {
                const progress = calculateProgress(goal);
                const percentage = Math.min((progress.current / progress.target) * 100, 100);
                
                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progress}
                    percentage={percentage}
                    onEdit={() => {
                      setEditingGoal(goal);
                      setShowForm(true);
                    }}
                    onDelete={() => deleteMutation.mutate(goal.id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {t('completedGoals')} ({completedGoals.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedGoals.map((goal) => {
                const progress = calculateProgress(goal);
                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progress}
                    percentage={100}
                    completed
                    onEdit={() => {
                      setEditingGoal(goal);
                      setShowForm(true);
                    }}
                    onDelete={() => deleteMutation.mutate(goal.id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {activeGoals.length === 0 && completedGoals.length === 0 && failedGoals.length === 0 && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="text-center py-12">
              <Target className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">{t('noGoalsYet')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function GoalForm({ goal, onSubmit, onCancel }) {
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState(goal || {
    title: "",
    description: "",
    goal_type: "monthly_profit",
    target_value: "",
    unit: "USD",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    status: "active",
    priority: "medium",
    color: "#3b82f6",
    notes: ""
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">{goal ? t('editGoal') : t('newGoal')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('goalName')} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Earn 1000 USD"
                  required
                />
              </div>

              <div>
                <Label>{t('goalType')} *</Label>
                <Select value={formData.goal_type} onValueChange={(value) => setFormData({ ...formData, goal_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_profit">{t('monthlyProfit')}</SelectItem>
                    <SelectItem value="total_capital">{t('totalCapital')}</SelectItem>
                    <SelectItem value="win_rate">{t('winRate')}</SelectItem>
                    <SelectItem value="profit_factor">{t('profitFactorGoal')}</SelectItem>
                    <SelectItem value="trades_count">{t('tradesCount')}</SelectItem>
                    <SelectItem value="custom">{t('customGoal')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('targetValue')} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  placeholder="e.g. 1000"
                  required
                />
              </div>

              <div>
                <Label>{t('unit')} *</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="USD, %, number"
                  required
                />
              </div>

              <div>
                <Label>{t('startDate')}</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label>{t('endDate')}</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>

              <div>
                <Label>{t('priority')}</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('lowPriority')}</SelectItem>
                    <SelectItem value="medium">{t('mediumPriority')}</SelectItem>
                    <SelectItem value="high">{t('highPriority')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('status')}</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('statusActive')}</SelectItem>
                    <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
                    <SelectItem value="failed">{t('statusFailed')}</SelectItem>
                    <SelectItem value="paused">{t('statusPaused')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('color')}</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                {goal ? t('save') : t('createGoal')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function GoalCard({ goal, progress, percentage, completed, onEdit, onDelete }) {
  const { t } = useLanguage();
  
  const priorityColors = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  };
  
  const goalTypeLabels = {
    "monthly_profit": t('monthlyProfit'),
    "total_capital": t('totalCapital'),
    "win_rate": t('winRate'),
    "profit_factor": t('profitFactorGoal'),
    "trades_count": t('tradesCount'),
    "custom": t('customGoal')
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className={`bg-white dark:bg-slate-800 border shadow-lg ${completed ? 'border-green-300 dark:border-green-700' : 'border-slate-200 dark:border-slate-700'}`}>
        <div className={`h-1.5 bg-gradient-to-r`} style={{ backgroundImage: `linear-gradient(to right, ${goal.color}, ${goal.color}cc)` }} />
        
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base dark:text-white">{goal.title}</CardTitle>
                {completed && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{goalTypeLabels[goal.goal_type]}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('progress')}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {progress.current.toFixed(2)} / {progress.target.toFixed(2)} {goal.unit}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: goal.color
                }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-block">{percentage.toFixed(0)}%</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[goal.priority]}`}>
              {goal.priority === 'low' ? t('lowPriorityLabel') : goal.priority === 'medium' ? t('mediumPriorityLabel') : t('highPriorityLabel')}
            </span>
            {goal.end_date && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {t('to')}: {new Date(goal.end_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {goal.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{goal.notes}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}