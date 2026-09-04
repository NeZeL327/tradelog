import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function SkeletonBlock({ className, rows = 3 }) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      <Skeleton className="h-3 w-24 bg-muted" />
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-8 w-full bg-muted" />
      ))}
    </div>
  )
}

export function SkeletonKpiRow({ count = 5 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 rounded-lg border border-border overflow-hidden">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 border-b sm:border-b-0 lg:border-r border-border last:border-0 space-y-2">
          <Skeleton className="h-3 w-16 bg-muted" />
          <Skeleton className="h-7 w-24 bg-muted" />
          <Skeleton className="h-3 w-20 bg-muted" />
        </div>
      ))}
    </div>
  )
}
