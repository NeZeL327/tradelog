import { cn } from "@/lib/utils"

export function Metric({ label, value, hint, tone = "default", className }) {
  const toneClass =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground"

  return (
    <div className={cn("min-w-0 py-3 px-4", className)}>
      {label ? <p className="type-section mb-2">{label}</p> : null}
      <p className={cn("type-metric truncate", toneClass)}>{value}</p>
      {hint ? <p className="type-secondary mt-1.5 truncate">{hint}</p> : null}
    </div>
  )
}

export function MetricRow({ className, children }) {
  return (
    <div
      className={cn(
        "dashboard-kpi-row grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 rounded-lg border border-border bg-card overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  )
}
