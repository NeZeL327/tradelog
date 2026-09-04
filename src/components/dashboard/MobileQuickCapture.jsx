import { useRef } from "react";
import { Camera } from "lucide-react";

export default function MobileQuickCapture({ onCapture }) {
  const inputRef = useRef(null);

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
    }
  };

  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="fixed bottom-6 right-6 z-50 md:hidden w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center active:scale-95 transition-transform"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
      <Camera className="w-7 h-7 text-white" />
    </button>
  );
}