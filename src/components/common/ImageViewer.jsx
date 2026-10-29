import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import SafeImage from "@/components/common/SafeImage";
import { motionScale } from "@/lib/motion";

// Ostatnio kliknięta miniatura: z niej obraz "wylatuje" do pełnego widoku (FLIP: translate + scale).
let lastThumb = null;
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (event) => {
    const img = event.target instanceof Element ? event.target.closest("img") : null;
    if (img) lastThumb = { rect: img.getBoundingClientRect(), at: performance.now() };
  }, true);
}

function flyFromThumb(target) {
  const thumb = lastThumb;
  lastThumb = null;
  const scale = motionScale();
  if (!thumb || !target || scale <= 0 || performance.now() - thumb.at > 1500) return;
  const run = () => {
    const end = target.getBoundingClientRect();
    if (!end.width || !end.height) return;
    const dx = thumb.rect.left + thumb.rect.width / 2 - (end.left + end.width / 2);
    const dy = thumb.rect.top + thumb.rect.height / 2 - (end.top + end.height / 2);
    const s = Math.max(0.05, thumb.rect.width / end.width);
    target.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.5 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 320 * scale, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  };
  const img = target.querySelector("img");
  if (img && !img.complete) img.addEventListener("load", run, { once: true });
  else requestAnimationFrame(run);
}

export default function ImageViewer({ open, onOpenChange, imageUrl }) {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const panStart = React.useRef({ x: 0, y: 0 });
  const flyRef = React.useCallback((node) => {
    if (node) flyFromThumb(node);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, [open, imageUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'receipt';
    link.click();
  };

  const clampZoom = (value) => Math.min(4, Math.max(0.5, value));

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setZoom(prev => clampZoom(prev + delta));
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = { ...pan };
  };

  const handleMouseMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Image Viewer</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <Button size="icon" variant="secondary" onClick={() => setZoom(z => clampZoom(z - 0.25))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => setZoom(z => clampZoom(z + 0.25))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <div
            className={`max-h-[95vh] h-[95vh] p-4 bg-ds-bg flex items-center justify-center select-none ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div ref={flyRef} className="flex max-h-full max-w-full items-center justify-center">
            <SafeImage
              src={imageUrl}
              alt="Receipt"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: dragging ? "none" : "transform 0.2s"
              }}
              className="max-w-full object-contain pointer-events-none"
            />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}