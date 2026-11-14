import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  bookmarkCount?: number;
  onConfirm: () => Promise<void> | void;
}

export function DeleteFolderModal({
  isOpen,
  onClose,
  folderName,
  bookmarkCount = 0,
  onConfirm,
}: DeleteFolderModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Folder">
      <div className="space-y-4 py-2 text-xs">
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Delete "{folderName}"?</div>
            <p className="mt-1 text-destructive/80 leading-relaxed">
              {bookmarkCount > 0
                ? `This folder contains ${bookmarkCount} bookmarks. The folder will be removed, and its bookmarks will be safely moved to Unorganized/Inbox without losing any data.`
                : "Are you sure you want to delete this folder?"}
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className="gap-1.5 h-8 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Folder</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
