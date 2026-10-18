import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-[12px] border border-ds-line bg-ds-s2 px-3.5 py-2.5 text-sm text-ds-text shadow-none transition-[border-color,box-shadow] duration-200 placeholder:text-ds-text3 focus-visible:border-[color:var(--ds-sel-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
