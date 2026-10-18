import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }) {
  return (
    <div className={cn("space-y-3 rounded-ds-lg border border-dashed border-ds-line px-4 py-12 text-center motion-safe:animate-ds-enter", className)}>
      {Icon ? (
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ds-s3 text-ds-text2">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
      ) : null}
      {title ? <p className="text-[14px] font-medium text-ds-text">{title}</p> : null}
      {description ? <p className="mx-auto max-w-sm text-[13px] text-ds-text2">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
