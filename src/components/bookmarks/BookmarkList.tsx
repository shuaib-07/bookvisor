import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  ExternalLink,
  Copy,
  Pin,
  Trash2,
  Share2,
  History,
  LayoutGrid,
  List,
  AlertCircle,
  Sparkles,
  Plus,
  ChevronRight,
  Link2Off,
  Layers,
  Clock,
  Calendar,
  Heart,
  RotateCcw,
  ArrowDownUp,
  ArrowDown,
  Check,
  ChevronDown,
  Globe,
  Type,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence, type Transition } from "framer-motion";

const pinSpringConfig: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 34,
  mass: 0.8,
};
import { SharePopover } from "@/components/bookmarks/SharePopover";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { NativeDelete } from "@/components/NativeDelete";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { InlineOverflow, type InlineOverflowAction } from "@/components/ui/inline-overflow";
import { RemoveDeadLinksModal } from "@/components/bookmarks/RemoveDeadLinksModal";
import { FavoriteButton } from "@/components/ui/favorite-button";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { useToast } from "@/components/ui/animated-toast-stack";
import { FilterToolbar, type FilterChip, type FilterField } from "@/components/ui/filter-toolbar/filter-toolbar";
import { InlineAction } from "@/components/ui/inline-action";
import { openExternalUrl } from "@/lib/updater";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Bookmark, DisplayMode, Folder, ScraperProgress, BrowserAccount, CustomList } from "@/types";

interface Props {
  bookmarks: Bookmark[];
  folders: Folder[];
  accounts?: BrowserAccount[];
  currentFolder: Folder | null;
  filterTitle: string;
  activeFilter?: string;
  activeListId?: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBookmarkId: string | null;
  onSelectBookmark: (b: Bookmark) => void;
  onTogglePin: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onMoveBookmark: (bookmarkId: string, folderId: string | null) => void;
  onNewBookmark: () => void;
  onSelectFolder?: (folderId: string | null) => void;
  onOpenDuplicates?: (folder: Folder | null) => void;
  onTransferBookmarkAccount?: (bookmarkId: string, targetAccountId: string, isMove: boolean) => void;
  onToggleListAssign?: (bookmarkId: string, listId: string, isAssigned: boolean) => void;
  onEmptyTrash?: () => void;
  onRestoreBookmark?: (id: string) => void;
  onPurgeBookmark?: (id: string) => void;
  onRefresh?: () => void;
  scraperProgress: ScraperProgress | null;
  onStartScrape: () => void;
  onPauseScrape: () => void;
  onResumeScrape: () => void;
  onStopScrape: () => void;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
  onHideBookmark?: (bookmark: Bookmark) => void;
  onUnhideBookmark?: (bookmarkId: string) => void;
}

