import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { persistReportScreenshot } from "@/lib/localStorage";
import ImageViewer from "@/components/common/ImageViewer";

const MAX_IMAGES = 12;

export default function ReportScreenshots({
  userId,
  images = [],
  onChange,
  readOnly = false,
  t,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");

  const addFiles = async (fileList) => {
    if (!userId || readOnly) return;
    const files = [...fileList].filter((f) => f.type?.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_IMAGES - (images?.length || 0);
    if (room <= 0) return;
    setUploading(true);
    try {
      const next = [...(images || [])];
      for (const file of files.slice(0, room)) {
        const url = await persistReportScreenshot(userId, file);
        if (url) next.push(url);
      }
      onChange?.(next);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx) => {
    if (readOnly) return;
    onChange?.((images || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div
          className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">
                {t("reportDropImages") || "Przeciągnij zdjęcia lub kliknij, aby wybrać"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("reportMaxImages") || `Max ${MAX_IMAGES} zdjęć`}
              </p>
            </>
          )}
        </div>
      )}

      {(images?.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted"
            >
              <button
                type="button"
                className="w-full h-full"
                onClick={() => setViewerUrl(url)}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
              {!readOnly && (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1.5 right-1.5 h-7 w-7 opacity-90"
                  onClick={() => removeAt(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <ImageViewer
        open={!!viewerUrl}
        onOpenChange={(open) => !open && setViewerUrl("")}
        imageUrl={viewerUrl}
      />
    </div>
  );
}
