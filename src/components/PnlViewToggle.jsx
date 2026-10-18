import { Button } from "@/components/ui/button";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { cn } from "@/lib/utils";

export default function PnlViewToggle({ className = "" }) {
  const { mode, currencyLabel, setMode } = usePnlDisplay();

  return (
    <div
      className={cn("inline-flex h-7 items-center rounded-md border border-border bg-background/40 p-0.5", className)}
      role="group"
      aria-label="Widok wyników"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setMode("money")}
        className={cn(
          "h-6 rounded-sm px-2 text-[11px] font-semibold",
          mode === "money"
            ? "bg-ds-s3 text-ds-text hover:bg-ds-s3 hover:text-ds-text"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "money"}
        title="Wyniki w walucie konta"
      >
        {currencyLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setMode("percent")}
        className={cn(
          "h-6 rounded-sm px-2 text-[11px] font-semibold",
          mode === "percent"
            ? "bg-ds-s3 text-ds-text hover:bg-ds-s3 hover:text-ds-text"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "percent"}
        title="Wyniki jako procent salda konta"
      >
        %
      </Button>
    </div>
  );
}
