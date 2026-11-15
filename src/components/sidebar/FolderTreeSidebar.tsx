import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Bookmark,
  Folder as FolderIcon,
  FolderPlus,
  Lock,
  Unlock,
  Plus,
  Inbox,
  AlertTriangle,
  Copy,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Trash2,
  Edit2,
  Sparkles,
  MoreHorizontal,
  Globe,
  RefreshCw,
  Tag as TagIcon,
  Settings,
  Heart,
  ListFilter,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { BloomMenu, type BloomMenuItem } from "@/components/ui/bloom-menu";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_PANEL } from "@/lib/ease";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { NativeDelete } from "@/components/NativeDelete";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagManagerModal, ICON_CATALOG } from "@/components/tags/TagManagerModal";
import { ListManagerModal } from "@/components/lists/ListManagerModal";
import { FieldHeader } from "@/components/ui/field-header";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { Folder, LibraryStats, ViewFilter, BrowserAccount, TagItem, CustomList, SmartListCounts } from "@/types";

interface Props {
  folders: Folder[];
  activeFolderId: string | null;
  activeFilter: ViewFilter;
  stats: LibraryStats | null;
  activeAccountId?: string | null;
  activeAccount?: BrowserAccount | null;
  activeTag?: string | null;
  activeListId?: string | null;
  onSelectTag?: (tag: string | null) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectFilter: (filter: ViewFilter) => void;
  onSelectList?: (listId: string | null) => void;
  onNewFolder: (parentId?: string | null) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleLock: (folderId: string) => void;
  onOpenAIDeepDive?: (folder: Folder) => void;
  onScrapeFolder?: (folderId: string, forceAll: boolean) => void;
  onNewBookmark?: () => void;
  onOpenAICategorize?: (folder?: Folder | null) => void;
  onOpenConnectWizard?: () => void;
  onSyncDefaultBrowser?: () => void;
  showHidden?: boolean;
  onHideFolder?: (folder: Folder) => void;
  onUnhideFolder?: (folderId: string) => void;
}

