import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { displayableObjectUrl, isTiff, releaseDisplayUrl } from "@/lib/imageConvert";

export default function SafeImage({
  src,
  alt = "",
  className,
  style,
  onClick,
  loading,
  decoding,
}) {
  const { t } = useLanguage();
  const [shown, setShown] = useState(src);
  const [status, setStatus] = useState(() => (src && isTiff(null, src) ? "converting" : "try"));

  useEffect(() => {
    let dead = false;
    setShown(src);
    setStatus("try");
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) return undefined;

    const convert = async () => {
      setStatus("converting");
      try {
        const url = await displayableObjectUrl(src);
        if (dead) {
          releaseDisplayUrl(src);
          return;
        }
        setShown(url);
        setStatus("ok");
      } catch {
        if (!dead) setStatus("fallback");
      }
    };

    if (isTiff(null, src)) void convert();

    return () => {
      dead = true;
      releaseDisplayUrl(src);
    };
  }, [src]);

  const openOriginal = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (src) window.open(src, "_blank", "noopener,noreferrer");
  };

  if (!src) return null;

  if (status === "converting") {
    return (
      <span className={cn("flex items-center justify-center bg-muted/40 text-[10px] text-muted-foreground", className)} style={style}>
        {t("imageProcessing")}
      </span>
    );
  }

  if (status === "fallback") {
    return (
      <span
        role="img"
        aria-label={alt || t("imageBroken")}
        className={cn("flex cursor-pointer items-center justify-center bg-muted/40", className)}
        style={style}
        onClick={openOriginal}
      >
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <img
      src={shown}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      onClick={onClick}
      onError={() => {
        if (src.startsWith("blob:") || src.startsWith("data:")) {
          setStatus("fallback");
          return;
        }
        if (status === "ok") {
          setStatus("fallback");
          return;
        }
        setStatus("converting");
        displayableObjectUrl(src)
          .then((url) => {
            setShown(url);
            setStatus("ok");
          })
          .catch(() => setStatus("fallback"));
      }}
    />
  );
}
