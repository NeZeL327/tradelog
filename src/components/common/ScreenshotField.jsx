import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
}

export default function ScreenshotField({
  slotId,
  label,
  value,
  pending,
  onPickFile,
  onRemove,
  onView,
  addLabel,
  changeLabel,
  removeLabel,
  viewLabel,
  uploadError,
}) {
  return (
    <div className="w-full min-w-0">
      {label ? (
        <Label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
          {label}
        </Label>
      ) : null}
      <input
        id={slotId}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={onPickFile}
      />
      <label
        htmlFor={slotId}
        className="relative mx-auto flex items-center justify-center size-32 aspect-square border border-dashed border-border/70 rounded-lg bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition cursor-pointer overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label || ""}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            {pending && (
              <div className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-medium text-primary-foreground bg-primary/90 rounded px-1 py-0.5 pointer-events-none">
                Zapisze po „Zapisz”
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-1">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{addLabel}</span>
          </div>
        )}
      </label>
      {uploadError && (
        <p className="mt-1 text-xs text-loss dark:text-loss">{uploadError}</p>
      )}
      {value && (
        <div className="mt-1.5 flex flex-nowrap items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 min-w-0 flex-1 px-1.5 text-[11px] whitespace-nowrap" onClick={onRemove}>
            {removeLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 min-w-0 flex-1 px-1.5 text-[11px] whitespace-nowrap" onClick={onView}>
            {viewLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 min-w-0 flex-1 px-1.5 text-[11px] whitespace-nowrap" asChild>
            <label htmlFor={slotId} className="cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
              {changeLabel}
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}
