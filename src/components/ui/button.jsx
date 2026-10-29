import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-motion inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-glow bg-primary text-primary-foreground hover:brightness-110",
        destructive:
          "bg-ds-neg text-white hover:brightness-110",
        outline:
          "border border-ds-line bg-transparent text-ds-text2 hover:bg-ds-s3 hover:text-ds-text",
        secondary:
          "border border-ds-line bg-ds-s2 text-ds-text2 hover:bg-ds-s3 hover:text-ds-text",
        ghost: "text-ds-text2 hover:bg-ds-s3 hover:text-ds-text",
        link: "text-ds-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-1.5 text-[13px]",
        sm: "h-8 rounded-[8px] px-3 text-xs",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = /** @type {any} */ (React.forwardRef(({ className, variant, size, asChild = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {children}
    </Comp>
  );
}))
Button.displayName = "Button"

export { Button, buttonVariants }
