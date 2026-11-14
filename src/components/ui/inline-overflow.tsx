"use client";

import { useState, type FC, type ComponentType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineOverflowAction {
  id?: string;
  label?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  active?: boolean;
  title?: string;
  onClick?: () => void;
}

export interface InlineOverflowProps {
  visibleActions: InlineOverflowAction[];
  hiddenActions: InlineOverflowAction[];
  className?: string;
  actionClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ActionItem: FC<{
  action: InlineOverflowAction;
  className?: string;
}> = ({ action, className }) => {
  const Icon = action.icon;
  return (
    <motion.button
      type="button"
      layout="position"
      initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
      onClick={action.onClick}
      title={action.title}
      className={cn(
        "h-full shrink-0 cursor-pointer rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 select-none",
        action.active
          ? "bg-primary/20 text-primary border border-primary/30 font-semibold shadow-2xs"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06] border border-transparent",
        className
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {action.label && <span>{action.label}</span>}
    </motion.button>
  );
};

export const InlineOverflow: FC<InlineOverflowProps> = ({
  visibleActions,
  hiddenActions,
  className,
  actionClassName,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggleOpen = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <motion.div
      layout
      className={cn(
        "h-8 relative flex items-center gap-0.5 overflow-hidden rounded-lg border border-white/[0.08] bg-card/60 p-0.5 backdrop-blur-md shadow-2xs select-none",
        className
      )}
      transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
    >
      {visibleActions.map((action, i) => (
        <ActionItem
          key={action.id || i}
          action={action}
          className={actionClassName}
        />
      ))}

      <AnimatePresence mode="popLayout" initial={false}>
        {open &&
          hiddenActions.map((action, i) => (
            <motion.div
              key={action.id || i}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
            >
              <ActionItem action={action} className={actionClassName} />
            </motion.div>
          ))}
      </AnimatePresence>

      <motion.button
        type="button"
        layout
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        title={open ? "Close layout options" : "More layout options"}
        className={cn(
          "flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent transition-colors",
          open
            ? "bg-white/[0.08] text-foreground hover:bg-white/[0.12]"
            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
        )}
        transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {open ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, scale: 0.7, filter: "blur(3px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.7, filter: "blur(3px)" }}
              transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
            >
              <X className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <motion.div
              key="dots"
              initial={{ opacity: 0, scale: 0.7, filter: "blur(3px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.7, filter: "blur(3px)" }}
              transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
};

