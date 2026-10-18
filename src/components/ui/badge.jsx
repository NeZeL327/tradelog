import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)]",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--ds-sel-line)] bg-ds-sel text-ds-accent",
        secondary:
          "border-ds-line bg-transparent text-ds-text2",
        destructive:
          "border-transparent bg-[color:var(--ds-neg-tint)] text-ds-neg",
        outline: "border-ds-line text-ds-text2",
        win: "border-transparent bg-[color:var(--ds-pos-tint)] text-ds-pos",
        loss: "border-transparent bg-[color:var(--ds-neg-tint)] text-ds-neg",
        long: "border-transparent bg-[color:var(--ds-pos-tint)] text-ds-pos",
        short: "border-transparent bg-[color:var(--ds-neg-tint)] text-ds-neg",
        pending: "border-transparent bg-[color:var(--ds-warn-tint)] text-ds-warn",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
