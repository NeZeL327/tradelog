import { useEffect, useRef, useState } from "react";
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
import { useLanguage } from "@/components/LanguageProvider";
import SafeImage from "@/components/common/SafeImage";
import {
  IMAGE_ACCEPT,
  filesFromClipboard,
  imageUploadMessage,
  isImageFile,
  isTypingTarget,
  prepareImageFile,
} from "@/lib/imageUpload";

function PhotoCard({ item, busy, onOpen, onSaveCaption, onRemove, captionPlaceholder, removeLabel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/15">
      <button
        type="button"
        className="block w-full"
        onClick={() => onOpen(item.url)}
      >
        <SafeImage
          src={item.url}
          alt={item.caption || ""}
          className="max-h-36 min-h-[8rem] w-full bg-black/30 object-contain"
        />
      </button>
      <div className="flex items-center gap-2 p-2">
        <Input
          defaultValue={item.caption}
          placeholder={captionPlaceholder}
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
          aria-label={removeLabel}
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
  const { t } = useLanguage();
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
      toast.error(t("imageUnsupported"));
      return;
    }
    if (!userId) {
      toast.error(t("mustBeLoggedIn"));
      return;
    }
    setBusy(true);
    try {
      let current = trade;
      for (const file of files) {
        const ready = await prepareImageFile(file);
        const url = await persistTradeScreenshot(userId, ready);
        const patch = nextScreenshotPatch(current, url);
        await persist(patch);
        current = { ...current, ...patch };
      }
      toast.success(t("imageSaved"));
    } catch (err) {
      toast.error(imageUploadMessage(err, t) || err?.message || t("imageAddFailed"));
    } finally {
      setBusy(false);
    }
  };

  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  useEffect(() => {
    const onPaste = (e) => {
      if (isTypingTarget(e.target)) return;
      const files = filesFromClipboard(e.clipboardData).filter(isImageFile);
      if (!files.length) return;
      e.preventDefault();
      void addFilesRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const removeItem = async (item) => {
    setBusy(true);
    try {
      await persist(removeScreenshotPatch(trade, item));
    } catch (err) {
      toast.error(err?.message || t("imageRemoveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const saveCaption = async (item, caption) => {
    try {
      await persist(captionPatch(trade, item, caption));
    } catch (err) {
      toast.error(err?.message || t("imageCaptionFailed"));
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
        <p className="mt-2 text-[12px] text-muted-foreground">
          {busy ? t("imageProcessing") : t("imageDropHint")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {t("uploadPhoto")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
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
          {t("noTradePhotos")}
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
              captionPlaceholder={t("photoCaption")}
              removeLabel={t("remove")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
