import { useState, useEffect } from "react";
import { X, AlertTriangle, Trash2, RotateCcw, ShieldAlert, FolderX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import type { LibraryStats } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stats?: {
    total_bookmarks: number;
    folder_count: number;
  } | null;
}

export function ResetLibraryModal({ open, onClose, onSuccess, stats: propStats }: Props) {
  const [resetType, setResetType] = useState<"full_reset" | "folders_only" | "bookmarks_only">("full_reset");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<LibraryStats | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setError(null);
      api.getLibraryStats()
        .then(setLiveStats)
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const currentStats = liveStats || propStats;

  const handleReset = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError(null);

    try {
      if (resetType === "full_reset") {
        await api.resetLibrary();
      } else if (resetType === "folders_only") {
        await api.deleteAllFolders();
      } else {
        await api.deleteAllBookmarks();
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to reset library");
    } finally {
      setLoading(false);
    }
  };

  const handleCleanEmptyFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteEmptyFolders();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to clean empty folders");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-950/92 backdrop-blur-3xl border border-white/[0.09] shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col t-modal is-open">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Reset & Clean Library</h2>
              <p className="text-[11px] text-muted-foreground">Irreversible database cleanup and wipe actions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Current Library:{" "}
              <span className="text-foreground font-semibold">
                {currentStats?.total_bookmarks.toLocaleString() ?? 0} bookmarks
              </span>{" "}
              across{" "}
              <span className="text-foreground font-semibold">
                {currentStats?.folder_count ?? 0} folders
              </span>
              .
            </div>

            {(currentStats?.folder_count ?? 0) > 0 && (currentStats?.total_bookmarks ?? 0) === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanEmptyFolders}
                disabled={loading}
                className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Clean All {currentStats?.folder_count} Empty Folders</span>
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {/* Option 1: Factory Reset Everything (Default) */}
            <div
              onClick={() => setResetType("full_reset")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                resetType === "full_reset"
                  ? "bg-red-500/15 border-red-500/50 text-foreground ring-1 ring-red-500/30"
                  : "bg-card/40 border-border/60 hover:bg-card/70 text-muted-foreground"
              }`}
            >
              <RotateCcw className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Factory Reset Everything (Bookmarks + Folders)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Completely wipes all {currentStats?.total_bookmarks ?? 0} bookmarks AND all {currentStats?.folder_count ?? 0} folders, tags, AI vector embeddings, and sync queues. Returns BookVisor to 100% clean slate.
                </p>
              </div>
            </div>

            {/* Option 2: Delete All Folders Only */}
            <div
              onClick={() => setResetType("folders_only")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                resetType === "folders_only"
                  ? "bg-amber-500/15 border-amber-500/50 text-foreground ring-1 ring-amber-500/30"
                  : "bg-card/40 border-border/60 hover:bg-card/70 text-muted-foreground"
              }`}
            >
              <FolderX className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Delete All Folders Only (Keep Bookmarks in Inbox)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Wipes all {currentStats?.folder_count ?? 0} folders (including browser imports like Bookmarks Menu/Toolbar). Any remaining bookmarks move to Unorganized / Inbox.
                </p>
              </div>
            </div>

            {/* Option 3: Delete All Bookmarks Only */}
            <div
              onClick={() => setResetType("bookmarks_only")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                resetType === "bookmarks_only"
                  ? "bg-primary/15 border-primary/50 text-foreground ring-1 ring-primary/30"
                  : "bg-card/40 border-border/60 hover:bg-card/70 text-muted-foreground"
              }`}
            >
              <Trash2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Delete All Bookmarks Only (Preserve Folder Tree)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Wipes all URLs and scraped cache, but keeps your existing folder categories intact.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Checkbox
              checked={confirmed}
              onCheckedChange={setConfirmed}
              label={
                <span className="text-xs text-muted-foreground">
                  I understand this action is <strong className="text-red-400">permanent</strong> and cannot be undone
                </span>
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-secondary/30 border-t border-border/40 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8">
            Cancel
          </Button>

          <Button
            variant="destructive"
            size="sm"
            disabled={!confirmed || loading}
            onClick={handleReset}
            className="text-xs h-8 px-4 gap-1.5 shadow-sm"
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>
                  {resetType === "full_reset"
                    ? "Reset Everything"
                    : resetType === "folders_only"
                    ? "Delete All Folders"
                    : "Delete All Bookmarks"}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
export default ResetLibraryModal;