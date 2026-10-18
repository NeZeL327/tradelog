import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function SkeletonBlock({ className, rows = 3 }) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-8 w-full" />
      ))}
    </div>
  )
}

export function SkeletonKpiRow({ count = 5 }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-ds-lg border border-ds-line bg-ds-line md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="space-y-2 bg-ds-s1 p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCardGrid({ count = 3, className }) {
  return (
    <div role="status" aria-label="Loading" className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="space-y-4 rounded-ds-lg border border-ds-line bg-ds-s1 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-2 p-4", className)}>
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-11 w-full rounded-ds-md" />
      ))}
    </div>
  )
}
