import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Target, ArrowRight } from "lucide-react";

export default function GoalsPreview({ goals = [], trades = [] }) {
  try {
    if (!goals || goals.length === 0) return null;

    const activeGoals = goals.filter(g => g?.status === "active").slice(0, 3);

    if (activeGoals.length === 0) return null;

    return (
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border border-purple-200 dark:border-purple-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Cele finansowe
          </CardTitle>
          <Link to={createPageUrl("Goals")}>
            <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-100">
              Zarządzaj <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeGoals.map(goal => {
            const current = goal.current_value || 0;
            const target = goal.target_value || 1;
            const percentage = Math.min((current / target) * 100, 100);
            
            return (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">{goal.title}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {current.toFixed(1)}/{target} {goal.unit}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: goal.color || '#8b5cf6'
                    }}
                  />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{percentage.toFixed(0)}%</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error("GoalsPreview error:", error);
    return null;
  }
}