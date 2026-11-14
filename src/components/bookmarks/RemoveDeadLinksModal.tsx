import { useState, useEffect, useMemo } from "react";
import {
  Link2Off,
  Trash2,
  ExternalLink,
  Globe,
  AlertTriangle,
  History,
  Folder as FolderIcon,
  RefreshCw,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { useToast } from "@/components/ui/animated-toast-stack";
import { api } from "@/lib/api";
import { openExternalUrl } from "@/lib/updater";
import type { Bookmark, Folder } from "@/types";

interface Props {
  open: boolean;
  scopeFolder?: Folder | null;
  folders: Folder[];
  onClose: () => void;
  onSuccess: (deletedCount: number) => void;
}

export function RemoveDeadLinksModal({
  open,
  scopeFolder,
  folders,
  onClose,
  onSuccess,
}: Props) {
  const [deadLinks, setDeadLinks] = useState<Bookmark[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const folderNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) {
      map.set(f.id, f.title);
    }
    return map;
  }, [folders]);

  const loadDeadLinks = async () => {
    setLoading(true);
    try {
      const data = await api.getDeadLinks(scopeFolder?.id || null);
      setDeadLinks(data);
      // Select all by default
      setSelectedIds(new Set(data.map((b) => b.id)));
    } catch (err) {
      console.error("Failed to load dead links:", err);
      toast({
        status: "error",
        title: "Failed to Load Dead Links",
        description: String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDeadLinks();
    }
  }, [open, scopeFolder?.id]);

  const allSelected = deadLinks.length > 0 && selectedIds.size === deadLinks.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < deadLinks.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deadLinks.map((b) => b.id)));
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsDeleting(true);
      const count = await api.deleteBookmarksBatch(Array.from(selectedIds));
      toast({
        status: "success",
        title: "Dead Links Purged",
        description: `Successfully removed ${count} dead link${count === 1 ? "" : "s"}.`,
      });
      onSuccess(count);
      onClose();
    } catch (err) {
      toast({
        status: "error",
        title: "Failed to Remove Dead Links",
        description: String(err),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Link2Off className="w-5 h-5 text-red-400 shrink-0" />
          <span>
            {scopeFolder ? `Remove Dead Links in "${scopeFolder.title}"` : "Remove Dead Links"}
          </span>
        </div>
      }
      description={
        scopeFolder
          ? `Review broken and unreachable links found inside "${scopeFolder.title}" and its subfolders before deleting.`
          : "Review broken and unreachable links across your entire library before deleting."
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1 text-xs select-none">
        {/* Banner */}
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span>
              Found <strong className="text-red-200">{deadLinks.length}</strong> unreachable or broken link
              {deadLinks.length === 1 ? "" : "s"} (404/410/connection timeouts).
            </span>
            <p className="text-[11px] text-red-300/80 mt-0.5">
              Removed links are safely archived and synced across all your connected browsers.
            </p>
          </div>
        </div>

        {/* Select All Row */}
        {deadLinks.length > 0 && (
          <div className="flex items-center justify-between px-1 text-xs">
            <Checkbox
              checked={allSelected}
              indeterminate={isIndeterminate}
              onCheckedChange={handleToggleSelectAll}
              label={
                <span className="text-xs font-medium text-foreground cursor-pointer">
                  Select All ({selectedIds.size} of {deadLinks.length} selected)
                </span>
              }
            />

            <span className="text-[11px] text-muted-foreground font-mono">
              {selectedIds.size} selected
            </span>
          </div>
        )}

        {/* List of dead links */}
        <div className="max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-card/40 divide-y divide-border/40 p-1">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Scanning dead links...</span>
            </div>
          ) : deadLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground p-4">
              <Link2Off className="w-8 h-8 stroke-[1.5] text-muted-foreground/40 mb-1" />
              <p className="font-medium text-foreground">No dead links found</p>
              <p className="text-[11px] text-muted-foreground/70">
                All checked links in this scope are alive or verified.
              </p>
            </div>
          ) : (
            deadLinks.map((b) => {
              const isChecked = selectedIds.has(b.id);
              const folderTitle = folderNameMap.get(b.folder_id || "") || "Unorganized";

              return (
                <div
                  key={b.id}
                  onClick={() => handleToggleOne(b.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer ${
                    isChecked
                      ? "bg-red-500/5 hover:bg-red-500/10"
                      : "hover:bg-card/70 opacity-60"
                  }`}
                >
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleOne(b.id)}
                    />
                  </div>

                  {/* Favicon */}
                  <div className="w-6 h-6 rounded-md bg-card border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {b.favicon_url ? (
                      <img
                        src={b.favicon_url}
                        alt=""
                        className="w-3.5 h-3.5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Globe className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>

                  {/* Title & URL */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground text-xs truncate">
                      {b.title || b.domain}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {b.clean_url}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <AnimatedBadge status="danger" size="xs">
                      {b.http_code ? `${b.http_code} ` : ""}
                      {b.link_status}
                    </AnimatedBadge>

                    <span className="px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground text-[10px] font-medium flex items-center gap-1 max-w-[110px] truncate">
                      <FolderIcon className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{folderTitle}</span>
                    </span>

                    {/* Quick test / open in browser */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExternalUrl(b.url);
                      }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Open link in browser"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    {b.wayback_url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openExternalUrl(b.wayback_url!);
                        }}
                        className="p-1 rounded hover:bg-primary/20 text-primary cursor-pointer"
                        title="Open Wayback archive snapshot"
                      >
                        <History className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="cursor-pointer text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0 || isDeleting}
            onClick={handleConfirmDelete}
            className="gap-1.5 text-xs px-3 shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isDeleting
                ? "Removing..."
                : `Remove ${selectedIds.size} Dead Link${selectedIds.size === 1 ? "" : "s"}`}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

