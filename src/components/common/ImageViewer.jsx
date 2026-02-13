import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut } from "lucide-react";

export default function ImageViewer({ open, onOpenChange, imageUrl }) {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const panStart = React.useRef({ x: 0, y: 0 });

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
            className={`max-h-[95vh] h-[95vh] p-4 bg-slate-900 flex items-center justify-center select-none ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
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
      </DialogContent>
    </Dialog>
  );
}