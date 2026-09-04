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
  warning: "hsl(var(--warning))",
};

export const chartTooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "none",
};

export const chartLegendStyle = {
  fontSize: 11,
  color: "hsl(var(--muted-foreground))",
};

export const chartGridProps = {
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.45,
  vertical: false,
};
