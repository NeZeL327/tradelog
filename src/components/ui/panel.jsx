import * as React from "react"
import { cn } from "@/lib/utils"

const Panel = React.forwardRef(({ className, as: Comp = "div", ...props }, ref) => (
  <Comp
    ref={ref}
    className={cn("rounded-xl border border-border bg-card text-card-foreground", className)}
    {...props}
  />
))
Panel.displayName = "Panel"

const PanelHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-between gap-3 px-4 pt-4 pb-2", className)} {...props} />
))
PanelHeader.displayName = "PanelHeader"

const PanelTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("type-section", className)} {...props} />
))
PanelTitle.displayName = "PanelTitle"

const PanelBody = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pb-4", className)} {...props} />
))
PanelBody.displayName = "PanelBody"

export { Panel, PanelHeader, PanelTitle, PanelBody }
