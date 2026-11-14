import { useState, useEffect } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { StagedSyncMutation, BrowserAccount } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/animated-toast-stack";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: BrowserAccount[];
  onSyncComplete: () => void;
}

export function StagedSyncReviewDrawer({
  isOpen,
  onClose,
  accounts,
  onSyncComplete,
}: Props) {
  const { toast } = useToast();
  const [mutations, setMutations] = useState<StagedSyncMutation[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadMutations = async () => {
    setLoading(true);
    try {
      const list = await api.getStagedMutations();
      setMutations(list);
    } catch (err) {
      console.error("Failed to load staged mutations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMutations();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      // Find unique account IDs affected
      const uniqueAccountIds = Array.from(new Set(mutations.map((m) => m.account_id)));
      let totalSynced = 0;

      for (const accId of uniqueAccountIds) {
        try {
          const res = await api.syncAccountToBrowser(accId);
          totalSynced += res.synced_count;
        } catch (err) {
          console.error(`Failed to sync account ${accId}:`, err);
        }
      }

      await api.clearStagedMutations();
      toast({
        status: "success",
        title: "Browser Sync Applied",
        description: `Successfully applied staged mutations and updated browser bookmarks. Automated .bak safety backups created.`,
      });

      onSyncComplete();
      onClose();
    } catch (err: any) {
      toast({
        status: "error",
        title: "Sync Error",
        description: typeof err === "string" ? err : err?.message || "Failed to apply changes",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleDiscardAll = async () => {
    if (confirm("Are you sure you want to discard all staged browser changes?")) {
      await api.clearStagedMutations();
      setMutations([]);
      onSyncComplete();
      onClose();
    }
  };

  return (
    <div className="w-96 h-full flex flex-col shrink-0 overflow-hidden bg-card/80 backdrop-blur-xl border-l border-white/[0.06] shadow-2xl z-20 select-text">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Staged Browser Review</h3>
            <span className="text-[10px] text-muted-foreground">
              {mutations.length} pending mutation{mutations.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Safety Notice */}
      <div className="p-3 bg-amber-500/5 border-b border-amber-500/15 text-[11px] text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          Automated timestamped <code>.bak</code> backups are created before writing to browser
          profile files.
        </span>
      </div>

      {/* Mutations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span className="text-xs">Loading staged changes...</span>
          </div>
        ) : mutations.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <p className="text-xs font-medium text-foreground">All Browsers in Sync</p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              No pending staged mutations. All bookmark transfers and moves have been written to your
              browser accounts.
            </p>
          </div>
        ) : (
          mutations.map((m) => {
            const acc = accounts.find((a) => a.id === m.account_id);
            return (
              <div
                key={m.id}
                className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded font-mono font-medium",
                      m.action_type === "ADD" && "bg-emerald-500/15 text-emerald-400",
                      m.action_type === "REMOVE" && "bg-rose-500/15 text-rose-400",
                      m.action_type === "MOVE" && "bg-cyan-500/15 text-cyan-400",
                      m.action_type === "UPDATE" && "bg-amber-500/15 text-amber-400"
                    )}
                  >
                    {m.action_type}
                  </span>

                  <span className="flex items-center gap-1 font-medium text-muted-foreground">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: acc?.color_dot || "#3b82f6" }}
                    />
                    <span>{m.account_name || acc?.display_name || "Browser Profile"}</span>
                  </span>
                </div>

                <div className="text-xs font-medium text-foreground truncate">
                  {m.bookmark_title || "Untitled Bookmark"}
                </div>

                {m.bookmark_url && (
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {m.bookmark_url}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      {mutations.length > 0 && (
        <div className="p-3 border-t border-white/[0.06] bg-background/50 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDiscardAll}
            disabled={applying}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            <span>Discard All</span>
          </Button>

          <Button
            size="sm"
            onClick={handleApplyAll}
            disabled={applying}
            className="h-8 text-xs px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer font-medium"
          >
            {applying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{applying ? "Applying..." : "Apply All to Browsers"}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
