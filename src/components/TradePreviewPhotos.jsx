import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { persistTradeScreenshot } from "@/lib/localStorage";
import { cn } from "@/lib/utils";
import {
  captionPatch,
  getTradePhotoItems,
  nextScreenshotPatch,
  removeScreenshotPatch,
} from "@/lib/tradePreviewStats";

function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "");
}

export default function TradePreviewPhotos({
  trade,
  userId,
  persistPatch,
  onOpenImage,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = getTradePhotoItems(trade);

  const persist = async (patch) => {
    await persistPatch(patch);
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) {
      toast.error("Wybierz plik graficzny (JPG, PNG, WebP).");
      return;
    }
    if (!userId) {
      toast.error("Musisz być zalogowany.");
      return;
    }
    setBusy(true);
    try {
      let current = trade;
      for (const file of files) {
        const url = await persistTradeScreenshot(userId, file);
        const patch = nextScreenshotPatch(current, url);
        await persist(patch);
        current = { ...current, ...patch };
      }
      toast.success("Zdjęcie zapisane");
    } catch (err) {
      toast.error(err?.message || "Nie udało się dodać zdjęcia");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item) => {
    setBusy(true);
    try {
      await persist(removeScreenshotPatch(trade, item));
    } catch (err) {
      toast.error(err?.message || "Nie udało się usunąć zdjęcia");
    } finally {
      setBusy(false);
    }
  };

  const saveCaption = async (item, caption) => {
    try {
      await persist(captionPatch(trade, item, caption));
    } catch (err) {
      toast.error(err?.message || "Nie udało się zapisać opisu");
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl border border-dashed px-3 py-5 text-center transition-colors",
          dragOver ? "border-primary bg-primary/10" : "border-white/15 bg-black/10"
        )}
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
      >
        <ImagePlus className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-[12px] text-muted-foreground">Przeciągnij zdjęcie albo wgraj z dysku</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Wgraj zdjęcie
        </Button>
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
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Brak zdjęć przypisanych do tej transakcji.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.06] bg-black/15 overflow-hidden">
              <button
                type="button"
                className="block w-full"
                onClick={() => onOpenImage(item.url)}
              >
                <img src={item.url} alt={item.caption || "Zdjęcie transakcji"} className="w-full max-h-48 object-contain bg-black/30" />
              </button>
              <div className="flex items-center gap-2 p-2">
                <Input
                  defaultValue={item.caption}
                  placeholder="Opis / nazwa"
                  className="h-8 text-[12px]"
                  onBlur={(e) => {
                    const next = e.target.value;
                    if (next !== item.caption) saveCaption(item, next);
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0 text-loss"
                  disabled={busy}
                  onClick={() => removeItem(item)}
                  aria-label="Usuń zdjęcie"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