export function FolderTreeSidebar({
  folders,
  activeFolderId,
  activeFilter,
  stats,
  activeAccountId,
  activeAccount,
  activeTag,
  activeListId,
  onSelectTag,
  onSelectFolder,
  onSelectFilter,
  onSelectList,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onToggleLock,
  onOpenAIDeepDive,
  onScrapeFolder,
  onNewBookmark,
  onOpenAICategorize,
  onOpenConnectWizard,
  onSyncDefaultBrowser,
  showHidden = false,
  onHideFolder,
  onUnhideFolder,
}: Props) {
  const [sidebarMode, setSidebarMode] = useState<"folders" | "lists">("folders");
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [smartCounts, setSmartCounts] = useState<SmartListCounts>({ favorites: 0, trash: 0, reminders: 0 });
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<CustomList | null>(null);

  // Collapsed by default: only explicitly expanded folders are true
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<TagItem[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    try {
      const items = await api.getTags();
      setTags(items);
    } catch (err) {
      console.error("Failed to fetch tags in sidebar:", err);
    }
  }, []);

  const loadListsAndCounts = useCallback(async () => {
    try {
      const [l, c] = await Promise.all([api.getLists(), api.getSmartListCounts()]);
      setCustomLists(l);
      setSmartCounts(c);
    } catch (err) {
      console.error("Failed to load lists and counts:", err);
    }
  }, []);

  useEffect(() => {
    loadTags();
    loadListsAndCounts();
  }, [loadTags, loadListsAndCounts, stats]);

  const toggleExpand = useCallback((folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    folders.forEach((f) => {
      all[f.id] = true;
    });
    setExpandedFolders(all);
  }, [folders]);

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders({});
  }, []);

  // Filter folders for active account profile and hidden status
  const activeFolders = useMemo(() => {
    // Determine hidden status recursively: if folder OR any of its ancestors is hidden, it's hidden!
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const hiddenFolderIds = new Set<string>();

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

    folders.forEach((f) => {
      if (isFolderOrAncestorHidden(f)) {
        hiddenFolderIds.add(f.id);
      }
    });

    const baseFolders = showHidden
      ? folders.map((f) => (hiddenFolderIds.has(f.id) ? { ...f, is_hidden: true } : f))
      : folders.filter((f) => !hiddenFolderIds.has(f.id));

    if (!activeAccountId) return baseFolders;
    // Direct folders that contain bookmarks in this account
    const directFolders = new Set(
      baseFolders.filter((f) => (f.bookmark_count ?? 0) > 0).map((f) => f.id)
    );
    // Also include their ancestor/parent folders so the tree hierarchy remains complete
    const visibleFolders = new Set<string>();
    const folderMap = new Map(baseFolders.map((f) => [f.id, f]));

    directFolders.forEach((fid) => {
      let curr: Folder | undefined = folderMap.get(fid);
      while (curr) {
        visibleFolders.add(curr.id);
        curr = curr.parent_id ? folderMap.get(curr.parent_id) : undefined;
      }
    });

    return visibleFolders.size > 0
      ? baseFolders.filter((f) => visibleFolders.has(f.id))
      : baseFolders; // Fallback to base folders if none mapped yet
  }, [folders, activeAccountId, showHidden]);

  // Build folder hierarchy
  const rootFolders = activeFolders.filter((f) => !f.parent_id);
  const getSubfolders = useCallback(
    (parentId: string) => activeFolders.filter((f) => f.parent_id === parentId),
    [activeFolders]
  );

  const bloomItems: BloomMenuItem[] = useMemo(() => {
    const items: BloomMenuItem[] = [];
    if (onNewBookmark) {
      items.push({
        id: "new-bookmark",
        label: "New Bookmark",
        description: "Save a new link",
        icon: Bookmark,
        onClick: onNewBookmark,
      });
    }
    items.push({
      id: "new-folder",
      label: "New Folder",
      description: "Create folder",
      icon: FolderPlus,
      onClick: () => onNewFolder(null),
    });
    if (onOpenAICategorize) {
      items.push({
        id: "ai-organize",
        label: "AI Auto-Organize",
        description: "Smart categorization",
        icon: Sparkles,
        onClick: () => {
          const activeFolder = activeFolderId ? folders.find((f) => f.id === activeFolderId) || null : null;
          onOpenAICategorize(activeFolder);
        },
      });
    }
    if (onOpenConnectWizard) {
      items.push({
        id: "connect-profile",
        label: "Connect Browser",
        description: "Chrome, Edge, Zen",
        icon: Globe,
        onClick: onOpenConnectWizard,
      });
    }
    if (onSyncDefaultBrowser) {
      items.push({
        id: "sync-browser",
        label: "Sync Browser",
        description: "Rescan local browser",
        icon: RefreshCw,
        onClick: onSyncDefaultBrowser,
      });
    }
    return items;
  }, [onNewBookmark, onNewFolder, onOpenAICategorize, onOpenConnectWizard, onSyncDefaultBrowser]);

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Top Mode Switcher: Folders vs Lists */}
      <div className="p-2 border-b border-border/60 bg-black/20">
        <div className="grid grid-cols-2 p-0.5 rounded-xl bg-black/40 border border-white/[0.06] relative">
          <button
            type="button"
            onClick={() => setSidebarMode("folders")}
            className={cn(
              "relative z-10 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
              sidebarMode === "folders"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <span>Folders</span>
            {sidebarMode === "folders" && (
              <motion.div
                layoutId="sidebar-mode-indicator"
                className="absolute inset-0 bg-white/10 rounded-lg -z-10 shadow-xs border border-white/10"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarMode("lists")}
            className={cn(
              "relative z-10 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
              sidebarMode === "lists"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Lists</span>
            {sidebarMode === "lists" && (
              <motion.div
                layoutId="sidebar-mode-indicator"
                className="absolute inset-0 bg-white/10 rounded-lg -z-10 shadow-xs border border-white/10"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>

      {sidebarMode === "folders" ? (
        <>
          {/* Action Button: Bloom Menu */}
          <div className="p-3 border-b border-border/60 relative z-30">
            <BloomMenu items={bloomItems} triggerLabel="Create" />
          </div>

      {/* Quick Views */}
      <div className="p-3 space-y-1 border-b border-border/60">
        <div
          onClick={() => {
            onSelectFolder(null);
            onSelectFilter("all");
          }}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            activeFilter === "all" && activeFolderId === null
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5" />
            <span>All Bookmarks</span>
          </div>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-secondary/80">
            {stats?.total_bookmarks ?? 0}
          </span>
        </div>

        <div
          onClick={() => {
            onSelectFolder("unorganized");
            onSelectFilter("unorganized");
          }}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            activeFilter === "unorganized"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Inbox className="w-3.5 h-3.5" />
            <span>Unorganized / Inbox</span>
          </div>
          {(stats?.unorganized_count ?? 0) > 0 && (
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-primary/20 text-primary">
              {stats?.unorganized_count}
            </span>
          )}
        </div>

        <div
          onClick={() => {
            onSelectFolder(null);
            onSelectFilter("dead");
          }}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            activeFilter === "dead"
              ? "bg-destructive/15 text-destructive font-medium"
              : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive/80" />
            <span>Dead Links</span>
          </div>
          {(stats?.dead_links_count ?? 0) > 0 && (
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-destructive/20 text-destructive">
              {stats?.dead_links_count}
            </span>
          )}
        </div>

        <div
          onClick={() => {
            onSelectFolder(null);
            onSelectFilter("duplicates");
          }}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            activeFilter === "duplicates"
              ? "bg-amber-500/15 text-amber-400 font-medium"
              : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Duplicates</span>
          </div>
          {(stats?.duplicate_count ?? 0) > 0 && (
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
              {stats?.duplicate_count}
            </span>
          )}
        </div>
      </div>

      {/* Active Profile Vault Card (when profile is selected) */}
      <AnimatePresence mode="wait">
        {activeAccount && (
          <motion.div
            key={activeAccount.id}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING_PANEL}
            className="mx-3 mt-2.5 p-2.5 rounded-xl bg-card/60 border border-white/[0.08] space-y-1.5 shadow-2xs backdrop-blur-md"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/15"
                style={{ backgroundColor: activeAccount.color_dot }}
              />
              <span
                className="font-semibold text-foreground text-xs truncate"
                title={activeAccount.display_name}
              >
                {activeAccount.display_name}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/15 text-primary border border-primary/25">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Active Profile
              </span>

              {activeAccount.user_email && (
                <span
                  className="text-[10px] text-muted-foreground truncate max-w-[120px]"
                  title={activeAccount.user_email}
                >
                  {activeAccount.user_email}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folders Header */}
      <div className="px-3 pt-3 pb-1">
        <FieldHeader
          icon={FolderIcon}
          label="Folders & Categories"
          action={
            <Tooltip content="Create root folder">
              <button
                onClick={() => onNewFolder(null)}
                className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          }
        />
      </div>

      {/* Folders Tree List with Fluid Profile-Switch Animation */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeAccountId || "unified"}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={SPRING_PANEL}
            className="space-y-0.5"
          >
            {rootFolders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                depth={0}
                activeFolderId={activeFolderId}
                isExpanded={!!expandedFolders[folder.id]}
                subfolders={getSubfolders(folder.id)}
                getSubfolders={getSubfolders}
                expandedMap={expandedFolders}
                onSelectFolder={onSelectFolder}
                onToggleExpand={toggleExpand}
                onNewFolder={onNewFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onToggleLock={onToggleLock}
                onOpenAIDeepDive={onOpenAIDeepDive}
                onScrapeFolder={onScrapeFolder}
                showHidden={showHidden}
                onHideFolder={onHideFolder}
                onUnhideFolder={onUnhideFolder}
              />
            ))}

            {rootFolders.length === 0 && (
              <div className="text-center py-6 px-3 text-muted-foreground/60 text-xs">
                No folders in this profile.
                <div className="mt-2">
                  <Button size="sm" variant="ghost" onClick={() => onNewFolder(null)} className="h-7 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> New Folder
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Custom Tags Section */}
      <div className="pt-2 px-3 pb-1 border-t border-white/[0.06]">
        <FieldHeader
          icon={TagIcon}
          label="Tags"
          action={
            <button
              onClick={() => {
                setTagToEdit(null);
                setIsTagManagerOpen(true);
              }}
              className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Manage Tags"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          }
        />
      </div>

      <div className="px-2 py-1 flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="py-1 px-1 text-[11px] text-muted-foreground/50 italic">
            No tags yet
          </div>
        ) : (
          tags.map((t) => (
            <TagBadge
              key={t.id}
              name={t.name}
              color={t.color}
              icon={t.icon}
              count={t.bookmark_count}
              selected={activeTag === t.name}
              onIconClick={() => {
                setTagToEdit(t.name);
                setIsTagManagerOpen(true);
              }}
              onClick={() => {
                if (activeTag === t.name) {
                  onSelectTag?.(null);
                } else {
                  onSelectTag?.(t.name);
                }
              }}
            />
          ))
        )}
      </div>

      {/* Bottom Footer: Expand All / Collapse All Controls */}
      {folders.length > 0 && (
        <div className="px-2.5 py-2 border-t border-border/60 bg-card/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={handleExpandAll}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary/70 hover:text-foreground transition-colors cursor-pointer font-medium"
            title="Expand all nested folders"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-primary" />
            <span>Expand All</span>
          </button>

          <button
            type="button"
            onClick={handleCollapseAll}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary/70 hover:text-foreground transition-colors cursor-pointer font-medium"
            title="Collapse back to root folders only"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Collapse All</span>
          </button>
        </div>
      )}
        </>
      ) : (
        /* Lists Mode View */
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {/* Smart Lists Group */}
          <div className="space-y-1">
            <div className="px-2 pb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Smart Lists
              </span>
            </div>

            {/* ❤️ Favorites */}
            <div
              onClick={() => {
                onSelectFilter("favorites");
              }}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors",
                activeFilter === "favorites"
                  ? "bg-rose-500/15 text-rose-400 font-medium border border-rose-500/25"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 fill-rose-500/80 text-rose-500" />
                <span>Favorites</span>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400">
                {smartCounts.favorites}
              </span>
            </div>

            {/* 🗑️ Expired & Trash */}
            <div
              onClick={() => {
                onSelectFilter("trash");
              }}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors",
                activeFilter === "trash"
                  ? "bg-destructive/15 text-destructive font-medium border border-destructive/25"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                <span>Expired & Trash</span>
              </div>
              {smartCounts.trash > 0 && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-destructive/20 text-destructive">
                  {smartCounts.trash}
                </span>
              )}
            </div>

            {/* ⏰ Reminders */}
            <div
              onClick={() => {
                onSelectFilter("reminders");
              }}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors",
                activeFilter === "reminders"
                  ? "bg-amber-500/15 text-amber-400 font-medium border border-amber-500/25"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Reminders</span>
              </div>
              {smartCounts.reminders > 0 && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
                  {smartCounts.reminders}
                </span>
              )}
            </div>
          </div>

          {/* Divider & MY LISTS Section */}
          <div className="pt-2 border-t border-white/[0.06] space-y-1">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                My Lists
              </span>
              <button
                type="button"
                onClick={() => {
                  setListToEdit(null);
                  setIsListModalOpen(true);
                }}
                className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Create New List"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Custom Lists List */}
            {customLists.length === 0 ? (
              <div className="text-center py-6 px-3 text-muted-foreground/60 text-xs">
                No custom lists yet.
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setListToEdit(null);
                      setIsListModalOpen(true);
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> New List
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {customLists.map((list) => {
                  const match = ICON_CATALOG.find((item) => item.id === list.icon);
                  const IconComp = match?.component;
                  const isSelected = activeFilter === "list" && activeListId === list.id;

                  return (
                    <ContextMenu key={list.id}>
                      <ContextMenuTrigger>
                        <div
                          onClick={() => {
                            onSelectList?.(list.id);
                          }}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors group",
                            isSelected
                              ? "bg-primary/15 text-primary font-medium border border-primary/25"
                              : "text-muted-foreground hover:bg-card hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {list.color && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: list.color }}
                              />
                            )}
                            {match?.emoji ? (
                              <span className="text-sm shrink-0">{match.emoji}</span>
                            ) : IconComp ? (
                              <IconComp className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ListFilter className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">{list.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {(list.bookmark_count ?? 0) > 0 && (
                              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-secondary/80">
                                {list.bookmark_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-40">
                        <ContextMenuItem
                          onClick={() => {
                            setListToEdit(list);
                            setIsListModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-2" />
                          <span>Edit List</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={async () => {
                            await api.deleteList(list.id);
                            loadListsAndCounts();
                            if (activeListId === list.id) {
                              onSelectFilter("all");
                              onSelectList?.(null);
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          <span>Delete List</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Tag Manager Dialog */}
      <TagManagerModal
        isOpen={isTagManagerOpen}
        onClose={() => {
          setIsTagManagerOpen(false);
          setTagToEdit(null);
        }}
        onTagsUpdated={loadTags}
        initialTagToEdit={tagToEdit}
      />

      {/* List Manager Dialog */}
      <ListManagerModal
        isOpen={isListModalOpen}
        onClose={() => {
          setIsListModalOpen(false);
          setListToEdit(null);
        }}
        onListSaved={() => {
          loadListsAndCounts();
        }}
        onListDeleted={() => {
          loadListsAndCounts();
        }}
        editingList={listToEdit}
      />
    </div>
  );
}

const FolderRow = React.memo(function FolderRow({
  folder,
  depth,
  activeFolderId,
  isExpanded,
  subfolders,
  getSubfolders,
  expandedMap,
  onSelectFolder,
  onToggleExpand,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onToggleLock,
  onOpenAIDeepDive,
  onScrapeFolder,
  showHidden,
  onHideFolder,
  onUnhideFolder,
}: {
  folder: Folder;
  depth: number;
  activeFolderId: string | null;
  isExpanded: boolean;
  subfolders: Folder[];
  getSubfolders: (parentId: string) => Folder[];
  expandedMap: Record<string, boolean>;
  onSelectFolder: (id: string) => void;
  onToggleExpand: (id: string, e?: React.MouseEvent) => void;
  onNewFolder: (parentId?: string | null) => void;
  onEditFolder: (f: Folder) => void;
  onDeleteFolder: (id: string) => void;
  onToggleLock: (id: string) => void;
  onOpenAIDeepDive?: (f: Folder) => void;
  onScrapeFolder?: (id: string, forceAll: boolean) => void;
  showHidden?: boolean;
  onHideFolder?: (folder: Folder) => void;
  onUnhideFolder?: (folderId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSelected = activeFolderId === folder.id;
  const hasChildren = subfolders.length > 0;

  return (
    <div className="flex flex-col">
      {/* 
        Hover container strictly wraps ONLY this folder's row and its action pill.
        Child/nested folders are rendered outside so moving cursor to child immediately fires 
        onMouseLeave on the parent, preventing parent action pills from persisting!
      */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="relative rounded-lg"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              if (!isDeleting) setIsHovered(false);
            }}
          >
            {/* Main Folder Row */}
            <div
              onClick={() => {
                onSelectFolder(folder.id);
                // Also toggle open on row click if has children
                if (hasChildren && !isExpanded) {
                  onToggleExpand(folder.id);
                }
              }}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
              className={`flex items-center justify-between pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              } ${folder.is_hidden ? "opacity-45 hover:opacity-75 grayscale-[30%]" : ""}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => onToggleExpand(folder.id, e)}
                    className="p-0.5 rounded hover:bg-secondary/60 text-muted-foreground shrink-0 cursor-pointer flex items-center justify-center"
                  >
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="inline-flex items-center justify-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.span>
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}

                {folder.color ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: folder.color }}
                  />
                ) : (
                  <FolderIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                )}

                <span
                  className="truncate text-xs font-normal text-foreground/90 flex-1 min-w-0"
                  title={folder.title}
                >
                  {folder.title}
                </span>

                {folder.is_hidden && (
                  <Tooltip content="Hidden Folder: Excluded from search, AI chat, and scraping">
                    <EyeOff className="w-3 h-3 text-amber-400/90 shrink-0 ml-1" />
                  </Tooltip>
                )}

                {folder.is_locked && (
                  <Tooltip content="Folder is Locked: AI cannot move or reorganize bookmarks inside this folder">
                    <Lock className="w-3 h-3 text-amber-400/90 shrink-0 ml-1" />
                  </Tooltip>
                )}
              </div>

              {/* Right side subtle info/dots */}
              <div className="flex items-center gap-1 shrink-0">
                {folder.bookmark_count !== undefined && folder.bookmark_count > 0 && (
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-secondary/70 text-muted-foreground">
                    {folder.bookmark_count}
                  </span>
                )}
                <Tooltip content="Folder options">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(folder);
                    }}
                    className={`p-0.5 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-opacity ${
                      isHovered ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Sub-row Action Bar strictly for this folder */}
            <AnimatePresence>
              {(isHovered || isDeleting) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="overflow-hidden"
                  style={{ paddingLeft: `${depth * 14 + 26}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pt-0.5 pb-1 flex items-center">
                    <div className="flex items-center gap-0.5 rounded-lg bg-zinc-950/85 border border-white/[0.08] p-0.5 shadow-sm backdrop-blur-md transition-all">
                      {!isDeleting && (
                        <>
                          {onOpenAIDeepDive && (
                            <Tooltip content="AI Subfolder Deep Dive" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md text-primary hover:bg-primary/20 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAIDeepDive(folder);
                                }}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                          )}

                          <Tooltip content="Add subfolder" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.08] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewFolder(folder.id);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>

                          <Tooltip
                            content={folder.is_locked ? "Unlock Folder" : "Lock Folder (Immune to AI)"}
                            side="top"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLock(folder.id);
                              }}
                            >
                              {folder.is_locked ? (
                                <Lock className="h-3.5 w-3.5 text-amber-400" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </Tooltip>

                          <Tooltip content="Edit folder" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.08] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditFolder(folder);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>

                          <div className="h-3 w-[1px] bg-white/[0.08] mx-0.5" />
                        </>
                      )}

                      <NativeDelete
                        size="sm"
                        onConfirm={() => setIsDeleting(true)}
                        onDelete={() => {
                          setIsDeleting(false);
                          onDeleteFolder(folder.id);
                        }}
                        onExpandedChange={setIsDeleting}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => onScrapeFolder?.(folder.id, true)}>
            <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
            <span>Verify & Scrape all {folder.bookmark_count ?? 0} bookmarks</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onNewFolder(folder.id)}>
            <FolderPlus className="w-4 h-4 mr-2 text-primary" />
            <span>New Subfolder...</span>
          </ContextMenuItem>
          {onOpenAIDeepDive && (
            <ContextMenuItem onClick={() => onOpenAIDeepDive(folder)}>
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              <span>AI Subfolder Deep Dive</span>
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onToggleLock(folder.id)}>
            {folder.is_locked ? (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                <span>Unlock Folder</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2 text-amber-400" />
                <span>Lock Folder (AI Immune)</span>
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onEditFolder(folder)}>
            <Edit2 className="w-4 h-4 mr-2" />
            <span>Edit Folder Name & Color</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              if (folder.is_hidden) {
                onUnhideFolder?.(folder.id);
              } else {
                onHideFolder?.(folder);
              }
            }}
          >
            {folder.is_hidden ? (
              <>
                <Eye className="w-4 h-4 mr-2 text-amber-400" />
                <span>Unhide Folder</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 mr-2 text-amber-400" />
                <span>Hide Folder...</span>
              </>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="destructive" onClick={() => onDeleteFolder(folder.id)}>
            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
            <span>Delete Folder</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 
        Nested Subfolders: Rendered outside the parent's hover box!
        Smoothly animated with AnimatePresence & motion.div.
      */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
            }}
            className="overflow-hidden space-y-0.5"
          >
            {subfolders.map((child) => (
              <FolderRow
                key={child.id}
                folder={child}
                depth={depth + 1}
                activeFolderId={activeFolderId}
                isExpanded={!!expandedMap[child.id]}
                subfolders={getSubfolders(child.id)}
                getSubfolders={getSubfolders}
                expandedMap={expandedMap}
                onSelectFolder={onSelectFolder}
                onToggleExpand={onToggleExpand}
                onNewFolder={onNewFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onToggleLock={onToggleLock}
                onOpenAIDeepDive={onOpenAIDeepDive}
                onScrapeFolder={onScrapeFolder}
                showHidden={showHidden}
                onHideFolder={onHideFolder}
                onUnhideFolder={onUnhideFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
