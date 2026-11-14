import { EyeOff, ShieldAlert, FolderIcon, Globe } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface HideConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "bookmark" | "folder";
  title: string;
  subtitle?: string;
  bookmarkCount?: number;
  onConfirm: () => Promise<void> | void;
}

export function HideConfirmationModal({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
  bookmarkCount = 0,
  onConfirm,
}: HideConfirmationModalProps) {
  const isFolder = type === "folder";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFolder ? "Hide Folder" : "Hide Bookmark"}
      icon={<EyeOff className="w-4 h-4 text-amber-400" />}
      description={
        isFolder
          ? "Hide this folder and its contents from searches, AI indexing, and verification"
          : "Hide this bookmark from searches, AI indexing, and verification"
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-4 py-1 text-xs select-none">
        {/* Item Preview Card */}
        <div className="p-3 rounded-xl bg-card/60 border border-white/[0.08] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            {isFolder ? <FolderIcon className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground text-xs truncate" title={title}>
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-muted-foreground truncate mt-0.5" title={subtitle}>
                {subtitle}
              </div>
            )}
            {isFolder && bookmarkCount > 0 && (
              <div className="text-[10px] text-amber-400/80 mt-0.5">
                Contains {bookmarkCount} bookmark{bookmarkCount === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        {/* Privacy & Exclusion Rules Warning */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 space-y-2">
          <div className="font-medium text-amber-300 flex items-center gap-1.5 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Privacy & Exclusion Rules</span>
          </div>

          <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-4 leading-relaxed">
            {isFolder && (
              <li>
                <strong className="text-foreground">Cascades to Contents:</strong> All subfolders and bookmarks inside this folder hierarchy will be hidden as well.
              </li>
            )}
            <li>
              <strong className="text-foreground">Excluded from Search:</strong> Hidden {isFolder ? "folders and bookmarks inside" : "bookmarks"} will never appear in regular search results or filters.
            </li>
            <li>
              <strong className="text-foreground">Excluded from AI:</strong> AI Assistant semantic searches and interactive chats will completely ignore and not cite this content.
            </li>
            <li>
              <strong className="text-foreground">Excluded from Scraping:</strong> Automatic link verification, health checks, and metadata scrapers will skip this {isFolder ? "folder" : "bookmark"}.
            </li>
            <li>
              <strong className="text-foreground">Greyed Out when Revealed:</strong> Will be hidden completely by default, and only visible (greyed out) when you enable "Show Hidden Items" in the toolbar.
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className="gap-1.5 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold cursor-pointer shadow-md"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{isFolder ? "Hide Folder" : "Hide Bookmark"}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
