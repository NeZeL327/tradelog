export const CHART = {
  profit: "hsl(var(--profit))",
  loss: "hsl(var(--loss))",
  accent: "hsl(var(--primary))",
  line: "hsl(var(--primary))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  long: "hsl(var(--profit))",
  short: "hsl(var(--loss))",
  warning: "hsl(38 70% 48%)",
};

export const chartTooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px hsl(0 0% 0% / 0.35)",
};

export const chartGridProps = {
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.45,
  vertical: false,
};
