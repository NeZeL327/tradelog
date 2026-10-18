import * as React from "react"

import { cn } from "@/lib/utils"

const Input = /** @type {any} */ (React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-[12px] border border-ds-line bg-ds-s2 px-3 py-1 text-[13px] text-ds-text shadow-none transition-[border-color,box-shadow] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ds-text placeholder:text-ds-text3 focus-visible:border-[color:var(--ds-sel-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
)))
Input.displayName = "Input"

export { Input }
