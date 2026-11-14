import { useState, useEffect } from "react";
import { Copy, Check, Folder as FolderIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DuplicateGroup, Folder } from "@/types";

interface Props {
  open: boolean;
  folders: Folder[];
  scopeFolder?: Folder | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function DuplicatesReviewModal({ open, folders, scopeFolder, onClose, onRefresh }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);

  const loadDuplicates = async () => {
    try {
      const data = await api.getDuplicates(scopeFolder?.id || null);
      setGroups(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) {
      loadDuplicates();
    }
  }, [open, scopeFolder?.id]);

  const handleMergeGroup = async (group: DuplicateGroup, keepBookmarkId: string) => {
    const toRemove = group.bookmarks.filter((b) => b.id !== keepBookmarkId).map((b) => b.id);
    await api.mergeDuplicates(keepBookmarkId, toRemove);
    await loadDuplicates();
    onRefresh();
  };

  const handleMergeAll = async () => {
    for (const group of groups) {
      if (group.bookmarks.length > 0) {
        const keepId = group.bookmarks[0].id;
        const toRemove = group.bookmarks.slice(1).map((b) => b.id);
        await api.mergeDuplicates(keepId, toRemove);
      }
    }
    await loadDuplicates();
    onRefresh();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={scopeFolder ? `Duplicates in "${scopeFolder.title}"` : "Duplicate Bookmarks Review"}
    >
      <div className="space-y-4 py-1 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Found <strong className="text-amber-200">{groups.length}</strong> sets of duplicate URLs{" "}
              {scopeFolder ? (
                <>in <span className="font-semibold text-amber-100">"{scopeFolder.title}"</span>.</>
              ) : (
                "across your library."
              )}
            </span>
          </div>

          {groups.length > 0 && (
            <Button
              size="sm"
              onClick={handleMergeAll}
              className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
            >
              1-Click Merge All
            </Button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p>
              {scopeFolder
                ? `No duplicate URLs found in "${scopeFolder.title}".`
                : "Your library is 100% clean! No duplicate URLs found."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {groups.map((g, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px] text-foreground font-medium truncate max-w-md">
                    {g.clean_url}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {g.count} copies
                  </span>
                </div>

                <div className="space-y-1.5 pl-2 border-l-2 border-border/60">
                  {g.bookmarks.map((b, bIdx) => {
                    const folderTitle = folders.find((f) => f.id === b.folder_id)?.title || "Unorganized";
                    const isEarliest = bIdx === 0;

                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-[11px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate max-w-xs">{b.title}</span>
                          <span className="px-1.5 py-0.2 rounded bg-card text-muted-foreground text-[10px] flex items-center gap-1">
                            <FolderIcon className="w-2.5 h-2.5" />
                            {folderTitle}
                          </span>
                          {isEarliest && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold">
                              OLDEST (Recommended)
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMergeGroup(g, b.id)}
                          className="h-6 text-[10px] px-2 text-primary hover:bg-primary/20"
                        >
                          Keep This Copy
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
