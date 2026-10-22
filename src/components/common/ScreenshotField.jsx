import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/imageUpload";
import SafeImage from "@/components/common/SafeImage";

export { isImageFile };

export default function ScreenshotField({
  slotId,
  label,
  value,
  pending,
  processing,
  onPickFile,
  onRemove,
  onView,
  addLabel,
  changeLabel,
  removeLabel,
  viewLabel,
  uploadError,
  pendingLabel,
  processingLabel,
}) {
  return (
    <div className="w-full min-w-0">
      {label ? (
        <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
      ) : null}
      <input
        id={slotId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={processing}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={onPickFile}
      />
      <div className="relative mx-auto h-16 w-full overflow-hidden rounded-lg border border-border/70 bg-muted/20">
        {processing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <span className="px-1 text-center text-[10px] font-medium text-primary-foreground">
              {processingLabel || "…"}
            </span>
          </div>
        ) : value ? (
          <>
            <button
              type="button"
              className="absolute inset-0"
              onClick={onView}
              aria-label={viewLabel}
            >
              <SafeImage
                src={value}
                alt={label || ""}
                className="h-full w-full object-cover"
              />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black/90"
              onClick={onRemove}
              aria-label={removeLabel}
            >
              <X className="h-3 w-3" />
            </button>
            {pending ? (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                {pendingLabel || ""}
              </div>
            ) : null}
          </>
        ) : (
          <label
            htmlFor={slotId}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center hover:bg-primary/5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{addLabel}</span>
          </label>
        )}
      </div>
      {uploadError ? <p className="mt-1 text-xs text-loss dark:text-loss">{uploadError}</p> : null}
      {value && !processing ? (
        <div className="mt-1 flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="h-6 min-w-0 flex-1 px-1.5 text-[10px]" asChild>
            <label htmlFor={slotId} className="cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
              {changeLabel}
            </label>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
