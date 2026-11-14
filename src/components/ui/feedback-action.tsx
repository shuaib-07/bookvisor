"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { AlertOctagon, Check, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackActionProps {
  status?: "error" | "loading" | "idle" | "success";
  errorMessage?: string;
  loadingMessage?: string;
  successMessage?: string;
  idleMessage?: string;
  size?: "sm" | "md" | "lg";
  onRetry?: () => void | Promise<void>;
  className?: string;
  autoTimeout?: boolean;
}

export const FeedbackAction: React.FC<FeedbackActionProps> = ({
  status: controlledStatus,
  errorMessage = "Sync Failed",
  loadingMessage = "Syncing",
  successMessage = "Synced",
  idleMessage = "Sync Browser",
  size = "sm",
  onRetry,
  className,
  autoTimeout = false,
}) => {
  const [internalStatus, setInternalStatus] = useState<
    "error" | "loading" | "idle" | "success"
  >(controlledStatus || "idle");

  const status = controlledStatus !== undefined ? controlledStatus : internalStatus;

  const handleRetry = async () => {
    if (controlledStatus === undefined) {
      setInternalStatus("loading");
    }
    if (onRetry) {
      try {
        await onRetry();
        if (controlledStatus === undefined) {
          setInternalStatus("success");
          setTimeout(() => setInternalStatus("idle"), 2500);
        }
      } catch {
        if (controlledStatus === undefined) {
          setInternalStatus("error");
        }
      }
    }
  };

  useEffect(() => {
    if (autoTimeout && status === "loading" && controlledStatus === undefined) {
      const timer = setTimeout(() => {
        setInternalStatus("error");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [status, autoTimeout, controlledStatus]);

  const isSmall = size === "sm";
  const isMedium = size === "md";

  const heightClass = isSmall ? "h-8" : isMedium ? "h-10" : "h-14";
  const paddingClass = isSmall
    ? "px-3"
    : isMedium
    ? "px-4 py-2"
    : "px-6 py-4";
  const textClass = isSmall
    ? "text-xs font-medium"
    : isMedium
    ? "text-sm font-semibold"
    : "text-lg font-bold";
  const iconSize = isSmall ? 14 : isMedium ? 18 : 24;
  const buttonSizeClass = isSmall ? "h-8 w-8" : isMedium ? "h-10 w-10" : "h-14 w-14";

  return (
    <div className={cn("inline-flex items-center", heightClass, className)}>
      <MotionConfig transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}>
        <motion.div
          animate={{ width: "auto" }}
          layout
          initial={false}
          onClick={status === "idle" || status === "error" ? handleRetry : undefined}
          className={cn(
            "relative z-20 flex items-center justify-center overflow-hidden border transition-colors select-none shadow-xs",
            heightClass,
            paddingClass,
            isSmall ? "rounded-lg" : "rounded-xl",
            status === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/15"
              : status === "loading"
              ? "border-primary/40 bg-primary/10 text-primary"
              : status === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-white/[0.08] bg-card/60 backdrop-blur-md text-foreground hover:bg-secondary/80 hover:border-white/[0.15]"
          )}
        >
          <motion.div
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="flex items-center gap-2"
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                key={status}
                initial={{ opacity: 0, scale: 0.25, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.25, filter: "blur(2px)" }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              >
                {status === "error" ? (
                  <AlertOctagon size={iconSize} className="text-red-500 shrink-0" />
                ) : status === "loading" ? (
                  <Loader2 size={iconSize} className="animate-spin text-primary shrink-0" />
                ) : status === "success" ? (
                  <Check size={iconSize} className="text-emerald-400 shrink-0" />
                ) : (
                  <RotateCw size={iconSize} className="text-cyan-400 shrink-0" />
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatedText
              text={
                status === "error"
                  ? errorMessage
                  : status === "loading"
                  ? loadingMessage
                  : status === "success"
                  ? successMessage
                  : idleMessage
              }
              className={cn(
                textClass,
                status === "error"
                  ? "text-red-500"
                  : status === "loading"
                  ? "text-primary"
                  : status === "success"
                  ? "text-emerald-400"
                  : "text-foreground"
              )}
            />
          </motion.div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {status === "error" && onRetry && (
            <motion.button
              type="button"
              initial={{
                opacity: 0,
                x: -30,
                filter: "blur(4px)",
                scale: 0.8,
              }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 1, x: -30, filter: "blur(4px)", scale: 0.8 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleRetry}
              className={cn(
                "z-10 flex shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 shadow-sm cursor-pointer transition-colors",
                buttonSizeClass
              )}
              title="Retry sync"
            >
              <RotateCw size={iconSize} />
            </motion.button>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
};

export function AnimatedText({
  text,
  className,
  delayStep = 0.014,
}: {
  text: string;
  className?: string;
  delayStep?: number;
}) {
  const chars = text.split("");

  return (
    <span style={{ display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          layout
          key={text}
          style={{ display: "inline-flex", willChange: "transform" }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{ y: 8, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ y: -8, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 16,
                mass: 1.2,
                delay: i * delayStep,
              }}
              style={{
                display: "inline-block",
                whiteSpace: char === " " ? "pre" : undefined,
              }}
              className={className}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default FeedbackAction;
