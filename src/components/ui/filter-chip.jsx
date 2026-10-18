import { cn } from "@/lib/utils"

export function FilterChip({ active, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150",
        active
          ? "bg-ds-s3 text-ds-text border-ds-frame"
          : "bg-transparent border-ds-line text-ds-text2 hover:text-ds-text hover:bg-ds-s2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
