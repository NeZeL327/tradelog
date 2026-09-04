import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border py-14 px-4 text-center space-y-3", className)}>
      {Icon ? <Icon className="w-8 h-8 mx-auto text-muted-foreground" strokeWidth={1.5} /> : null}
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      {description ? <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
