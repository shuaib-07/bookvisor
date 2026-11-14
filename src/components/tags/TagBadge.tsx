import React from "react";
import * as Icons from "lucide-react";
import { Tag as DefaultTagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  color?: string | null;
  icon?: string | null;
  count?: number;
  onRemove?: () => void;
  onClick?: () => void;
  onIconClick?: () => void;
  className?: string;
  selected?: boolean;
}

export function TagBadge({
  name,
  color,
  icon,
  count,
  onRemove,
  onClick,
  onIconClick,
  className,
  selected = false,
}: Props) {
  // Dynamically resolve Lucide Icon if specified
  const IconComponent = icon
    ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] || null
    : null;

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border transition-all select-none",
        selected
          ? "border-primary/50 bg-primary/20 text-primary shadow-sm"
          : "border-white/[0.08] bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground",
        onClick && "cursor-pointer",
        className
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          if (onIconClick) {
            e.stopPropagation();
            onIconClick();
          }
        }}
        title={onIconClick ? `Click icon to edit '${name}' tag appearance` : undefined}
        className={cn(
          "shrink-0 flex items-center justify-center rounded-xs transition-all",
          onIconClick && "cursor-pointer hover:scale-130 hover:opacity-100 hover:text-primary active:scale-95 p-0.5 -m-0.5 rounded"
        )}
      >
        {IconComponent ? (
          <IconComponent className="w-3 h-3 text-primary" />
        ) : icon ? (
          <span className="text-[12px] leading-none inline-flex items-center justify-center select-none">
            {icon}
          </span>
        ) : color ? (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : (
          <DefaultTagIcon className="w-2.5 h-2.5 opacity-60 hover:opacity-100 transition-opacity" />
        )}
      </button>

      <span className="truncate max-w-[120px]">{name}</span>

      {count !== undefined && count !== null && (
        <span className="text-[10px] opacity-60 font-mono">({count})</span>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded-sm hover:bg-white/20 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Icons.X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
