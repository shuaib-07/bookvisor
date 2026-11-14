import { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_PANEL } from "@/lib/ease";
import { api } from "@/lib/api";
import { openExternalUrl } from "@/lib/updater";
import { cn } from "@/lib/utils";
import type { ReminderItem } from "@/types";

interface Props {
  onOpenBookmark?: (bookmarkId: string) => void;
  className?: string;
}

// Subtle elegant audio chime using Web Audio API
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First note: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second note: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.error("Audio chime error:", err);
  }
}

export function NotificationCenter({ onOpenBookmark, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Request native OS notification permission on first load
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const checkReminders = async () => {
    try {
      const due = await api.getDueReminders();
      setReminders(due);

      // Check if there are newly due reminders to trigger audio and native notification
      let hasNew = false;
      for (const item of due) {
        if (!notifiedIdsRef.current.has(item.id)) {
          notifiedIdsRef.current.add(item.id);
          hasNew = true;

          // Trigger native Windows OS Desktop Notification
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(`BookVisor Reminder: ${item.title}`, {
                body: `Click to review this bookmarked link`,
                icon: "/bookmarked.png",
              });
            } catch {
              // Ignore notification error
            }
          }
        }
      }

      if (hasNew) {
        playChime();
      }
    } catch (err) {
      console.error("Failed to check reminders:", err);
    }
  };

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.dismissReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to dismiss reminder:", err);
    }
  };

  const handleOpen = (item: ReminderItem) => {
    if (onOpenBookmark) {
      onOpenBookmark(item.bookmark_id);
    } else {
      openExternalUrl(item.url);
    }
    handleDismiss(item.id);
    setOpen(false);
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Notifications & Reminders"
        className={cn(
          "relative size-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground transition-colors cursor-pointer",
          open && "border-primary/50 text-foreground bg-primary/10"
        )}
      >
        <Bell className="w-4 h-4" />
        {reminders.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm animate-pulse">
            {reminders.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={SPRING_PANEL}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-white/[0.1] bg-[#141416]/95 backdrop-blur-xl p-3 shadow-2xl space-y-2 text-foreground"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span>Due Reminders</span>
                </div>
                {reminders.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                    {reminders.length} due
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {reminders.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Clock className="w-7 h-7 mx-auto opacity-20 mb-1.5" />
                    <p className="text-xs font-medium">No pending reminders</p>
                    <p className="text-[11px] text-muted-foreground/60">
                      Set reminders on bookmarks to get notified
                    </p>
                  </div>
                ) : (
                  reminders.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpen(item)}
                      className="p-2.5 rounded-xl border border-white/[0.06] bg-card/40 hover:bg-card hover:border-white/[0.12] transition-all cursor-pointer group space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDismiss(item.id, e)}
                          title="Dismiss"
                          className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Due {new Date(item.due_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] font-mono">{item.url}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
