import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, chartGridProps, chartSeriesProps, chartTooltipStyle } from "@/lib/chartTheme";

export default function DashboardEquitySpark({ equity }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={equity} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="date" hide />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Area type="monotone" dataKey="pl" stroke={CHART.accent} strokeWidth={1.5} fill="url(#eqFill)" {...chartSeriesProps} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
