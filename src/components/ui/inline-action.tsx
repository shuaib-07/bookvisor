"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  type Transition,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, Pause, Play, Square } from "lucide-react";

export interface InlineActionProps {
  label: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction: () => Promise<void> | void;
  className?: string;
  /** Optional live scraper integration */
  isRunning?: boolean;
  isPaused?: boolean;
  completed?: number;
  total?: number;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export const InlineAction: React.FC<InlineActionProps> = ({
  label,
  icon,
  actionText = "Verify",
  onAction,
  className,
  isRunning,
  isPaused = false,
  completed = 0,
  total = 0,
  onPause,
  onResume,
  onStop,
}) => {
  const [internalStatus, setInternalStatus] = useState<"idle" | "loading" | "success">("idle");
  const wasRunningRef = useRef(false);

  // Synchronize controlled isRunning state with internal status
  useEffect(() => {
    if (isRunning !== undefined) {
      if (isRunning) {
        setInternalStatus("loading");
        wasRunningRef.current = true;
      } else if (wasRunningRef.current) {
        // Just transitioned from running to stopped -> show success briefly if completed items
        wasRunningRef.current = false;
        setInternalStatus("success");
      }
    }
  }, [isRunning]);

  const status = isRunning !== undefined
    ? isRunning
      ? "loading"
      : internalStatus === "success"
      ? "success"
      : "idle"
    : internalStatus;

  const handleTrigger = async () => {
    if (status !== "idle") return;
    setInternalStatus("loading");
    try {
      await onAction();
      if (isRunning === undefined) {
        setInternalStatus("success");
      }
    } catch {
      setInternalStatus("idle");
    }
  };

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        setInternalStatus("idle");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const springTransition: Transition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  };

  const progressPct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div
      className={cn(
        "h-8 inline-flex items-center justify-between gap-2.5 pl-2.5 pr-0 overflow-hidden rounded-lg border border-white/[0.08] bg-card/60 backdrop-blur-md shadow-2xs select-none transition-colors",
        className
      )}
    >
      {/* Left Icon and Label */}
      <div className="flex min-w-0 items-center gap-1.5 shrink-0">
        {icon && (
          <div className="flex shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary p-1 w-5 h-5">
            <div className="scale-90">{icon}</div>
          </div>
        )}
        <span className="truncate text-xs font-medium text-foreground tracking-tight">
          {label}
        </span>
      </div>

      {/* Right Morphing Action Element */}
      <MotionConfig transition={springTransition}>
        <motion.div
          className={cn(
            "relative flex h-full items-center overflow-hidden transition-colors",
            status === "idle"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : status === "loading"
              ? "border-l border-white/[0.08] bg-white/[0.06] text-foreground px-2"
              : "border-l border-emerald-500/40 bg-emerald-500/20 text-emerald-400 px-2"
          )}
          animate={{
            width:
              status === "success"
                ? 36
                : status === "loading"
                ? 136
                : "auto",
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {status === "idle" && (
              <motion.button
                key="idle"
                type="button"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(3px)" }}
                onClick={handleTrigger}
                className="h-full px-3 text-[11px] font-semibold whitespace-nowrap text-primary-foreground cursor-pointer flex items-center justify-center transition-colors"
              >
                {actionText}
              </motion.button>
            )}

            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(3px)" }}
                className="w-full flex items-center justify-between gap-1.5"
              >
                {/* Progress bar and counter */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono leading-none text-muted-foreground">
                    <span className="truncate">
                      {total > 0 ? `${completed}/${total}` : "Verifying"}
                    </span>
                    {total > 0 && <span>{progressPct}%</span>}
                  </div>
                  <div className="relative h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    {total > 0 ? (
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                      />
                    ) : (
                      <motion.div
                        className="absolute top-0 bottom-0 w-[40%] rounded-full bg-primary"
                        initial={{ left: "0%" }}
                        animate={{ left: "60%" }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Pause/Resume & Stop Controls */}
                <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-white/[0.08]">
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResume?.();
                      }}
                      className="p-0.5 rounded hover:bg-white/15 text-primary cursor-pointer transition-colors"
                      title="Resume Verification"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPause?.();
                      }}
                      className="p-0.5 rounded hover:bg-white/15 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Pause Verification"
                    >
                      <Pause className="w-2.5 h-2.5 fill-current" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop?.();
                      setInternalStatus("idle");
                    }}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                    title="Stop Verification"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                  </button>
                </div>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ filter: "blur(3px)", opacity: 0 }}
                animate={{ filter: "blur(0px)", opacity: 1 }}
                exit={{ filter: "blur(3px)", opacity: 0 }}
                className="relative flex h-full w-full items-center justify-center overflow-hidden"
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                  className="absolute inset-0 z-10 h-full w-full skew-x-[-30deg] bg-linear-to-r from-transparent via-white/40 to-transparent"
                />
                <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </MotionConfig>
    </div>
  );
};

export default InlineAction;

