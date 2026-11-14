import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface SplitDividerProps {
  direction?: "horizontal" | "vertical";
  className?: string;
  onResize?: (delta: number) => void;
}

export const SplitDivider: React.FC<SplitDividerProps> = ({
  direction = "vertical",
  className,
  onResize,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    const startPos = direction === "vertical" ? e.clientX : e.clientY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentPos = direction === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      onResize?.(delta);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={cn(
        "relative select-none transition-colors group",
        direction === "vertical"
          ? "w-1 cursor-col-resize hover:bg-primary/40"
          : "h-1 cursor-row-resize hover:bg-primary/40",
        isDragging && "bg-primary",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-transparent group-hover:bg-primary/20",
          isDragging && "bg-primary/40"
        )}
      />
    </div>
  );
};
