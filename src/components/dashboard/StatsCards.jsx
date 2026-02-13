import React from 'react';
import { Card, CardHeader } from "@/components/ui/card";

export default function StatsCards({ title, value, icon: Icon, gradient }) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/90 backdrop-blur-sm">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} rounded-full opacity-10 transform translate-x-12 -translate-y-12`} />
      <CardHeader className="p-4 md:p-6">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">{title}</p>
            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mt-2 break-all">
              {value}
            </p>
          </div>
          <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0`}>
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}