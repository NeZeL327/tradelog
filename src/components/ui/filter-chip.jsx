import { cn } from "@/lib/utils"

export function FilterChip({ active, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-[0_0_16px_hsl(var(--primary)/0.4)]"
          : "bg-card/80 border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
