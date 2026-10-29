import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      aria-hidden="true"
      className={cn(
        "rounded-ds-sm bg-ds-skeleton bg-[linear-gradient(90deg,transparent,var(--ds-s2),transparent)] bg-[length:200%_100%] bg-no-repeat motion-safe:animate-ds-shimmer",
        className
      )}
      {...props} />)
  );
}

export { Skeleton }
