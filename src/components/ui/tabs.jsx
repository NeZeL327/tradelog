import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { useActiveIndicator } from "@/hooks/use-active-indicator"

const Tabs = TabsPrimitive.Root

const NO_REF = { current: null }

// indicator: płynnie przesuwane podkreślenie aktywnej zakładki (tylko dla stylu z podkreśleniem).
const TabsList = React.forwardRef(({ className, indicator = false, children, ...props }, ref) => {
  const listRef = React.useRef(null)
  const indicatorRef = React.useRef(null)
  const setRefs = React.useCallback((node) => {
    listRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }, [ref])
  useActiveIndicator(indicator ? listRef : NO_REF, indicatorRef, '[role="tab"][data-state="active"]', "x")

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "inline-flex h-9 items-center justify-start gap-4 border-b border-ds-line bg-transparent p-0 text-ds-text3",
        indicator && "tabs-has-indicator relative",
        className
      )}
      {...props}>
      {children}
      {indicator ? <span ref={indicatorRef} aria-hidden="true" className="motion-indicator tabs-indicator" /> : null}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px inline-flex h-9 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-0.5 text-[13px] font-medium text-ds-text3 transition-colors duration-200 hover:text-ds-text2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-ds-text data-[state=active]:text-ds-text data-[state=active]:shadow-none",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
