import { useRef, useState } from "react";
import { ImageOff, ImagePlus, Trash2 } from "lucide-react";
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

function PhotoCard({ item, busy, onOpen, onSaveCaption, onRemove }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/15">
      <button
        type="button"
        className="block w-full"
        onClick={() => {
          if (!broken) onOpen(item.url);
        }}
      >
        {broken ? (
          <div className="flex min-h-[8rem] flex-col items-center justify-center gap-1.5 bg-black/30 px-3 py-6">
            <ImageOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Nie udało się wczytać zdjęcia</span>
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.caption || "Zdjęcie transakcji"}
            className="max-h-36 min-h-[8rem] w-full bg-black/30 object-contain"
            onError={() => setBroken(true)}
          />
        )}
      </button>
      <div className="flex items-center gap-2 p-2">
        <Input
          defaultValue={item.caption}
          placeholder="Opis / nazwa"
          className="h-8 text-[12px]"
          onBlur={(e) => {
            const next = e.target.value;
            if (next !== item.caption) onSaveCaption(item, next);
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0 text-loss"
          disabled={busy}
          onClick={() => onRemove(item)}
          aria-label="Usuń zdjęcie"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
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
    <div className="space-y-3 pb-2">
      <div
        className={cn(
          "rounded-xl border border-dashed text-center transition-colors",
          items.length ? "px-3 py-3" : "px-3 py-5",
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
        <p className="py-4 text-center text-sm text-muted-foreground">
          Brak zdjęć przypisanych do tej transakcji.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <PhotoCard
              key={item.id}
              item={item}
              busy={busy}
              onOpen={onOpenImage}
              onSaveCaption={saveCaption}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
