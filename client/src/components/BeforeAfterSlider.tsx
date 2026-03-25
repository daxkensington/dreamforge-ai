import { useState, useRef, useCallback } from "react";

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  height?: number;
  accentColor?: string;
}

export default function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Original",
  afterLabel = "Enhanced",
  height = 400,
  accentColor = "amber",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setPosition((x / rect.width) * 100);
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  };

  const accentColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    amber: { bg: "bg-cyan-500", border: "border-cyan-500", text: "text-cyan-400", glow: "shadow-cyan-500/50" },
    blue: { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-400", glow: "shadow-blue-500/50" },
    green: { bg: "bg-green-500", border: "border-green-500", text: "text-green-400", glow: "shadow-green-500/50" },
    purple: { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-400", glow: "shadow-purple-500/50" },
    rose: { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-400", glow: "shadow-rose-500/50" },
  };

  const colors = accentColors[accentColor] || accentColors.amber;

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl cursor-col-resize"
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* After image (full) */}
      <img
        src={after}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          style={{ width: containerRef.current?.offsetWidth || "100%", maxWidth: "none" }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className={`absolute top-0 bottom-0 w-0.5 ${colors.bg} z-10`}
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        {/* Handle */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full ${colors.bg} shadow-lg ${colors.glow} flex items-center justify-center`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
            <path d="M5 3L2 8L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 3L14 8L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-20">
        <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-black/70 text-white/80 backdrop-blur-sm">
          {beforeLabel}
        </span>
      </div>
      <div className="absolute top-3 right-3 z-20">
        <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full bg-black/70 ${colors.text} backdrop-blur-sm`}>
          {afterLabel}
        </span>
      </div>
    </div>
  );
}
