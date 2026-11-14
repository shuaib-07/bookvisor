import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AnimatedCombobox } from "@/components/ui/combobox";
import { Folder as FolderIcon, Inbox, Link2, Type, Tag as TagIcon } from "lucide-react";
import { FieldHeader } from "@/components/ui/field-header";
import type { Bookmark, Folder } from "@/types";

interface Props {
  open: boolean;
  folders: Folder[];
  initialFolderId?: string | null;
  bookmarkToEdit?: Bookmark | null;
  onClose: () => void;
  onSave: (data: { title: string; url: string; folderId: string | null; tags: string[] }) => void;
}

export function BookmarkModal({
  open,
  folders,
  initialFolderId,
  bookmarkToEdit,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId || null);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (open) {
      if (bookmarkToEdit) {
        setTitle(bookmarkToEdit.title);
        setUrl(bookmarkToEdit.url);
        setFolderId(bookmarkToEdit.folder_id);
        setTagInput(bookmarkToEdit.tags.join(", "));
      } else {
        setTitle("");
        setUrl("");
        setFolderId(initialFolderId || null);
        setTagInput("");
      }
    }
  }, [open, bookmarkToEdit, initialFolderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const tags = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0);

    onSave({
      title: title.trim() || url.trim(),
      url: url.trim(),
      folderId,
      tags,
    });
    onClose();
  };

  const hierarchicalFolders = useMemo(() => {
    // Exclude hidden folders and their subfolders
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const isFolderOrAncestorHidden = (f: Folder): boolean => {
      let curr: Folder | undefined = f;
      const visited = new Set<string>();
      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        if (curr.is_hidden) return true;
        curr = curr.parent_id ? folderById.get(curr.parent_id) : undefined;
      }
      return false;
    };
    const visibleFolders = folders.filter((f) => !isFolderOrAncestorHidden(f));

    const childMap = new Map<string | null, Folder[]>();
    for (const f of visibleFolders) {
      const pid = f.parent_id || null;
      if (!childMap.has(pid)) childMap.set(pid, []);
      childMap.get(pid)!.push(f);
    }
    for (const list of childMap.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    const result: { folder: Folder; depth: number; path: string }[] = [];

    const traverse = (parentId: string | null, depth: number, parentPath: string) => {
      const children = childMap.get(parentId) || [];
      for (const child of children) {
        const currentPath = parentPath ? `${parentPath} / ${child.title}` : child.title;
        result.push({ folder: child, depth, path: currentPath });
        traverse(child.id, depth + 1, currentPath);
      }
    };

    traverse(null, 0, "");
    return result;
  }, [folders]);

  const folderOptions = [
    {
      value: "unorganized",
      label: "Unorganized / Inbox",
      description: "Root ungrouped bookmarks",
      depth: 0,
      icon: <Inbox className="w-3.5 h-3.5 text-muted-foreground" />,
    },
    ...hierarchicalFolders.map(({ folder: f, depth, path }) => ({
      value: f.id,
      label: f.title,
      description: depth > 0 ? path : undefined,
      depth,
      parentId: f.parent_id || null,
      hasChildren: folders.some((child) => child.parent_id === f.id),
      icon: f.color ? (
        <span
          className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: f.color }}
        />
      ) : (
        <FolderIcon className="w-3.5 h-3.5 text-primary shrink-0" />
      ),
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bookmarkToEdit ? "Edit Bookmark" : "Add New Bookmark"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1 text-xs">
        <div>
          <FieldHeader icon={Link2} label="Target URL *" className="mb-1.5" />
          <input
            type="text"
            required
            placeholder="https://github.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-card/60 border border-border/80 focus:border-primary focus:outline-none text-foreground font-mono text-xs shadow-xs"
          />
        </div>

        <div>
          <FieldHeader
            icon={Type}
            label="Title"
            badge={
              <span className="text-[10px] text-muted-foreground/60 font-normal lowercase">
                (auto-scrapes if empty)
              </span>
            }
            className="mb-1.5"
          />
          <input
            type="text"
            placeholder="Website or project name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-card/60 border border-border/80 focus:border-primary focus:outline-none text-foreground text-xs shadow-xs"
          />
        </div>

        <div>
          <FieldHeader icon={FolderIcon} label="Folder" className="mb-1.5" />
          <AnimatedCombobox
            value={folderId || "unorganized"}
            onChange={(val) => setFolderId(val === "unorganized" ? null : val)}
            items={folderOptions}
            placeholder="Select folder..."
            searchPlaceholder="Search folders..."
          />
        </div>

        <div>
          <FieldHeader
            icon={TagIcon}
            label="Tags"
            badge={
              <span className="text-[10px] text-muted-foreground/60 font-normal lowercase">
                (comma separated)
              </span>
            }
            className="mb-1.5"
          />
          <input
            type="text"
            placeholder="react, tailwind, components"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-card/60 border border-border/80 focus:border-primary focus:outline-none text-foreground text-xs shadow-xs"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
          <Button type="button" variant="ghost" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button type="submit" className="h-8 text-xs">
            Save Bookmark
          </Button>
        </div>
      </form>
    </Modal>
  );
}
