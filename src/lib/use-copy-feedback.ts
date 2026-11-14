import { useState, useCallback, useRef, useEffect } from "react";

export type CopyFeedbackState = "idle" | "copied" | "error";

export function useCopyFeedback(timeout = 1800) {
  const [state, setState] = useState<CopyFeedbackState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (value: string): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = value;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (!ok) throw new Error("Copy command failed");
        }
        setState("copied");
        timerRef.current = setTimeout(() => {
          setState("idle");
        }, timeout);
        return true;
      } catch (err) {
        console.error("Failed to copy:", err);
        setState("error");
        timerRef.current = setTimeout(() => {
          setState("idle");
        }, timeout);
        return false;
      }
    },
    [timeout]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { state, copy };
}

