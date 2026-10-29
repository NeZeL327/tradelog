import { motionEnabled, motionScale } from "@/lib/motion";

// Hex values (not CSS vars) because recharts passes these as SVG attributes.
export const CHART = {
  profit: "#7DDC6B",
  loss: "#F2555F",
  accent: "#6B7CFF",
  line: "#6B7CFF",
  muted: "#7A8299",
  grid: "rgba(128, 140, 165, 0.12)",
  axis: "#7A8299",
  long: "#7DDC6B",
  short: "#F2555F",
  warning: "#E6B83A",
  neutral: "#9099B2",
};

export const chartTooltipStyle = {
  backgroundColor: "var(--ds-glass)",
  border: "1px solid var(--ds-frame)",
  borderRadius: 12,
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  color: "var(--ds-text)",
  boxShadow: "var(--ds-shadow-pop)",
};

export const chartLegendStyle = {
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  color: "var(--ds-text2)",
};

export const chartGridProps = {
  stroke: "rgba(128, 140, 165, 0.12)",
  vertical: false,
};

// Gettery: tryb animacji (Ustawienia / "ogranicz ruch") czytany przy każdym renderze wykresu.
export const chartSeriesProps = {
  get isAnimationActive() {
    return motionEnabled();
  },
  get animationDuration() {
    return Math.round(400 * Math.max(motionScale(), 1));
  },
  animationEasing: "ease-out",
};

export const chartBarRadius = [6, 6, 0, 0];