export function BookmarkList({
  bookmarks,
  folders,
  accounts = [],
  currentFolder,
  filterTitle,
  activeFilter,
  activeListId: _activeListId,
  searchQuery,
  onSearchChange,
  selectedBookmarkId,
  onSelectBookmark,
  onTogglePin,
  onToggleFavorite,
  onDeleteBookmark,
  onMoveBookmark,
  onNewBookmark,
  onSelectFolder,
  onOpenDuplicates,
  onTransferBookmarkAccount,
  onToggleListAssign,
  onEmptyTrash,
  onRestoreBookmark,
  onPurgeBookmark,
  onRefresh,
  scraperProgress,
  onStartScrape,
  onPauseScrape,
  onResumeScrape,
  onStopScrape,
  showHidden = false,
  onToggleShowHidden,
  onHideBookmark,
  onUnhideBookmark,
}: Props) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [gridColumns, setGridColumns] = useState<3 | 4 | 5>(() => {
    const saved = Number(localStorage.getItem("bookmanage_grid_cols"));
    return saved === 3 || saved === 4 || saved === 5 ? saved : 3;
  });
  const [listColumns, setListColumns] = useState<2 | 3 | 4>(() => {
    const saved = Number(localStorage.getItem("bookmanage_list_cols"));
    return saved === 2 || saved === 3 || saved === 4 ? saved : 2;
  });
  const [visibleCount, setVisibleCount] = useState(60);
  const [deadModalOpen, setDeadModalOpen] = useState(false);
  const [filterChips, setFilterChips] = useState<FilterChip[]>([]);
  const [availableLists, setAvailableLists] = useState<CustomList[]>([]);
  const { toast } = useToast();

  // Sorting state
  const [sortField, setSortField] = useState<"created_at" | "title" | "domain" | "favorite" | "reminder">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const SORT_OPTIONS = useMemo(
    () => [
      { id: "created_at" as const, label: "Date Added", icon: Calendar, defaultOrder: "desc" as const },
      { id: "title" as const, label: "Title (A–Z)", icon: Type, defaultOrder: "asc" as const },
      { id: "domain" as const, label: "Domain / Site", icon: Globe, defaultOrder: "asc" as const },
      { id: "favorite" as const, label: "Favorites First", icon: Heart, defaultOrder: "desc" as const },
      { id: "reminder" as const, label: "Reminder Date", icon: Clock, defaultOrder: "asc" as const },
    ],
    []
  );

  // Shimmering skeleton state during sorting and filtering
  const [isSortingOrFiltering, setIsSortingOrFiltering] = useState(false);
  const isFirstMount = useRef(true);

  const filterSignature = useMemo(
    () => filterChips.map((c) => `${c.id}:${c.value}`).join("|"),
    [filterChips]
  );

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setIsSortingOrFiltering(true);
    const timer = setTimeout(() => {
      setIsSortingOrFiltering(false);
    }, 750);
    return () => clearTimeout(timer);
  }, [sortField, sortOrder, filterSignature, searchQuery]);

  useEffect(() => {
    api.getLists().then(setAvailableLists).catch(() => {});
  }, [bookmarks]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookmarks) {
      if (b.tags) {
        for (const t of b.tags) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [bookmarks]);

  const filterFields: FilterField[] = useMemo(() => {
    const list: FilterField[] = [
      {
        id: "status",
        label: "Link Status",
        options: [
          { value: "Live", label: "Live", hint: bookmarks.filter((b) => b.link_status === "LIVE").length },
          { value: "Dead / Broken", label: "Dead / Broken", hint: bookmarks.filter((b) => b.link_status === "DEAD").length },
          { value: "Redirect", label: "Redirect", hint: bookmarks.filter((b) => b.link_status === "REDIRECT").length },
          { value: "Timeout", label: "Timeout", hint: bookmarks.filter((b) => b.link_status === "TIMEOUT").length },
          { value: "Bot Check", label: "Bot Check", hint: bookmarks.filter((b) => b.link_status === "BOT CHECK" || b.link_status === "BOT_CHECK").length },
        ],
      },
      {
        id: "cover",
        label: "Cover Picture",
        options: [
          { value: "With Cover", label: "With Cover", hint: bookmarks.filter((b) => !!b.cover_image_url).length },
          { value: "Without Cover", label: "Without Cover", hint: bookmarks.filter((b) => !b.cover_image_url).length },
        ],
      },
      {
        id: "notes",
        label: "Notes",
        options: [
          { value: "Has Notes", label: "Has Notes", hint: bookmarks.filter((b) => !!b.user_notes && b.user_notes.trim().length > 0).length },
          { value: "No Notes", label: "No Notes", hint: bookmarks.filter((b) => !b.user_notes || b.user_notes.trim().length === 0).length },
        ],
      },
      {
        id: "reminder",
        label: "Reminder",
        options: [
          { value: "Has Reminder", label: "Has Reminder", hint: bookmarks.filter((b) => !!b.reminder_at).length },
          { value: "Overdue", label: "Overdue", hint: bookmarks.filter((b) => !!b.reminder_at && new Date(b.reminder_at).getTime() < Date.now()).length },
          { value: "No Reminder", label: "No Reminder", hint: bookmarks.filter((b) => !b.reminder_at).length },
        ],
      },
      {
        id: "expires",
        label: "Auto-Expiration",
        options: [
          { value: "Has Expiration", label: "Has Expiration", hint: bookmarks.filter((b) => !!b.expires_at).length },
          { value: "Never Expires", label: "Never Expires", hint: bookmarks.filter((b) => !b.expires_at).length },
        ],
      },
      {
        id: "pinned",
        label: "Pin Status",
        options: [
          { value: "Pinned Only", label: "Pinned Only", hint: bookmarks.filter((b) => b.is_pinned).length },
          { value: "Unpinned Only", label: "Unpinned Only", hint: bookmarks.filter((b) => !b.is_pinned).length },
        ],
      },
    ];

    if (availableTags.length > 0) {
      list.push({
        id: "tag",
        label: "Tag",
        options: availableTags.map((tag) => ({
          value: tag,
          label: `#${tag}`,
          hint: bookmarks.filter((b) => b.tags?.includes(tag)).length,
        })),
      });
    }

    if (accounts.length > 0) {
      list.push({
        id: "account",
        label: "Browser Account",
        options: accounts.map((acc) => ({
          value: acc.display_name,
          label: acc.display_name,
          hint: bookmarks.filter((b) => b.account_ids?.includes(acc.id)).length,
        })),
      });
    }

    return list;
  }, [bookmarks, availableTags, accounts]);

  const deadCountInFolder = useMemo(() => {
    return bookmarks.filter((b) => b.link_status === "DEAD" || b.link_status === "TIMEOUT").length;
  }, [bookmarks]);

  const duplicatesCountInFolder = useMemo(() => {
    const urlMap = new Map<string, number>();
    for (const b of bookmarks) {
      if (!b.clean_url) continue;
      urlMap.set(b.clean_url, (urlMap.get(b.clean_url) || 0) + 1);
    }
    let dupes = 0;
    for (const count of urlMap.values()) {
      if (count > 1) {
        dupes += count;
      }
    }
    return dupes;
  }, [bookmarks]);

  const handleOpenDeadModal = () => {
    if (deadCountInFolder === 0) {
      toast({
        status: "info",
        title: "No Dead Links",
        description: currentFolder
          ? `No broken or dead links found in "${currentFolder.title}".`
          : "No broken links found in the current view.",
      });
      return;
    }
    setDeadModalOpen(true);
  };

  useEffect(() => {
    localStorage.setItem("bookmanage_grid_cols", String(gridColumns));
  }, [gridColumns]);

  useEffect(() => {
    localStorage.setItem("bookmanage_list_cols", String(listColumns));
  }, [listColumns]);

  const gridClass = useMemo(() => {
    if (gridColumns === 5) {
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5";
    }
    if (gridColumns === 4) {
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3";
    }
    return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3";
  }, [gridColumns]);

  const listClass = useMemo(() => {
    if (listColumns === 4) {
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5";
    }
    if (listColumns === 3) {
      return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5";
    }
    return "grid grid-cols-1 lg:grid-cols-2 gap-1.5";
  }, [listColumns]);

  const viewVisibleActions: InlineOverflowAction[] = useMemo(
    () => [
      {
        id: "view-cards",
        icon: LayoutGrid,
        active: displayMode === "cards",
        title: "Grid View",
        onClick: () => setDisplayMode("cards"),
      },
      {
        id: "view-table",
        icon: List,
        active: displayMode === "table",
        title: "List View",
        onClick: () => setDisplayMode("table"),
      },
    ],
    [displayMode]
  );

  const viewHiddenActions: InlineOverflowAction[] = useMemo(() => {
    if (displayMode === "cards") {
      return [3, 4, 5].map((cols) => ({
        id: `grid-col-${cols}`,
        label: `${cols}C`,
        active: gridColumns === cols,
        title: `${cols} column grid layout`,
        onClick: () => setGridColumns(cols as 3 | 4 | 5),
      }));
    }
    return [2, 3, 4].map((cols) => ({
      id: `list-col-${cols}`,
      label: `${cols}C`,
      active: listColumns === cols,
      title: `${cols} column list layout`,
      onClick: () => setListColumns(cols as 2 | 3 | 4),
    }));
  }, [displayMode, gridColumns, listColumns]);

  // Reset pagination when filter, folder or search query changes
  useEffect(() => {
    setVisibleCount(60);
  }, [currentFolder?.id, filterTitle, searchQuery, filterChips]);

  // Fast O(1) folder title lookup cache
  const folderNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) {
      map.set(f.id, f.title);
    }
    return map;
  }, [folders]);

  // Instant in-memory filter combining text search and toolbar filter chips
  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.clean_url.toLowerCase().includes(q) ||
          b.domain.toLowerCase().includes(q) ||
          (b.scraped_summary && b.scraped_summary.toLowerCase().includes(q))
      );
    }

    let result = list;
    if (filterChips.length > 0) {
      result = list.filter((b) => {
        for (const chip of filterChips) {
          if (chip.id === "status") {
            if (chip.value === "Live" && b.link_status !== "LIVE") return false;
            if (chip.value === "Dead / Broken" && b.link_status !== "DEAD") return false;
            if (chip.value === "Redirect" && b.link_status !== "REDIRECT") return false;
            if (chip.value === "Timeout" && b.link_status !== "TIMEOUT") return false;
            if (chip.value === "Bot Check" && b.link_status !== "BOT CHECK" && b.link_status !== "BOT_CHECK") return false;
          } else if (chip.id === "cover") {
            const hasCover = !!b.cover_image_url;
            if (chip.value === "With Cover" && !hasCover) return false;
            if (chip.value === "Without Cover" && hasCover) return false;
          } else if (chip.id === "notes") {
            const hasNotes = !!b.user_notes && b.user_notes.trim().length > 0;
            if (chip.value === "Has Notes" && !hasNotes) return false;
            if (chip.value === "No Notes" && hasNotes) return false;
          } else if (chip.id === "reminder") {
            const hasReminder = !!b.reminder_at;
            const isOverdue = hasReminder && new Date(b.reminder_at!).getTime() < Date.now();
            if (chip.value === "Has Reminder" && !hasReminder) return false;
            if (chip.value === "Overdue" && !isOverdue) return false;
            if (chip.value === "No Reminder" && hasReminder) return false;
          } else if (chip.id === "expires") {
            const hasExpires = !!b.expires_at;
            if (chip.value === "Has Expiration" && !hasExpires) return false;
            if (chip.value === "Never Expires" && hasExpires) return false;
          } else if (chip.id === "pinned") {
            if (chip.value === "Pinned Only" && !b.is_pinned) return false;
            if (chip.value === "Unpinned Only" && b.is_pinned) return false;
          } else if (chip.id === "tag") {
            const tagValue = chip.value?.replace(/^#/, "");
            if (!tagValue || !b.tags?.includes(tagValue)) return false;
          } else if (chip.id === "account") {
            const acc = accounts.find((a) => a.display_name === chip.value);
            if (acc && !b.account_ids?.includes(acc.id)) return false;
          }
        }
        return true;
      });
    }

    // Deterministic sorting with pinned items prioritized
    return [...result].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }

      let cmp = 0;
      if (sortField === "created_at") {
        const tA = new Date(a.created_at).getTime() || 0;
        const tB = new Date(b.created_at).getTime() || 0;
        cmp = tA - tB;
      } else if (sortField === "title") {
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      } else if (sortField === "domain") {
        cmp = a.domain.localeCompare(b.domain, undefined, { sensitivity: "base" });
      } else if (sortField === "favorite") {
        const fA = a.is_favorite ? 1 : 0;
        const fB = b.is_favorite ? 1 : 0;
        cmp = fA - fB;
      } else if (sortField === "reminder") {
        const rA = a.reminder_at ? new Date(a.reminder_at).getTime() : 0;
        const rB = b.reminder_at ? new Date(b.reminder_at).getTime() : 0;
        cmp = rA - rB;
      }

      if (cmp !== 0) {
        return sortOrder === "asc" ? cmp : -cmp;
      }

      // Consistent deterministic tie-breaker so unpinned items restore to exact position
      return a.id.localeCompare(b.id);
    });
  }, [bookmarks, searchQuery, filterChips, accounts, sortField, sortOrder]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 700) {
      setVisibleCount((prev) => Math.min(prev + 60, filteredBookmarks.length));
    }
  }, [filteredBookmarks.length]);

  const visibleBookmarks = useMemo(() => {
    return filteredBookmarks.slice(0, visibleCount);
  }, [filteredBookmarks, visibleCount]);

  const handleCopy = (_id: string, url: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(url);
    toast({
      title: "Clean URL Copied",
      description: url,
      status: "success",
    });
  };

  const handleOpenUrl = (url: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    openExternalUrl(url);
  };

  const isScraperActive = scraperProgress?.is_running;

  // Build recursive breadcrumb path for current folder
  const breadcrumbs = useMemo(() => {
    if (!currentFolder) return [];
    const list: Folder[] = [];
    let curr: Folder | undefined = currentFolder;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      list.unshift(curr);
      if (!curr.parent_id) break;
      curr = folders.find((f) => f.id === curr!.parent_id);
    }
    return list;
  }, [currentFolder, folders]);

  return (
    <div className="flex flex-col h-full bg-background/50 select-none">
      {/* Top Header & Search Bar */}
      <div className="p-3.5 border-b border-border/60 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          {breadcrumbs.length > 0 ? (
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectFolder?.(null)}
                className="hover:text-foreground hover:underline transition-colors cursor-pointer flex items-center gap-1 shrink-0 font-medium text-muted-foreground/80"
              >
                All Bookmarks
              </button>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={crumb.id} className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    {isLast ? (
                      <span className="font-bold text-foreground text-sm truncate max-w-[200px]">
                        {crumb.title}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectFolder?.(crumb.id)}
                        className="hover:text-foreground hover:underline transition-colors truncate max-w-[150px] cursor-pointer"
                      >
                        {crumb.title}
                      </button>
                    )}
                  </div>
                );
              })}
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground font-mono ml-1 shrink-0">
                {bookmarks.length}
              </span>
            </nav>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {filterTitle}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground font-mono">
                {bookmarks.length}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {activeFilter === "trash" && bookmarks.length > 0 && (
              <NativeDelete
                size="sm"
                onConfirm={() => {}}
                onDelete={() => onEmptyTrash?.()}
                buttonText="Empty Trash"
                confirmText="Confirm Empty"
              />
            )}

            {/* View Mode Switcher & Column Layout Inline Overflow */}
            <InlineOverflow
              visibleActions={viewVisibleActions}
              hiddenActions={viewHiddenActions}
            />

            {/* Folder-scoped quick actions: Find Duplicates & Remove Dead Links */}
            <Tooltip
              content={
                currentFolder
                  ? `Find duplicate links in "${currentFolder.title}"`
                  : "Find duplicate bookmarks"
              }
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDuplicates?.(currentFolder)}
                className="h-8 rounded-lg gap-1.5 text-xs px-2.5 border-white/[0.08] bg-card/60 backdrop-blur-md hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Duplicates</span>
                {duplicatesCountInFolder > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-semibold border border-amber-500/30">
                    {duplicatesCountInFolder}
                  </span>
                )}
              </Button>
            </Tooltip>

            <Tooltip
              content={
                currentFolder
                  ? `Purge dead & broken links in "${currentFolder.title}"`
                  : "Purge dead & broken links"
              }
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDeadModal}
                className="h-8 rounded-lg gap-1.5 text-xs px-2.5 border-white/[0.08] bg-card/60 backdrop-blur-md hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Link2Off className="w-3.5 h-3.5 text-red-400" />
                <span>Remove Dead</span>
                {deadCountInFolder > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 font-mono text-[10px] font-semibold border border-red-500/30">
                    {deadCountInFolder}
                  </span>
                )}
              </Button>
            </Tooltip>

            {/* Add Bookmark Button */}
            <Button
              size="sm"
              onClick={onNewBookmark}
              className="h-8 rounded-lg gap-1.5 text-xs px-3 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Link</span>
            </Button>
          </div>
        </div>

        {/* Search Bar + Dynamic Filter Toolbar + Scraper Status Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bookmarks by title, domain, URL, or notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-card/60 border border-white/[0.08] focus:border-primary/50 focus:outline-none text-xs text-foreground placeholder:text-muted-foreground/60 backdrop-blur-md transition-colors"
            />
          </div>

          {/* Dynamic Filter Toolbar right next to the searchbar */}
          <div className="shrink-0 flex items-center">
            <FilterToolbar
              filters={filterChips}
              onRemove={(id) => setFilterChips((f) => f.filter((x) => x.id !== id))}
              onClearAll={() => setFilterChips([])}
              addFilter={{
                fields: filterFields,
                onAdd: (chip) =>
                  setFilterChips((f) => [...f.filter((x) => x.id !== chip.id), chip]),
                label: "Filter",
              }}
            />
          </div>

          {/* Animated Sorting Options Button & Popover */}
          <div className="relative shrink-0 flex items-center">
            <div className="h-8 inline-flex items-center rounded-lg bg-card/60 border border-white/[0.08] p-0.5 shadow-2xs backdrop-blur-md">
              <button
                type="button"
                onClick={() => setIsSortMenuOpen((v) => !v)}
                className="h-full flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Change sorting criteria"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="hidden xl:inline text-[11px] font-medium text-muted-foreground">
                  Sort:
                </span>
                <span className="text-[11px] font-medium text-foreground">
                  {SORT_OPTIONS.find((o) => o.id === sortField)?.label.replace(/ \(.*\)/, "") || "Date"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 text-muted-foreground transition-transform duration-200",
                    isSortMenuOpen && "rotate-180"
                  )}
                />
              </button>

              <div className="w-[1px] h-3.5 bg-white/[0.1] my-auto" />

              {/* Order flip toggle (Asc / Desc) with animated spring flip */}
              <Tooltip
                content={
                  sortOrder === "desc"
                    ? "Descending (Newest / Z-A) — Click to flip"
                    : "Ascending (Oldest / A-Z) — Click to flip"
                }
              >
                <button
                  type="button"
                  onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                  className="h-full px-1.5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <motion.div
                    animate={{ rotate: sortOrder === "asc" ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </motion.div>
                </button>
              </Tooltip>
            </div>

            {/* Animated Popover Menu */}
            <AnimatePresence>
              {isSortMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSortMenuOpen(false)}
                  />

                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] rounded-xl border border-white/[0.12] bg-[#141416]/95 backdrop-blur-2xl shadow-2xl p-1.5 space-y-0.5 select-none"
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sort Options
                    </div>

                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortField === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (sortField === opt.id) {
                              setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
                            } else {
                              setSortField(opt.id);
                              setSortOrder(opt.defaultOrder);
                            }
                            setIsSortMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer",
                            isSelected
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            >
                              <Check className="w-3.5 h-3.5 text-primary" />
                            </motion.span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Toggle Hidden Bookmarks Visibility */}
          <div className="shrink-0 flex items-center">
            <Tooltip content={showHidden ? "Hide hidden items (currently visible)" : "Show hidden items in library"}>
              <button
                type="button"
                onClick={onToggleShowHidden}
                className={cn(
                  "h-8 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium backdrop-blur-md shadow-2xs",
                  showHidden
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                    : "bg-card/60 hover:bg-card/85 border-white/[0.08] text-muted-foreground hover:text-foreground"
                )}
              >
                {showHidden ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-medium hidden md:inline">Hidden Shown</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-medium hidden md:inline">Hidden</span>
                  </>
                )}
              </button>
            </Tooltip>
          </div>

          {/* Scraper Worker Control Widget using InlineAction */}
          <div className="shrink-0 flex items-center">
            <InlineAction
              label={
                currentFolder
                  ? `Verify & Scrape (${bookmarks.length})`
                  : bookmarks.length > 0
                  ? `Verify & Scrape (${bookmarks.length})`
                  : "Verify & Scrape"
              }
              icon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
              actionText="Verify"
              onAction={onStartScrape}
              isRunning={isScraperActive}
              isPaused={scraperProgress?.is_paused}
              completed={scraperProgress?.completed}
              total={scraperProgress?.total}
              onPause={onPauseScrape}
              onResume={onResumeScrape}
              onStop={onStopScrape}
            />
          </div>
        </div>
      </div>

      {/* Bookmarks Display Area with Progressive Windowing */}
      <div className="flex-1 overflow-y-auto p-3.5" onScroll={handleScroll}>
        {isSortingOrFiltering ? (
          displayMode === "cards" ? (
            <div className={gridClass}>
              {Array.from({ length: Math.min(Math.max(visibleBookmarks.length, 6), 12) }).map((_, i) => (
                <BookmarkCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className={listClass}>
              {Array.from({ length: Math.min(Math.max(visibleBookmarks.length, 8), 16) }).map((_, i) => (
                <BookmarkRowSkeleton key={i} />
              ))}
            </div>
          )
        ) : filteredBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground text-xs space-y-2">
            <AlertCircle className="w-8 h-8 stroke-[1.5] text-muted-foreground/50" />
            <p>No bookmarks match the current filter or search query.</p>
            {filterChips.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterChips([])}
                className="mt-2 text-xs"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : displayMode === "cards" ? (
          <>
            <motion.div
              key={`cards-${sortField}-${sortOrder}-${filterSignature}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className={gridClass}
            >
              {visibleBookmarks.map((b) => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  accounts={accounts}
                  availableLists={availableLists}
                  folderName={folderNameMap.get(b.folder_id || "") || "Unorganized"}
                  isSelected={selectedBookmarkId === b.id}
                  onSelect={() => onSelectBookmark(b)}
                  onCopy={(e) => handleCopy(b.id, b.clean_url, e)}
                  onOpen={(e) => handleOpenUrl(b.url, e)}
                  onTogglePin={() => onTogglePin(b.id)}
                  onToggleFavorite={() => onToggleFavorite?.(b.id)}
                  onDelete={() => onDeleteBookmark(b.id)}
                  onMove={(folderId) => onMoveBookmark(b.id, folderId)}
                  onTransferAccount={(targetAccId, isMove) => onTransferBookmarkAccount?.(b.id, targetAccId, isMove)}
                  onToggleListAssign={(listId, isAssigned) => onToggleListAssign?.(b.id, listId, isAssigned)}
                  isTrash={activeFilter === "trash"}
                  onRestore={() => onRestoreBookmark?.(b.id)}
                  onPurge={() => onPurgeBookmark?.(b.id)}
                  onHide={() => onHideBookmark?.(b)}
                  onUnhide={() => onUnhideBookmark?.(b.id)}
                />
              ))}
            </motion.div>
            {visibleCount < filteredBookmarks.length && (
              <div className="py-4 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
                <span>Showing {visibleBookmarks.length} of {filteredBookmarks.length} bookmarks (scroll to load more)...</span>
              </div>
            )}
          </>
        ) : (
          <>
            <motion.div
              key={`list-${sortField}-${sortOrder}-${filterSignature}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className={listClass}
            >
              {visibleBookmarks.map((b) => (
                <BookmarkTableRow
                  key={b.id}
                  bookmark={b}
                  accounts={accounts}
                  availableLists={availableLists}
                  folderName={folderNameMap.get(b.folder_id || "") || "Unorganized"}
                  isSelected={selectedBookmarkId === b.id}
                  onSelect={() => onSelectBookmark(b)}
                  onCopy={(e) => handleCopy(b.id, b.clean_url, e)}
                  onOpen={(e) => handleOpenUrl(b.url, e)}
                  onTogglePin={() => onTogglePin(b.id)}
                  onToggleFavorite={() => onToggleFavorite?.(b.id)}
                  onDelete={() => onDeleteBookmark(b.id)}
                  onTransferAccount={(targetAccId, isMove) => onTransferBookmarkAccount?.(b.id, targetAccId, isMove)}
                  onToggleListAssign={(listId, isAssigned) => onToggleListAssign?.(b.id, listId, isAssigned)}
                  isTrash={activeFilter === "trash"}
                  onRestore={() => onRestoreBookmark?.(b.id)}
                  onPurge={() => onPurgeBookmark?.(b.id)}
                  onHide={() => onHideBookmark?.(b)}
                  onUnhide={() => onUnhideBookmark?.(b.id)}
                />
              ))}
            </motion.div>
            {visibleCount < filteredBookmarks.length && (
              <div className="py-4 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
                <span>Showing {visibleBookmarks.length} of {filteredBookmarks.length} bookmarks (scroll to load more)...</span>
              </div>
            )}
          </>
        )}
      </div>

      <RemoveDeadLinksModal
        open={deadModalOpen}
        scopeFolder={currentFolder}
        folders={folders}
        onClose={() => setDeadModalOpen(false)}
        onSuccess={() => {
          onRefresh?.();
        }}
      />
    </div>
  );
}

function BookmarkCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-card/40 p-3.5 flex flex-col justify-between min-h-[170px] overflow-hidden select-none backdrop-blur-md">
      {/* Shimmer sweep gradient */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer pointer-events-none bg-gradient-to-r from-transparent via-white/[0.07] to-transparent z-10" />

      <div>
        {/* Header: Favicon + Title line + Fav/Pin placeholders */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 flex-1">
            <div className="size-4 rounded-xs bg-white/[0.08] shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-white/[0.08] rounded w-3/4" />
              <div className="h-3 bg-white/[0.04] rounded w-1/2" />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="size-7 rounded-lg bg-white/[0.05]" />
            <div className="size-7 rounded-lg bg-white/[0.05]" />
          </div>
        </div>

        {/* Domain & badge line */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-2.5 bg-primary/20 rounded w-20" />
          <div className="h-2.5 bg-white/[0.05] rounded w-16" />
        </div>

        {/* Summary lines */}
        <div className="space-y-1 mb-2">
          <div className="h-2.5 bg-white/[0.04] rounded w-full" />
          <div className="h-2.5 bg-white/[0.03] rounded w-4/5" />
        </div>
      </div>

      {/* Footer line */}
      <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
        <div className="h-3 bg-white/[0.04] rounded w-14" />
        <div className="flex items-center gap-1">
          <div className="size-7 rounded-lg bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

function BookmarkRowSkeleton() {
  return (
    <div className="relative rounded-lg border border-white/[0.05] bg-card/40 px-3 py-2 flex flex-col justify-center gap-1.5 overflow-hidden select-none min-h-[56px] backdrop-blur-md">
      {/* Shimmer sweep gradient */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer pointer-events-none bg-gradient-to-r from-transparent via-white/[0.07] to-transparent z-10" />

      {/* Top Line */}
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="size-7 rounded-lg bg-white/[0.05] shrink-0" />
          <div className="size-7 rounded-lg bg-white/[0.05] shrink-0" />
          <div className="size-3.5 rounded-xs bg-white/[0.07] shrink-0" />
          <div className="h-3.5 bg-white/[0.08] rounded w-1/3" />
        </div>
        <div className="size-7 rounded-lg bg-white/[0.04] shrink-0" />
      </div>

      {/* Bottom Line */}
      <div className="flex items-center gap-3 pl-7">
        <div className="h-2.5 bg-primary/20 rounded w-24" />
        <div className="h-2.5 bg-white/[0.04] rounded w-16" />
      </div>
    </div>
  );
}

const BookmarkCard = React.memo(function BookmarkCard({
  bookmark,
  folderName,
  accounts = [],
  availableLists = [],
  isSelected,
  onSelect,
  onCopy,
  onOpen,
  onTogglePin,
  onToggleFavorite,
  onDelete,
  onMove: _onMove,
  onTransferAccount,
  onToggleListAssign,
  isTrash = false,
  onRestore,
  onPurge,
  onHide,
  onUnhide,
}: {
  bookmark: Bookmark;
  folderName: string;
  accounts?: BrowserAccount[];
  availableLists?: CustomList[];
  isSelected: boolean;
  onSelect: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onOpen: (e: React.MouseEvent) => void;
  onTogglePin: () => void;
  onToggleFavorite?: () => void;
  onDelete: () => void;
  onMove?: (folderId: string | null) => void;
  onTransferAccount?: (targetAccountId: string, isMove: boolean) => void;
  onToggleListAssign?: (listId: string, isAssigned: boolean) => void;
  isTrash?: boolean;
  onRestore?: () => void;
  onPurge?: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
}) {
  const currentFolderName = folderName;
  const [coverError, setCoverError] = useState(false);
  const hasCover = Boolean(bookmark.cover_image_url && !coverError);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          layout="position"
          transition={pinSpringConfig}
          id={`bookmark-${bookmark.id}`}
          onClick={onSelect}
          draggable
          onDragStart={(e: any) => {
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({ bookmarkId: bookmark.id, title: bookmark.title })
            );
          }}
          className={`group relative rounded-xl border transition-colors cursor-pointer flex flex-col justify-between select-none overflow-hidden ${isSelected
              ? "bg-card/90 border-primary shadow-xs ring-1 ring-primary/40"
              : hasCover
              ? "bg-[#101014] border-white/[0.08] hover:border-white/[0.18] shadow-sm backdrop-blur-md"
              : "bg-card/60 hover:bg-card/85 border-white/[0.06] hover:border-white/[0.14] shadow-xs"
            } ${bookmark.is_hidden ? "opacity-45 hover:opacity-75 grayscale-[30%]" : ""}`}
        >
          {/* Full-card cover image with smooth gradient starting from the full bottom of the card */}
          {hasCover && (
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <img
                src={bookmark.cover_image_url!}
                alt=""
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                onError={() => setCoverError(true)}
              />
              {/* Smooth dark gradient starting from the full bottom (0%) all the way up to top */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(to top, rgba(14,14,18,0.98) 0%, rgba(14,14,18,0.90) 30%, rgba(14,14,18,0.60) 65%, rgba(14,14,18,0.22) 85%, rgba(14,14,18,0.08) 100%)",
                }}
              />
            </div>
          )}

          <div className="relative z-10 p-3.5 flex flex-col justify-between flex-1 min-h-[170px]">
            <div>
              {/* Header: Favicon + Title + Pin */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-start gap-2 min-w-0">
                {bookmark.favicon_url ? (
                  <img
                    src={bookmark.favicon_url}
                    alt=""
                    className="w-4 h-4 rounded mt-0.5 shrink-0 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-4 h-4 rounded bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 uppercase">
                    {bookmark.domain.charAt(0)}
                  </div>
                )}

                <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {bookmark.title}
                </h3>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Pin button - HOVER / PINNED */}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className={cn(
                    "relative z-10 flex size-7 items-center justify-center rounded-lg transition-all cursor-pointer backdrop-blur-md shadow-2xs shrink-0",
                    bookmark.is_pinned
                      ? "bg-amber-500/25 text-amber-400 border border-amber-500/40 opacity-100"
                      : "bg-black/55 hover:bg-black/80 text-white/75 hover:text-amber-400 border border-white/12 hover:border-amber-500/30 opacity-0 group-hover:opacity-100"
                  )}
                  title={bookmark.is_pinned ? "Unpin bookmark" : "Pin bookmark to top"}
                >
                  <motion.div
                    className="flex items-center justify-center shrink-0"
                    initial={false}
                    animate={{
                      rotate: bookmark.is_pinned ? -25 : 0,
                      scale: bookmark.is_pinned ? [1, 1.25, 1] : 1,
                    }}
                    transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  >
                    <Pin className={cn("w-3.5 h-3.5 shrink-0", bookmark.is_pinned ? "fill-amber-400 text-amber-400" : "")} />
                  </motion.div>
                </motion.button>

                {/* Favorite button - FAR RIGHT, ALWAYS VISIBLE */}
                <FavoriteButton
                  isFavorite={!!bookmark.is_favorite}
                  onToggle={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.();
                  }}
                  size="md"
                  variant="frosted"
                />
              </div>
            </div>

            {/* Domain & Folder badge */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground mb-1.5">
              <span className="font-medium text-primary/80 hover:underline">{bookmark.domain}</span>
              <span>•</span>
              <span className="px-1.5 py-0.2 rounded bg-secondary/70 text-muted-foreground text-[10px]">
                {currentFolderName}
              </span>
              {bookmark.is_hidden && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium border border-amber-500/25"
                  title="Hidden bookmark: excluded from search, AI chat, and scraping"
                >
                  <EyeOff className="w-2.5 h-2.5" />
                  <span>Hidden</span>
                </span>
              )}
              {bookmark.reminder_at && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium border border-amber-500/20"
                  title={`Reminder: ${new Date(bookmark.reminder_at).toLocaleString()}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Reminder</span>
                </span>
              )}
              {bookmark.expires_at && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 text-[10px] font-medium border border-red-500/20"
                  title={`Expires: ${new Date(bookmark.expires_at).toLocaleString()}`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  <span>Expires Soon</span>
                </span>
              )}
              {(bookmark.link_status === "DEAD" || bookmark.link_status === "TIMEOUT") && (
                <AnimatedBadge status="danger" size="xs">
                  {bookmark.http_code ? `${bookmark.http_code} ` : ""}DEAD
                </AnimatedBadge>
              )}
              {(bookmark.link_status === "BOT CHECK" || bookmark.link_status === "BOT_CHECK") && (
                <AnimatedBadge status="warning" size="xs">
                  {bookmark.http_code ? `${bookmark.http_code} ` : ""}BOT CHECK
                </AnimatedBadge>
              )}
            </div>

            {/* Multi-Origin Account Badges */}
            {accounts && bookmark.account_ids && bookmark.account_ids.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-2">
                {bookmark.account_ids.map((accId) => {
                  const acc = accounts.find((a) => a.id === accId);
                  if (!acc) return null;
                  return (
                    <span
                      key={acc.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/[0.04] border border-white/[0.06] text-foreground/80"
                      title={`Synced with ${acc.display_name}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: acc.color_dot }} />
                      <span>{acc.display_name}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Scraped summary or description */}
            {bookmark.description || bookmark.scraped_summary ? (
              <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mb-2 leading-relaxed">
                {bookmark.description || bookmark.scraped_summary}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/40 italic mb-2">No summary yet</p>
            )}

            {/* Tags */}
            {bookmark.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-2">
                {bookmark.tags.slice(0, 3).map((t, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-secondary/80 text-muted-foreground font-mono"
                  >
                    #{t}
                  </span>
                ))}
                {bookmark.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{bookmark.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {bookmark.wayback_url && (
                <Tooltip content="Open Internet Archive Wayback Snapshot">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openExternalUrl(bookmark.wayback_url!);
                    }}
                    className="px-2 py-1 rounded-lg bg-black/55 hover:bg-black/80 text-primary text-[10px] font-medium flex items-center gap-1 border border-white/12 backdrop-blur-md shadow-2xs cursor-pointer transition-colors"
                  >
                    <History className="w-3 h-3" /> Wayback
                  </button>
                </Tooltip>
              )}
            </div>

            {isTrash ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={onRestore}
                  className="h-7 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 border border-emerald-500/35 backdrop-blur-md shadow-2xs cursor-pointer transition-colors"
                  title="Restore bookmark"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <NativeDelete
                  size="lg"
                  variant="frosted"
                  onConfirm={() => {}}
                  onDelete={() => onPurge?.()}
                  buttonText="Purge"
                  confirmText="Confirm"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* 1. Open in browser - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip content="Open in browser">
                    <button
                      type="button"
                      onClick={onOpen}
                      className="size-7 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/80 hover:text-white transition-all shadow-2xs cursor-pointer shrink-0"
                      title="Open link in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </Tooltip>
                </div>

                {/* 2. Share - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SharePopover
                    title={bookmark.title}
                    url={bookmark.url}
                    trigger={
                      <button
                        type="button"
                        className="size-7 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/80 hover:text-white transition-all shadow-2xs cursor-pointer shrink-0"
                        title="Share bookmark"
                      >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    }
                  />
                </div>

                {/* 3. Delete - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <NativeDelete
                    size="lg"
                    variant="frosted"
                    onConfirm={() => {}}
                    onDelete={onDelete}
                    buttonText="Delete"
                    confirmText="Confirm"
                  />
                </div>

                {/* 4. Copy - FAR RIGHT, ALWAYS VISIBLE */}
                <div className="shrink-0" title="Copy Clean URL">
                  <CopyButton
                    value={bookmark.clean_url}
                    label="Copy Clean URL"
                    iconOnly
                    variant="outline"
                    className="size-7 rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/85 hover:text-white transition-all shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onOpen}>
          <ExternalLink className="w-4 h-4 mr-2" />
          <span>Open in Browser</span>
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy}>
          <Copy className="w-4 h-4 mr-2" />
          <span>Copy Clean URL</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onTogglePin}>
          <Pin className="w-4 h-4 mr-2" />
          <span>{bookmark.is_pinned ? "Unpin Bookmark" : "Pin Bookmark"}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          <Heart className={cn("w-4 h-4 mr-2", bookmark.is_favorite && "fill-rose-500 text-rose-500")} />
          <span>{bookmark.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
        </ContextMenuItem>
        {bookmark.wayback_url && (
          <ContextMenuItem onClick={() => openExternalUrl(bookmark.wayback_url!)}>
            <History className="w-4 h-4 mr-2 text-primary" />
            <span>Wayback Machine Snapshot</span>
          </ContextMenuItem>
        )}
        {availableLists && availableLists.length > 0 && (
          <>
            <ContextMenuSeparator />
            <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Lists
            </div>
            {availableLists.map((list) => {
              const inList = bookmark.list_ids?.includes(list.id);
              return (
                <ContextMenuCheckboxItem
                  key={list.id}
                  checked={!!inList}
                  onCheckedChange={() => onToggleListAssign?.(list.id, !!inList)}
                >
                  <div className="flex items-center gap-2">
                    {list.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                    )}
                    <span className="truncate">{list.name}</span>
                  </div>
                </ContextMenuCheckboxItem>
              );
            })}
          </>
        )}
        {accounts && accounts.length > 0 && (
          <>
            <ContextMenuSeparator />
            {accounts.map((acc) => (
              <ContextMenuItem
                key={acc.id}
                onClick={() => onTransferAccount?.(acc.id, false)}
              >
                <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: acc.color_dot }} />
                <span>Copy to {acc.display_name}</span>
              </ContextMenuItem>
            ))}
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            if (bookmark.is_hidden) {
              onUnhide?.();
            } else {
              onHide?.();
            }
          }}
        >
          {bookmark.is_hidden ? (
            <>
              <Eye className="w-4 h-4 mr-2 text-amber-400" />
              <span>Unhide Bookmark</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 mr-2 text-amber-400" />
              <span>Hide Bookmark...</span>
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isTrash ? (
          <>
            <ContextMenuItem onClick={onRestore}>
              <RotateCcw className="w-4 h-4 mr-2 text-emerald-400" />
              <span>Restore Bookmark</span>
            </ContextMenuItem>
            <ContextMenuItem tone="destructive" onClick={onPurge}>
              <Trash2 className="w-4 h-4 mr-2 text-destructive" />
              <span>Permanently Delete</span>
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem tone="destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
            <span>Delete Bookmark</span>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

const BookmarkTableRow = React.memo(function BookmarkTableRow({
  bookmark,
  accounts,
  availableLists = [],
  folderName,
  isSelected,
  onSelect,
  onCopy,
  onOpen,
  onTogglePin,
  onToggleFavorite,
  onDelete,
  onTransferAccount,
  onToggleListAssign,
  isTrash = false,
  onRestore,
  onPurge,
  onHide,
  onUnhide,
}: {
  bookmark: Bookmark;
  accounts?: BrowserAccount[];
  availableLists?: CustomList[];
  folderName: string;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onOpen: (e: React.MouseEvent) => void;
  onTogglePin: () => void;
  onToggleFavorite?: () => void;
  onDelete: () => void;
  onTransferAccount?: (targetAccountId: string, isMove: boolean) => void;
  onToggleListAssign?: (listId: string, isAssigned: boolean) => void;
  isTrash?: boolean;
  onRestore?: () => void;
  onPurge?: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
}) {
  const currentFolderName = folderName;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          layout="position"
          transition={pinSpringConfig}
          id={`bookmark-${bookmark.id}`}
          onClick={onSelect}
          draggable
          onDragStart={(e: any) => {
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({ bookmarkId: bookmark.id, title: bookmark.title })
            );
          }}
          className={`group flex flex-col justify-center px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors select-none gap-1.5 ${isSelected
              ? "bg-card/90 border-primary ring-1 ring-primary/40 shadow-xs"
              : "bg-card/50 hover:bg-card/80 border-white/[0.05] hover:border-white/[0.12]"
            } ${bookmark.is_hidden ? "opacity-45 hover:opacity-75 grayscale-[30%]" : ""}`}
        >
          {/* Top Line: Fav/Pin + Favicon + Title (full flex-1 width) + Action buttons */}
          <div className="flex items-center justify-between gap-2 min-w-0 w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-1 shrink-0">
                {/* Pin button - HOVER / PINNED */}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className={cn(
                    "relative z-10 flex size-7 items-center justify-center rounded-lg transition-all cursor-pointer backdrop-blur-md shadow-2xs shrink-0",
                    bookmark.is_pinned
                      ? "bg-amber-500/25 text-amber-400 border border-amber-500/40 opacity-100"
                      : "bg-black/55 hover:bg-black/80 text-white/75 hover:text-amber-400 border border-white/12 hover:border-amber-500/30 opacity-0 group-hover:opacity-100"
                  )}
                  title={bookmark.is_pinned ? "Unpin bookmark" : "Pin bookmark to top"}
                >
                  <motion.div
                    className="flex items-center justify-center shrink-0"
                    initial={false}
                    animate={{
                      rotate: bookmark.is_pinned ? -25 : 0,
                      scale: bookmark.is_pinned ? [1, 1.25, 1] : 1,
                    }}
                    transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  >
                    <Pin className={cn("w-3.5 h-3.5 shrink-0", bookmark.is_pinned ? "fill-amber-400 text-amber-400" : "")} />
                  </motion.div>
                </motion.button>

                {/* Favorite button - FAR RIGHT, ALWAYS VISIBLE */}
                <FavoriteButton
                  isFavorite={!!bookmark.is_favorite}
                  onToggle={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.();
                  }}
                  size="md"
                  variant="frosted"
                />
              </div>

              {bookmark.favicon_url ? (
                <img
                  src={bookmark.favicon_url}
                  alt=""
                  className="w-3.5 h-3.5 rounded-xs object-contain shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}

              <span className="font-semibold text-foreground truncate min-w-0 flex-1" title={bookmark.title}>
                {bookmark.title}
              </span>

              {(bookmark.link_status === "DEAD" || bookmark.link_status === "TIMEOUT") && (
                <AnimatedBadge status="danger" size="xs">
                  {bookmark.http_code ? `${bookmark.http_code} ` : ""}DEAD
                </AnimatedBadge>
              )}
              {(bookmark.link_status === "BOT CHECK" || bookmark.link_status === "BOT_CHECK") && (
                <AnimatedBadge status="warning" size="xs">
                  {bookmark.http_code ? `${bookmark.http_code} ` : ""}BOT CHECK
                </AnimatedBadge>
              )}
            </div>

            {isTrash ? (
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={onRestore}
                  className="h-7 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 border border-emerald-500/35 backdrop-blur-md shadow-2xs cursor-pointer transition-colors"
                  title="Restore bookmark"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <NativeDelete
                  size="lg"
                  variant="frosted"
                  onConfirm={() => {}}
                  onDelete={() => onPurge?.()}
                  buttonText="Purge"
                  confirmText="Confirm"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* 1. Open in browser - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={onOpen}
                    className="size-7 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/80 hover:text-white transition-all shadow-2xs cursor-pointer shrink-0"
                    title="Open link"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>

                {/* 2. Share - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SharePopover
                    title={bookmark.title}
                    url={bookmark.url}
                    trigger={
                      <button
                        type="button"
                        className="size-7 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/80 hover:text-white transition-all shadow-2xs cursor-pointer shrink-0"
                        title="Share bookmark"
                      >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    }
                  />
                </div>

                {/* 3. Delete - HOVER */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <NativeDelete
                    size="lg"
                    variant="frosted"
                    onConfirm={() => { }}
                    onDelete={onDelete}
                    buttonText="Delete"
                    confirmText="Confirm"
                  />
                </div>

                {/* 4. Copy - FAR RIGHT, ALWAYS VISIBLE */}
                <div className="shrink-0" title="Copy Clean URL">
                  <CopyButton
                    value={bookmark.clean_url}
                    label="Copy Clean URL"
                    iconOnly
                    variant="outline"
                    className="size-7 rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-md border border-white/12 hover:border-white/25 text-white/85 hover:text-white transition-all shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Line: Clean URL / Domain + Folder Tag + Profile Tag + Reminders */}
          <div className="flex items-center justify-between gap-2 min-w-0 w-full pl-6 sm:pl-7 text-[11px] text-muted-foreground/70">
            <span
              className="text-[11px] font-mono text-muted-foreground/60 hover:text-foreground/80 truncate min-w-0 flex-1 transition-colors"
              title={bookmark.clean_url}
            >
              {bookmark.clean_url}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Folder Tag */}
              <span
                className="px-1.5 py-0.2 rounded bg-secondary/80 text-muted-foreground text-[10px] shrink-0 truncate max-w-[110px]"
                title={`Folder: ${currentFolderName}`}
              >
                {currentFolderName}
              </span>

              {bookmark.is_hidden && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium border border-amber-500/25 shrink-0"
                  title="Hidden bookmark: excluded from search, AI chat, and scraping"
                >
                  <EyeOff className="w-2.5 h-2.5" />
                  <span>Hidden</span>
                </span>
              )}

              {/* Multi-Origin Account Profile Badges */}
              {accounts && bookmark.account_ids && bookmark.account_ids.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {bookmark.account_ids.map((accId) => {
                    const acc = accounts.find((a) => a.id === accId);
                    if (!acc) return null;
                    return (
                      <span
                        key={acc.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/[0.04] border border-white/[0.06] text-foreground/85"
                        title={`Synced with ${acc.display_name}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: acc.color_dot }} />
                        <span className="max-w-[70px] truncate">{acc.display_name}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Reminder badge */}
              {bookmark.reminder_at && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium border border-amber-500/20 shrink-0"
                  title={`Reminder: ${new Date(bookmark.reminder_at).toLocaleString()}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Reminder</span>
                </span>
              )}

              {/* Expiry badge */}
              {bookmark.expires_at && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 text-[10px] font-medium border border-red-500/20 shrink-0"
                  title={`Expires: ${new Date(bookmark.expires_at).toLocaleString()}`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  <span>Expires</span>
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onOpen}>
          <ExternalLink className="w-4 h-4 mr-2" />
          <span>Open in Browser</span>
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy}>
          <Copy className="w-4 h-4 mr-2" />
          <span>Copy Clean URL</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onTogglePin}>
          <Pin className="w-4 h-4 mr-2" />
          <span>{bookmark.is_pinned ? "Unpin Bookmark" : "Pin Bookmark"}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          <Heart className={cn("w-4 h-4 mr-2", bookmark.is_favorite && "fill-rose-500 text-rose-500")} />
          <span>{bookmark.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
        </ContextMenuItem>
        {bookmark.wayback_url && (
          <ContextMenuItem onClick={() => openExternalUrl(bookmark.wayback_url!)}>
            <History className="w-4 h-4 mr-2 text-primary" />
            <span>Wayback Machine Snapshot</span>
          </ContextMenuItem>
        )}
        {availableLists && availableLists.length > 0 && (
          <>
            <ContextMenuSeparator />
            <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Lists
            </div>
            {availableLists.map((list) => {
              const inList = bookmark.list_ids?.includes(list.id);
              return (
                <ContextMenuCheckboxItem
                  key={list.id}
                  checked={!!inList}
                  onCheckedChange={() => onToggleListAssign?.(list.id, !!inList)}
                >
                  <div className="flex items-center gap-2">
                    {list.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                    )}
                    <span className="truncate">{list.name}</span>
                  </div>
                </ContextMenuCheckboxItem>
              );
            })}
          </>
        )}
        {accounts && accounts.length > 0 && (
          <>
            <ContextMenuSeparator />
            {accounts.map((acc) => (
              <ContextMenuItem
                key={acc.id}
                onClick={() => onTransferAccount?.(acc.id, false)}
              >
                <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: acc.color_dot }} />
                <span>Copy to {acc.display_name}</span>
              </ContextMenuItem>
            ))}
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            if (bookmark.is_hidden) {
              onUnhide?.();
            } else {
              onHide?.();
            }
          }}
        >
          {bookmark.is_hidden ? (
            <>
              <Eye className="w-4 h-4 mr-2 text-amber-400" />
              <span>Unhide Bookmark</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 mr-2 text-amber-400" />
              <span>Hide Bookmark...</span>
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isTrash ? (
          <>
            <ContextMenuItem onClick={onRestore}>
              <RotateCcw className="w-4 h-4 mr-2 text-emerald-400" />
              <span>Restore Bookmark</span>
            </ContextMenuItem>
            <ContextMenuItem tone="destructive" onClick={onPurge}>
              <Trash2 className="w-4 h-4 mr-2 text-destructive" />
              <span>Permanently Delete</span>
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem tone="destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
            <span>Delete Bookmark</span>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
