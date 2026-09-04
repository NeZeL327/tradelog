import { cn } from "@/lib/utils"

export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="cyber-page-title type-page-title">{title}</h1>
        {subtitle ? <p className="cyber-page-sub type-secondary mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}
