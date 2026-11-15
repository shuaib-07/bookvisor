import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  FileCode,
  FileJson,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Info,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_PANEL } from "@/lib/ease";
import { SplitButton } from "@/components/arc/split-button/split-button";
import { Modal } from "@/components/ui/modal";
import { SettingsView } from "@/components/settings/SettingsView";
import { AboutView } from "@/components/about/AboutView";
import { api } from "@/lib/api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderTreeSidebar } from "@/components/sidebar/FolderTreeSidebar";
import { BookmarkList } from "@/components/bookmarks/BookmarkList";
import { BookmarkInspector } from "@/components/bookmarks/BookmarkInspector";
import { AISidepanel } from "@/components/ai/AISidepanel";
import { EmptyStateDropzone } from "@/components/empty/EmptyStateDropzone";
import { DuplicatesReviewModal } from "@/components/duplicates/DuplicatesReviewModal";
import { ModelSetupWizard } from "@/components/onboarding/ModelSetupWizard";
import { FolderModal } from "@/components/folders/FolderModal";
import { DeleteFolderModal } from "@/components/folders/DeleteFolderModal";
import { BookmarkModal } from "@/components/bookmarks/BookmarkModal";
import { AICategorizeWizardModal } from "@/components/ai/AICategorizeWizardModal";
import { ZenSyncModal } from "@/components/sync/ZenSyncModal";
import { BrowserImportModal } from "@/components/sync/BrowserImportModal";
import { ResetLibraryModal } from "@/components/library/ResetLibraryModal";
import { VaultTabs } from "@/components/workspace/VaultTabs";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { AccountConnectionWizardModal } from "@/components/accounts/AccountConnectionWizardModal";
import { StagedSyncReviewDrawer } from "@/components/accounts/StagedSyncReviewDrawer";
import { HideConfirmationModal } from "@/components/modals/HideConfirmationModal";
import { UpdatePromptModal } from "@/components/about/UpdatePromptModal";
import { checkAppUpdates, getAutoCheckUpdates, type UpdateInfo } from "@/lib/updater";
import { Tooltip } from "@/components/ui/tooltip";
import { FeedbackAction } from "@/components/ui/feedback-action";
import { useToast } from "@/components/ui/animated-toast-stack";
import type { Bookmark, Folder, LibraryStats, ScraperProgress, ViewFilter, ZenSyncStatus, BrowserAccount } from "@/types";

export default function App() {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-Browser & Multi-Account State
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [connectWizardOpen, setConnectWizardOpen] = useState(false);
  const [stagedDrawerOpen, setStagedDrawerOpen] = useState(false);
  const [stagedCount, setStagedCount] = useState(0);

  // Layout & Navigation State
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ViewFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [aiSidepanelOpen, setAiSidepanelOpen] = useState(false);

  // Hidden Bookmarks & Folders State
  const [showHidden, setShowHidden] = useState<boolean>(() => {
    return localStorage.getItem("bookmanage_show_hidden") === "true";
  });
  const [hideTarget, setHideTarget] = useState<{
    isOpen: boolean;
    type: "bookmark" | "folder";
    bookmark?: Bookmark;
    folder?: Folder;
  }>({ isOpen: false, type: "bookmark" });

  // Resizable Sidebars State
  const DEFAULT_LEFT_WIDTH = 260;
  const MIN_LEFT_WIDTH = 200;
  const MAX_LEFT_WIDTH = 440;

  const DEFAULT_INSPECTOR_WIDTH = 420;
  const MIN_INSPECTOR_WIDTH = 340;
  const MAX_INSPECTOR_WIDTH = 640;

  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("bookmanage_left_sidebar_width");
    return saved ? Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, parseInt(saved, 10))) : DEFAULT_LEFT_WIDTH;
  });

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem("bookmanage_inspector_width");
    return saved ? Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, parseInt(saved, 10))) : DEFAULT_INSPECTOR_WIDTH;
  });

  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingInspector, setIsDraggingInspector] = useState(false);

  const handleLeftResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, startWidth + delta));
      setLeftSidebarWidth(newWidth);
    };

    const onPointerUp = () => {
      setIsDraggingLeft(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setLeftSidebarWidth((final) => {
        localStorage.setItem("bookmanage_left_sidebar_width", String(final));
        return final;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleInspectorResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingInspector(true);
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX;
      const newWidth = Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, startWidth + delta));
      setInspectorWidth(newWidth);
    };

    const onPointerUp = () => {
      setIsDraggingInspector(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setInspectorWidth((final) => {
        localStorage.setItem("bookmanage_inspector_width", String(final));
        return final;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Themes: "sefirah" | "deep-blue" | "neutral"
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("bookmanage_theme") || "sefirah");

  // Modals
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
  const [duplicatesScopeFolder, setDuplicatesScopeFolder] = useState<Folder | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bookmarkToEdit, setBookmarkToEdit] = useState<Bookmark | null>(null);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [aiScopeFolder, setAiScopeFolder] = useState<Folder | null>(null);
  const [zenModalOpen, setZenModalOpen] = useState(false);
  const [zenStatus, setZenStatus] = useState<ZenSyncStatus | null>(null);
  const [browserImportModalOpen, setBrowserImportModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<number>(0);
  const [settingsHighlight, setSettingsHighlight] = useState<string | null>(null);

  const handleOpenSettings = (tabIndex: number = 0, highlight?: string) => {
    setSettingsTab(tabIndex);
    setSettingsHighlight(highlight || null);
    setSettingsOpen(true);
  };
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [appUpdateInfo, setAppUpdateInfo] = useState<UpdateInfo | null>(null);

  // Scraper Progress
  const [scraperProgress, setScraperProgress] = useState<ScraperProgress | null>(null);
  const scraperRunningRef = useRef(false);
  const [browserSyncStatus, setBrowserSyncStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [defaultBrowserName, setDefaultBrowserName] = useState("Default Browser");

  // Initial Load & Onboarding Check
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bookmanage_theme", theme);

    const handleStorage = () => {
      const stored = localStorage.getItem("bookmanage_theme") || "sefirah";
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [theme]);

  // Keep a ref to the latest active navigation & filter states to prevent stale closure bugs
  // in background event listeners (scraper progress, websocket updates, etc.)
  const currentViewRef = useRef({
    activeAccountId,
    activeFolderId,
    activeFilter,
    activeTag,
    activeListId,
    searchQuery,
    showHidden,
  });

  currentViewRef.current = {
    activeAccountId,
    activeFolderId,
    activeFilter,
    activeTag,
    activeListId,
    searchQuery,
    showHidden,
  };

  const loadBookmarks = useCallback(
    async (
      folderId: string | null = currentViewRef.current.activeFolderId,
      filter: ViewFilter = currentViewRef.current.activeFilter,
      query: string = currentViewRef.current.searchQuery,
      accountId?: string | null,
      tag?: string | null,
      listId?: string | null
    ) => {
      const view = currentViewRef.current;
      const resolvedAccountId = accountId !== undefined ? accountId : view.activeAccountId;
      const resolvedTag = tag !== undefined ? tag : view.activeTag;
      const resolvedListId = listId !== undefined ? listId : view.activeListId;

      let filterStatus: string | undefined = undefined;
      let actualFolderId: string | null = folderId;
      let targetListId: string | null = null;

      if (filter === "unorganized") {
        actualFolderId = "unorganized";
      } else if (filter === "dead") {
        filterStatus = "dead";
        actualFolderId = null;
      } else if (filter === "favorites") {
        targetListId = "favorites";
        actualFolderId = null;
      } else if (filter === "trash") {
        targetListId = "trash";
        actualFolderId = null;
      } else if (filter === "reminders") {
        targetListId = "reminders";
        actualFolderId = null;
      } else if (filter === "list") {
        targetListId = resolvedListId;
        actualFolderId = null;
      }

      try {
        const bms = await api.getBookmarks({
          folderId: actualFolderId,
          filterStatus,
          search: query.trim() || undefined,
          filterTag: resolvedTag || undefined,
          accountId: resolvedAccountId || null,
          listId: targetListId,
          includeHidden: currentViewRef.current.showHidden,
        });
        setBookmarks(bms);
      } catch (e) {
        console.error("Failed to query bookmarks:", e);
      }
    },
    []
  );

  const loadData = useCallback(
    async (targetAccountId?: string | null) => {
      const view = currentViewRef.current;
      const resolvedAccountId = targetAccountId !== undefined ? targetAccountId : view.activeAccountId;
      try {
        const [foldersData, statsData, accountsData, stagedData] = await Promise.all([
          api.getFolders(resolvedAccountId),
          api.getLibraryStats(),
          api.getAccounts().catch(() => [] as BrowserAccount[]),
          api.getStagedMutations().catch(() => [] as any[]),
        ]);
        setFolders(foldersData);
        setStats(statsData);
        setAccounts(accountsData);
        setStagedCount(stagedData.length);

        // Load bookmarks for current view using the latest state ref
        await loadBookmarks(
          view.activeFolderId,
          view.activeFilter,
          view.searchQuery,
          resolvedAccountId,
          view.activeTag,
          view.activeListId
        );
      } catch (e) {
        console.error("Failed to load initial data:", e);
      } finally {
        setLoading(false);
      }
    },
    [loadBookmarks]
  );

  useEffect(() => {
    loadData();
    api.checkExpiredBookmarks().catch(() => { });

    // Check first-time onboarding
    const onboardingDone = localStorage.getItem("bookmanage_onboarding_done");
    if (!onboardingDone) {
      setSetupWizardOpen(true);
    }

    // Auto-check for GitHub release updates on startup
    if (getAutoCheckUpdates()) {
      setTimeout(async () => {
        try {
          const res = await checkAppUpdates();
          if (res.updateAvailable) {
            setAppUpdateInfo(res);
            toast({
              title: `Update Available: v${res.latestVersion}`,
              description: "Click to download and install the latest BookVisor update.",
              status: "info",
              action: {
                label: "View Update",
                onClick: () => setUpdateModalOpen(true),
              },
            });
          }
        } catch (_) {}
      }, 3500);
    }

    // Scraper event listener
    let unlistenScraper: (() => void) | undefined;
    api.onScraperProgress((p) => {
      const wasRunning = scraperRunningRef.current;
      scraperRunningRef.current = p.is_running;
      setScraperProgress(p);
      if (wasRunning && !p.is_running) {
        loadData();
      }
    }).then((un) => {
      unlistenScraper = un;
    });

    // Browser WebSocket Live Bridge event listeners
    api.zenGetSyncStatus().then((s) => setZenStatus(s)).catch(() => { });
    let unlistenZenStatus: (() => void) | undefined;
    api.onZenSyncStatus((s) => setZenStatus(s)).then((un) => {
      unlistenZenStatus = un;
    });

    let unlistenZenBm: (() => void) | undefined;
    api.onZenBookmarkAdded(() => {
      loadData();
    }).then((un) => {
      unlistenZenBm = un;
    });

    let unlistenZenBmUpdated: (() => void) | undefined;
    api.onZenBookmarkUpdated(() => {
      loadData();
    }).then((un) => {
      unlistenZenBmUpdated = un;
    });

    let unlistenZenBmMoved: (() => void) | undefined;
    api.onZenBookmarkMoved(() => {
      loadData();
    }).then((un) => {
      unlistenZenBmMoved = un;
    });

    let unlistenZenBmRemoved: (() => void) | undefined;
    api.onZenBookmarkRemoved(() => {
      loadData();
    }).then((un) => {
      unlistenZenBmRemoved = un;
    });

    let unlistenZenFolderCreated: (() => void) | undefined;
    api.onZenFolderCreated(() => {
      loadData();
    }).then((un) => {
      unlistenZenFolderCreated = un;
    });

    let unlistenZenTree: (() => void) | undefined;
    api.onZenTreeImported((data) => {
      loadData();
      toast({
        title: "Browser Live Bridge Synced",
        description: `Synced ${data.imported} bookmarks across ${data.folders} folders in real-time!`,
        status: "success",
      });
    }).then((un) => {
      unlistenZenTree = un;
    });

    return () => {
      if (unlistenScraper) unlistenScraper();
      if (unlistenZenStatus) unlistenZenStatus();
      if (unlistenZenBm) unlistenZenBm();
      if (unlistenZenBmUpdated) unlistenZenBmUpdated();
      if (unlistenZenBmMoved) unlistenZenBmMoved();
      if (unlistenZenBmRemoved) unlistenZenBmRemoved();
      if (unlistenZenFolderCreated) unlistenZenFolderCreated();
      if (unlistenZenTree) unlistenZenTree();
    };
  }, []);

  // Keyboard shortcut Ctrl+J or Cmd+J to toggle AI Sidepanel, F11 for Fullscreen
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiSidepanelOpen((v) => !v);
      } else if (e.key === "F11") {
        e.preventDefault();
        try {
          const win = getCurrentWindow();
          const isFull = await win.isFullscreen();
          await win.setFullscreen(!isFull);
        } catch (_) {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search query for 60fps typing fluidity and zero IPC thrashing
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // When folder, filter, account, or debounced search query changes
  useEffect(() => {
    api.getFolders(activeAccountId).then(setFolders).catch(() => { });
    loadBookmarks(activeFolderId, activeFilter, debouncedQuery, activeAccountId, activeTag, activeListId);
  }, [activeFolderId, activeFilter, debouncedQuery, activeAccountId, activeTag, activeListId, showHidden]);

  const handleToggleShowHidden = () => {
    setShowHidden((prev) => {
      const next = !prev;
      localStorage.setItem("bookmanage_show_hidden", String(next));
      toast({
        title: next ? "Hidden Items Revealed" : "Hidden Items Concealed",
        description: next ? "Displaying greyed-out hidden folders & bookmarks." : "Hidden items are now filtered out.",
        status: "info",
      });
      return next;
    });
  };

  const handlePromptHideFolder = (folder: Folder) => {
    setHideTarget({ isOpen: true, type: "folder", folder });
  };

  const handleUnhideFolder = async (folderId: string) => {
    try {
      await api.toggleFolderHidden(folderId);
      toast({ title: "Folder Unhidden", status: "success" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to unhide folder", description: String(err), status: "error" });
    }
  };

  const handlePromptHideBookmark = (bookmark: Bookmark) => {
    setHideTarget({ isOpen: true, type: "bookmark", bookmark });
  };

  const handleUnhideBookmark = async (bookmarkId: string) => {
    try {
      await api.toggleBookmarkHidden(bookmarkId);
      toast({ title: "Bookmark Unhidden", status: "success" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to unhide bookmark", description: String(err), status: "error" });
    }
  };

  const handleConfirmHide = async () => {
    try {
      if (hideTarget.type === "bookmark" && hideTarget.bookmark) {
        await api.toggleBookmarkHidden(hideTarget.bookmark.id);
        toast({ title: "Bookmark Hidden", description: hideTarget.bookmark.title, status: "info" });
      } else if (hideTarget.type === "folder" && hideTarget.folder) {
        await api.toggleFolderHidden(hideTarget.folder.id);
        toast({ title: "Folder Hidden", description: hideTarget.folder.title, status: "info" });
      }
      setHideTarget((prev) => ({ ...prev, isOpen: false }));
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to hide item", description: String(err), status: "error" });
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const nextFav = await api.toggleBookmarkFavorite(id);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, is_favorite: nextFav } : b))
      );
      if (selectedBookmark?.id === id) {
        setSelectedBookmark((prev) => (prev ? { ...prev, is_favorite: nextFav } : null));
      }
      toast({
        title: nextFav ? "Added to Favorites" : "Removed from Favorites",
        status: nextFav ? "success" : "info",
      });
      if (activeFilter === "favorites" && !nextFav) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const count = await api.emptyTrash();
      toast({
        title: "Trash Emptied",
        description: `Permanently removed ${count} bookmarks.`,
        status: "info",
      });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to empty trash", description: String(err), status: "error" });
    }
  };

  const handleRestoreBookmark = async (id: string) => {
    try {
      await api.restoreBookmark(id);
      toast({ title: "Bookmark Restored", status: "success" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to restore bookmark", description: String(err), status: "error" });
    }
  };

  const handlePurgeBookmark = async (id: string) => {
    try {
      await api.purgeBookmark(id);
      toast({ title: "Bookmark Permanently Deleted", status: "info" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to delete bookmark", description: String(err), status: "error" });
    }
  };

  const handleToggleListAssign = async (bookmarkId: string, listId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await api.removeBookmarkFromList(bookmarkId, listId);
        toast({ title: "Removed from List", status: "info" });
      } else {
        await api.addBookmarkToList(bookmarkId, listId);
        toast({ title: "Added to List", status: "success" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to update list", description: String(err), status: "error" });
    }
  };

  // Actions
  const handleDropBookmarkOnAccount = async (
    bookmarkId: string,
    targetAccountId: string,
    isMove: boolean
  ) => {
    try {
      await api.batchAssignAccounts([bookmarkId], targetAccountId, isMove, isMove ? activeAccountId : null);
      const targetAcc = accounts.find((a) => a.id === targetAccountId);
      toast({
        title: isMove ? "Bookmark Moved" : "Bookmark Copied",
        description: `Successfully ${isMove ? "moved" : "copied"} bookmark to ${targetAcc?.display_name || "account"}.`,
        status: "success",
      });
      loadData();
    } catch (err: any) {
      console.error("Failed to assign bookmark to account:", err);
      toast({
        title: "Action Failed",
        description: String(err),
        status: "error",
      });
    }
  };

  const handleTransferBookmarkAccount = async (
    bookmarkId: string,
    targetAccountId: string,
    isMove: boolean
  ) => {
    await handleDropBookmarkOnAccount(bookmarkId, targetAccountId, isMove);
  };

  const handleToggleAccountAssign = async (
    bookmarkId: string,
    accountId: string,
    isAssigned: boolean
  ) => {
    try {
      if (isAssigned) {
        await api.removeBookmarkFromAccount(bookmarkId, accountId);
      } else {
        await api.assignBookmarkToAccount(bookmarkId, accountId);
      }

      // Update selectedBookmark state immediately for instant UI feedback
      if (selectedBookmark && selectedBookmark.id === bookmarkId) {
        const currentAccounts = selectedBookmark.account_ids || [];
        const updatedAccounts = isAssigned
          ? currentAccounts.filter((id) => id !== accountId)
          : [...currentAccounts, accountId];
        setSelectedBookmark({
          ...selectedBookmark,
          account_ids: updatedAccounts,
        });
      }

      const acc = accounts.find((a) => a.id === accountId);
      const name = acc ? acc.display_name : "Browser Account";
      toast({
        title: isAssigned ? "Account Unlinked" : "Account Linked",
        description: `${name} has been ${isAssigned ? "unlinked from" : "linked to"} this bookmark.`,
        status: isAssigned ? "info" : "success",
      });

      loadData();
    } catch (err: any) {
      console.error("Failed to toggle bookmark account assignment:", err);
      toast({
        title: "Assignment Failed",
        description: String(err),
        status: "error",
      });
    }
  };
  const handleTogglePin = async (id: string) => {
    // Optimistic toggle: keep the underlying stable array order,
    // so when unpinned, the item returns to its exact original position.
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, is_pinned: !b.is_pinned } : b))
    );

    try {
      await api.toggleBookmarkPin(id);
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      loadBookmarks(activeFolderId, activeFilter, searchQuery);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    await api.deleteBookmark(id);
    if (selectedBookmark?.id === id) {
      setSelectedBookmark(null);
    }
    loadData();
  };

  const handleMoveBookmark = async (bookmarkId: string, folderId: string | null) => {
    await api.moveBookmark(bookmarkId, folderId);
    loadData();
  };

  const handleToggleFolderLock = async (folderId: string) => {
    await api.toggleFolderLock(folderId);
    loadData();
  };

  const handleSaveFolder = async (_oldName: string | undefined, newName: string, color: string) => {
    if (folderToEdit) {
      await api.updateFolder(folderToEdit.id, newName, folderToEdit.parent_id, color, folderToEdit.icon, folderToEdit.is_locked);
    } else {
      await api.createFolder(newName, parentFolderForNew, color, null);
    }
    setFolderModalOpen(false);
    setFolderToEdit(null);
    setParentFolderForNew(null);
    loadData();
  };

  const handleDeleteFolderConfirm = async () => {
    if (deleteFolderId) {
      await api.deleteFolder(deleteFolderId);
      if (activeFolderId === deleteFolderId) {
        setActiveFolderId(null);
      }
      setDeleteFolderId(null);
      loadData();
    }
  };

  const handleSaveBookmarkModal = async (data: { title: string; url: string; folderId: string | null; tags: string[] }) => {
    if (bookmarkToEdit) {
      await api.updateBookmark(bookmarkToEdit.id, data.title, data.url, data.folderId, data.tags, bookmarkToEdit.is_pinned);
    } else {
      await api.createBookmark(data.url, data.title, data.folderId, data.tags);
    }
    setBookmarkModalOpen(false);
    setBookmarkToEdit(null);
    loadData();
  };

  const handleExport = async (format: "html" | "json" | "csv") => {
    try {
      if (format === "html") {
        const html = await api.exportBookmarksHtml(false);
        const fileName = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`;
        const savedPath = await api.saveFileDialog(fileName, html, "HTML Bookmark File (*.html)", "html");
        if (savedPath) {
          toast({
            title: "Export Succeeded",
            description: `Saved Netscape HTML to ${savedPath.split(/[\\/]/).pop()}`,
            status: "success",
          });
        }
      } else if (format === "json") {
        const [allBookmarks, allFolders] = await Promise.all([
          api.getBookmarks({}),
          api.getFolders(null),
        ]);
        const payload = {
          app: "BookVisor",
          version: "1.0.0",
          exported_at: new Date().toISOString(),
          stats: {
            total_bookmarks: allBookmarks.length,
            total_folders: allFolders.length,
          },
          folders: allFolders,
          bookmarks: allBookmarks,
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const fileName = `bookmarks_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const savedPath = await api.saveFileDialog(fileName, jsonStr, "JSON Backup (*.json)", "json");
        if (savedPath) {
          toast({
            title: "Export Succeeded",
            description: `Saved ${allBookmarks.length} bookmarks to JSON`,
            status: "success",
          });
        }
      } else if (format === "csv") {
        const [allBookmarks, allFolders] = await Promise.all([
          api.getBookmarks({}),
          api.getFolders(null),
        ]);
        const escapeCsv = (val: any) => {
          if (val == null) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };
        const header = ["ID", "Title", "URL", "Clean URL", "Domain", "Folder", "Tags", "Created At", "Description", "Link Status"]
          .map(escapeCsv)
          .join(",");
        const rows = allBookmarks.map((b) => {
          const folderName = allFolders.find((f) => f.id === b.folder_id)?.title || "Root";
          return [
            b.id,
            b.title,
            b.url,
            b.clean_url,
            b.domain,
            folderName,
            (b.tags || []).join("; "),
            b.created_at,
            b.description || b.scraped_summary || "",
            b.link_status || "UNCHECKED",
          ]
            .map(escapeCsv)
            .join(",");
        });
        const csvStr = [header, ...rows].join("\n");
        const fileName = `bookmarks_${new Date().toISOString().slice(0, 10)}.csv`;
        const savedPath = await api.saveFileDialog(fileName, csvStr, "CSV Spreadsheet (*.csv)", "csv");
        if (savedPath) {
          toast({
            title: "Export Succeeded",
            description: `Saved ${allBookmarks.length} rows to CSV`,
            status: "success",
          });
        }
      }
    } catch (e: any) {
      console.error("Export failed:", e);
      toast({
        title: "Export Failed",
        description: String(e),
        status: "error",
      });
    }
  };

  const handleImportHtml = async (htmlContent: string) => {
    setLoading(true);
    try {
      await api.importBookmarksHtml(htmlContent);
      await loadData();
    } catch (e) {
      console.error("Import failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleImportDemo = async () => {
    setLoading(true);
    try {
      await api.importDemoBookmarks();
      await loadData();
    } catch (e) {
      console.error("Demo import failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getDefaultBrowser().then((info) => {
      if (info?.name) {
        setDefaultBrowserName(info.name);
      }
    }).catch(() => { });
  }, []);

  const handleManualSyncDefaultBrowser = async () => {
    setBrowserSyncStatus("loading");
    try {
      const res = await api.syncDefaultBrowser();
      if (res.is_live_websocket) {
        toast({
          status: "info",
          title: "Browser Sync Requested",
          description: `Streaming live bookmarks and folders from ${res.browser_name}...`,
        });
      } else {
        const skippedMsg = res.skipped_count > 0 ? ` (${res.skipped_count} duplicates skipped)` : "";
        toast({
          status: "success",
          title: `Synced with ${res.browser_name}`,
          description: `Imported ${res.imported_count} bookmarks${skippedMsg} across ${res.folders_count} folders.`,
        });
        await loadData();
      }
      setBrowserSyncStatus("success");
      setTimeout(() => setBrowserSyncStatus("idle"), 2500);
    } catch (err: any) {
      setBrowserSyncStatus("error");
      const errorMsg = typeof err === "string" ? err : err?.message || "Failed to sync bookmarks from default browser";
      toast({
        status: "error",
        title: "Browser Sync Failed",
        description: errorMsg,
      });
    }
  };

  const currentFolder = folders.find((f) => f.id === activeFolderId) || null;
  const isLibraryEmpty = (stats?.total_bookmarks ?? 0) === 0;

  return (
    <div className="flex flex-col h-screen w-screen p-2 gap-2 bg-transparent text-foreground overflow-hidden select-none relative">
      {/* Top Application Header Bar */}
      <header className="h-11 px-3 border border-white/[0.06] bg-card/60 backdrop-blur-md rounded-xl flex items-center justify-between shrink-0 shadow-xs z-20">
        {/* Left: Window title & Sidebar toggle */}
        <div className="flex items-center gap-2">
          <Tooltip content={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="size-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground transition-colors cursor-pointer"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </Tooltip>

          <div className="flex items-center gap-2 pl-1">
            <img
              src="/bookmarked.png"
              alt="BookVisor"
              className="w-6 h-6 object-contain shrink-0 select-none"
            />
            <span className="font-semibold text-xs text-foreground tracking-wide">
              BookVisor <span className="text-[10px] text-muted-foreground font-normal">v0.1.0</span>
            </span>
          </div>
        </div>

        {/* Center: Quick Stats indicator */}
        <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats?.total_bookmarks ?? 0}</strong> Bookmarks
          </span>
          <span>•</span>
          <span>
            <strong className="text-foreground">{stats?.folder_count ?? 0}</strong> Folders
          </span>
          {(stats?.duplicate_count ?? 0) > 0 && (
            <>
              <span>•</span>
              <button
                onClick={() => {
                  setDuplicatesScopeFolder(null);
                  setDuplicatesModalOpen(true);
                }}
                className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{stats?.duplicate_count} Duplicates</span>
              </button>
            </>
          )}
        </div>

        {/* Right: Actions, Clusters, Controls */}
        <div className="flex items-center gap-2">
          {/* Cluster 1: Primary Action & Sync */}
          <div className="flex items-center gap-1.5">
            <FeedbackAction
              status={browserSyncStatus}
              idleMessage={defaultBrowserName ? `Sync ${defaultBrowserName}` : "Sync Browser"}
              loadingMessage="Syncing..."
              errorMessage="Sync Failed"
              successMessage="Synced!"
              onRetry={handleManualSyncDefaultBrowser}
              size="sm"
            />
          </div>

          {/* Hairline Divider */}
          <div className="w-[1px] h-4 bg-white/[0.1] mx-0.5" />

          {/* Cluster 2: Notifications & Netscape Export */}
          <div className="flex items-center gap-1.5">
            <NotificationCenter
              onOpenBookmark={(bookmarkId) => {
                const found = bookmarks.find((b) => b.id === bookmarkId);
                if (found) {
                  setSelectedBookmark(found);
                  setInspectorOpen(true);
                }
              }}
            />

            <SplitButton
              label="Export"
              icon={<Download size={14} strokeWidth={2} />}
              onClick={() => handleExport("html")}
              actions={[
                {
                  label: "Netscape HTML (.html)",
                  icon: <FileCode className="w-3.5 h-3.5 text-orange-400" />,
                  onSelect: () => handleExport("html"),
                },
                {
                  label: "JSON Backup (.json)",
                  icon: <FileJson className="w-3.5 h-3.5 text-cyan-400" />,
                  onSelect: () => handleExport("json"),
                },
                {
                  label: "CSV Spreadsheet (.csv)",
                  icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />,
                  onSelect: () => handleExport("csv"),
                },
              ]}
            />
          </div>

          {/* Hairline Divider */}
          <div className="w-[1px] h-4 bg-white/[0.1] mx-0.5" />

          {/* Cluster 3: Settings & About */}
          <div className="flex items-center gap-1.5">
            <Tooltip content="Settings & Preferences">
              <button
                onClick={() => handleOpenSettings(0)}
                className="size-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content="About BookVisor">
              <button
                onClick={() => setAboutOpen(true)}
                className="size-8 flex items-center justify-center rounded-lg border border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {/* Hairline Divider */}
          <div className="w-[1px] h-4 bg-white/[0.1] mx-0.5" />

          {/* Cluster 4: AI Sidepanel & Inspector Toggles */}
          <div className="flex items-center gap-1.5">
            <Tooltip content={aiSidepanelOpen ? "Hide AI Assistant (Ctrl+J)" : "AI Assistant & Semantic Search (Ctrl+J)"}>
              <button
                onClick={() => setAiSidepanelOpen((v) => !v)}
                className={cn(
                  "size-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer",
                  aiSidepanelOpen
                    ? "bg-primary/20 text-primary border-primary/40 shadow-xs"
                    : "border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground"
                )}
              >
                <Bot className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content={inspectorOpen ? "Hide Inspector" : "Show Inspector"}>
              <button
                onClick={() => setInspectorOpen((v) => !v)}
                className={cn(
                  "size-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer",
                  inspectorOpen
                    ? "bg-primary/20 text-primary border-primary/40 shadow-xs"
                    : "border-white/[0.08] bg-card/60 backdrop-blur-md hover:bg-secondary/80 hover:text-foreground hover:border-white/[0.15] text-muted-foreground"
                )}
              >
                {inspectorOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Workspace: Floating Rounded-Box Layout */}
      <div className={cn("flex-1 flex min-w-0 min-h-0 gap-2 overflow-hidden", (isDraggingLeft || isDraggingInspector) && "select-none cursor-col-resize")}>
        {/* Left Pane: Collapsible Folder Tree */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="folder-tree-sidebar"
              initial={{ width: 0, opacity: 0, borderColor: "transparent" }}
              animate={{ width: leftSidebarWidth, opacity: 1, borderColor: "rgba(255, 255, 255, 0.06)" }}
              exit={{ width: 0, opacity: 0, borderColor: "transparent" }}
              transition={isDraggingLeft ? { duration: 0 } : SPRING_PANEL}
              className="relative border bg-card/60 backdrop-blur-md rounded-xl shrink-0 flex flex-col overflow-hidden shadow-xs select-text"
              style={{ minWidth: 0 }}
            >
              <div style={{ width: leftSidebarWidth }} className="h-full flex flex-col shrink-0 overflow-hidden">
                <FolderTreeSidebar
                  folders={folders}
                  activeFolderId={activeFolderId}
                  activeFilter={activeFilter}
                  stats={stats}
                  activeAccountId={activeAccountId}
                  activeAccount={accounts.find((a) => a.id === activeAccountId) || null}
                  activeTag={activeTag}
                  activeListId={activeListId}
                  onSelectTag={(tag) => {
                    setActiveTag(tag);
                    loadBookmarks(activeFolderId, activeFilter, searchQuery, activeAccountId, tag, activeListId);
                  }}
                  onSelectFolder={(fid) => {
                    setActiveFolderId(fid);
                    setActiveFilter("all");
                    setActiveTag(null);
                    setActiveListId(null);
                    loadBookmarks(fid, "all", searchQuery, activeAccountId, null, null);
                  }}
                  onSelectFilter={(filter) => {
                    setActiveFilter(filter);
                    setActiveFolderId(null);
                    setActiveListId(null);
                    setActiveTag(null);
                    if (filter === "duplicates") {
                      setDuplicatesScopeFolder(null);
                      setDuplicatesModalOpen(true);
                    } else {
                      loadBookmarks(null, filter, searchQuery, activeAccountId, null, null);
                    }
                  }}
                  onSelectList={(lid) => {
                    setActiveListId(lid);
                    setActiveFilter(lid ? "list" : "all");
                    setActiveFolderId(null);
                    setActiveTag(null);
                    loadBookmarks(null, lid ? "list" : "all", searchQuery, activeAccountId, null, lid);
                  }}
                  onNewFolder={(parentId) => {
                    setParentFolderForNew(parentId || null);
                    setFolderToEdit(null);
                    setFolderModalOpen(true);
                  }}
                  onEditFolder={(f) => {
                    setFolderToEdit(f);
                    setFolderModalOpen(true);
                  }}
                  onDeleteFolder={(fid) => setDeleteFolderId(fid)}
                  onToggleLock={handleToggleFolderLock}
                  onOpenAIDeepDive={(f) => {
                    setAiScopeFolder(f);
                    setAiWizardOpen(true);
                  }}
                  onScrapeFolder={(fid, force) => api.startBackgroundScrape(fid, force)}
                  onNewBookmark={() => {
                    setBookmarkToEdit(null);
                    setBookmarkModalOpen(true);
                  }}
                  onOpenAICategorize={(f) => {
                    setAiScopeFolder(f || null);
                    setAiWizardOpen(true);
                  }}
                  onOpenConnectWizard={() => setConnectWizardOpen(true)}
                  onSyncDefaultBrowser={handleManualSyncDefaultBrowser}
                  showHidden={showHidden}
                  onHideFolder={handlePromptHideFolder}
                  onUnhideFolder={handleUnhideFolder}
                />
              </div>

              {/* Resize Handle on Right Edge */}
              <div
                onPointerDown={handleLeftResizeStart}
                onDoubleClick={() => {
                  setLeftSidebarWidth(DEFAULT_LEFT_WIDTH);
                  localStorage.setItem("bookmanage_left_sidebar_width", String(DEFAULT_LEFT_WIDTH));
                }}
                className="group absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center hover:bg-primary/20 active:bg-primary/40 transition-colors select-none"
                title="Drag to resize sidebar (double-click to reset)"
              >
                <div className="w-[2px] h-8 rounded-full bg-white/20 group-hover:bg-primary group-hover:h-12 transition-all" />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center Pane: Bookmark Canvas */}
        <main className="flex-1 flex flex-col min-w-0 border border-white/[0.06] bg-card/60 backdrop-blur-md rounded-xl overflow-hidden shadow-xs">
          <VaultTabs
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelectAccount={(id) => setActiveAccountId(id)}
            onOpenConnectWizard={() => setConnectWizardOpen(true)}
            onOpenStagedDrawer={() => setStagedDrawerOpen(true)}
            stagedCount={stagedCount}
            onDropBookmarkOnAccount={handleDropBookmarkOnAccount}
          />
          {isLibraryEmpty ? (
            <EmptyStateDropzone
              onImportHtml={handleImportHtml}
              onImportDemo={handleImportDemo}
              onBrowserImportSuccess={() => loadData()}
              loading={loading}
              onOpenSettings={handleOpenSettings}
            />
          ) : (
            <BookmarkList
              bookmarks={bookmarks}
              folders={folders}
              accounts={accounts}
              currentFolder={currentFolder}
              activeFilter={activeFilter}
              activeListId={activeListId}
              filterTitle={
                activeFilter === "unorganized"
                  ? "Unorganized / Inbox"
                  : activeFilter === "dead"
                    ? "Dead Links"
                    : activeFilter === "favorites"
                      ? "Favorites"
                      : activeFilter === "trash"
                        ? "Expired & Trash"
                        : activeFilter === "reminders"
                          ? "Reminders & Expiring"
                          : activeFilter === "list"
                            ? "List"
                            : currentFolder
                              ? currentFolder.title
                              : "All Bookmarks"
              }
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedBookmarkId={selectedBookmark?.id || null}
              onSelectBookmark={(b) => setSelectedBookmark(b)}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onDeleteBookmark={handleDeleteBookmark}
              onMoveBookmark={handleMoveBookmark}
              onToggleListAssign={handleToggleListAssign}
              onEmptyTrash={handleEmptyTrash}
              onRestoreBookmark={handleRestoreBookmark}
              onPurgeBookmark={handlePurgeBookmark}
              onNewBookmark={() => {
                setBookmarkToEdit(null);
                setBookmarkModalOpen(true);
              }}
              onOpenAICategorize={(f) => {
                setAiScopeFolder(f);
                setAiWizardOpen(true);
              }}
              onSelectFolder={(fid) => {
                setActiveFolderId(fid);
                setActiveFilter("all");
              }}
              onOpenDuplicates={(f) => {
                setDuplicatesScopeFolder(f);
                setDuplicatesModalOpen(true);
              }}
              onTransferBookmarkAccount={handleTransferBookmarkAccount}
              onRefresh={() => loadData()}
              scraperProgress={scraperProgress}
              onStartScrape={() => api.startBackgroundScrape(currentFolder?.id || null)}
              onPauseScrape={() => api.pauseBackgroundScrape()}
              onResumeScrape={() => api.resumeBackgroundScrape()}
              onStopScrape={() => api.stopBackgroundScrape()}
              showHidden={showHidden}
              onToggleShowHidden={handleToggleShowHidden}
              onHideBookmark={handlePromptHideBookmark}
              onUnhideBookmark={handleUnhideBookmark}
            />
          )}
        </main>

        {/* Right Pane: Bookmark Inspector Drawer */}
        <AnimatePresence initial={false}>
          {inspectorOpen && selectedBookmark && !isLibraryEmpty && (
            <motion.aside
              key="bookmark-inspector-drawer"
              initial={{ width: 0, opacity: 0, borderColor: "transparent" }}
              animate={{ width: inspectorWidth, opacity: 1, borderColor: "rgba(255, 255, 255, 0.06)" }}
              exit={{ width: 0, opacity: 0, borderColor: "transparent" }}
              transition={isDraggingInspector ? { duration: 0 } : SPRING_PANEL}
              className="relative border bg-card/60 backdrop-blur-md rounded-xl shrink-0 flex flex-col overflow-hidden shadow-xs select-text"
              style={{ minWidth: 0 }}
            >
              {/* Resize Handle on Left Edge */}
              <div
                onPointerDown={handleInspectorResizeStart}
                onDoubleClick={() => {
                  setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);
                  localStorage.setItem("bookmanage_inspector_width", String(DEFAULT_INSPECTOR_WIDTH));
                }}
                className="group absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 flex items-center justify-center hover:bg-primary/20 active:bg-primary/40 transition-colors select-none"
                title="Drag to resize inspector (double-click to reset)"
              >
                <div className="w-[2px] h-8 rounded-full bg-white/20 group-hover:bg-primary group-hover:h-12 transition-all" />
              </div>

              <div style={{ width: inspectorWidth }} className="h-full flex flex-col shrink-0 overflow-hidden">
                <BookmarkInspector
                  bookmark={selectedBookmark}
                  folders={folders}
                  accounts={accounts}
                  onClose={() => setSelectedBookmark(null)}
                  onUpdate={(updated) => {
                    setSelectedBookmark(updated);
                    setBookmarks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                  }}
                  onDelete={handleDeleteBookmark}
                  onTogglePin={handleTogglePin}
                  onToggleAccountAssign={handleToggleAccountAssign}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Right Pane: AI Assistant & Semantic Search Drawer */}
        <AnimatePresence initial={false}>
          {aiSidepanelOpen && (
            <motion.aside
              key="ai-sidepanel-drawer"
              initial={{ width: 0, opacity: 0, borderColor: "transparent" }}
              animate={{ width: 384, opacity: 1, borderColor: "rgba(255, 255, 255, 0.06)" }}
              exit={{ width: 0, opacity: 0, borderColor: "transparent" }}
              transition={SPRING_PANEL}
              className="border bg-card/60 backdrop-blur-md rounded-xl shrink-0 flex flex-col overflow-hidden shadow-xs select-text"
              style={{ minWidth: 0 }}
            >
              <AISidepanel
                isOpen={aiSidepanelOpen}
                onClose={() => setAiSidepanelOpen(false)}
                currentFolder={currentFolder}
                onLocateBookmark={(b) => {
                  if (b.folder_id) {
                    setActiveFolderId(b.folder_id);
                    setActiveFilter("all");
                  } else {
                    setActiveFolderId(null);
                    setActiveFilter("unorganized");
                  }
                  setSelectedBookmark(b);
                  setTimeout(() => {
                    const el = document.getElementById(`bookmark-${b.id}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 120);
                }}
                onTogglePin={handleTogglePin}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <ModelSetupWizard
        open={setupWizardOpen}
        onClose={() => setSetupWizardOpen(false)}
      />

      <DuplicatesReviewModal
        open={duplicatesModalOpen}
        folders={folders}
        scopeFolder={duplicatesScopeFolder}
        onClose={() => {
          setDuplicatesModalOpen(false);
          setDuplicatesScopeFolder(null);
        }}
        onRefresh={() => loadData()}
      />

      <FolderModal
        isOpen={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false);
          setFolderToEdit(null);
          setParentFolderForNew(null);
        }}
        folderName={folderToEdit?.title}
        existingFolders={folders.map((f) => f.title)}
        onSave={handleSaveFolder}
      />

      <DeleteFolderModal
        isOpen={Boolean(deleteFolderId)}
        onClose={() => setDeleteFolderId(null)}
        folderName={folders.find((f) => f.id === deleteFolderId)?.title || "this folder"}
        bookmarkCount={
          folders.find((f) => f.id === deleteFolderId)?.bookmark_count ?? 0
        }
        onConfirm={handleDeleteFolderConfirm}
      />

      <BookmarkModal
        open={bookmarkModalOpen}
        folders={folders}
        initialFolderId={activeFolderId}
        bookmarkToEdit={bookmarkToEdit}
        onClose={() => {
          setBookmarkModalOpen(false);
          setBookmarkToEdit(null);
        }}
        onSave={handleSaveBookmarkModal}
      />

      <AICategorizeWizardModal
        open={aiWizardOpen}
        scopeFolder={aiScopeFolder}
        onClose={() => {
          setAiWizardOpen(false);
          setAiScopeFolder(null);
        }}
        onSuccess={() => loadData()}
      />

      <ZenSyncModal
        open={zenModalOpen}
        status={zenStatus}
        onClose={() => setZenModalOpen(false)}
        onTriggerSync={() => loadData()}
      />

      <BrowserImportModal
        open={browserImportModalOpen}
        onClose={() => setBrowserImportModalOpen(false)}
        onImportSuccess={() => loadData()}
        onOpenSettings={handleOpenSettings}
      />

      <AccountConnectionWizardModal
        open={connectWizardOpen}
        onClose={() => setConnectWizardOpen(false)}
        onAccountConnected={() => loadData()}
      />

      <StagedSyncReviewDrawer
        isOpen={stagedDrawerOpen}
        onClose={() => setStagedDrawerOpen(false)}
        accounts={accounts}
        onSyncComplete={() => loadData()}
      />

      <ResetLibraryModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onSuccess={() => {
          setSelectedBookmark(null);
          setActiveFolderId(null);
          setActiveAccountId(null);
          setActiveListId(null);
          setActiveTag(null);
          setActiveFilter("all");
          loadData();
          setSettingsOpen(false);
          toast({
            title: "Library Reset",
            description: "Your library has been successfully reset to a clean state.",
            status: "success",
          });
        }}
        stats={stats}
      />

      <HideConfirmationModal
        isOpen={hideTarget.isOpen}
        type={hideTarget.type}
        title={
          hideTarget.type === "bookmark"
            ? hideTarget.bookmark?.title || "Untitled Bookmark"
            : hideTarget.folder?.title || "Untitled Folder"
        }
        subtitle={
          hideTarget.type === "bookmark"
            ? hideTarget.bookmark?.clean_url || hideTarget.bookmark?.url
            : undefined
        }
        bookmarkCount={
          hideTarget.type === "folder" ? hideTarget.folder?.bookmark_count : undefined
        }
        onClose={() => setHideTarget((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmHide}
      />

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="max-w-4xl">
        <SettingsView
          onClose={() => setSettingsOpen(false)}
          initialTabId={settingsTab}
          highlightSection={settingsHighlight}
          onOpenModelSetup={() => {
            setSettingsOpen(false);
            setSetupWizardOpen(true);
          }}
          onOpenBrowserImport={() => {
            setSettingsOpen(false);
            setBrowserImportModalOpen(true);
          }}
          onOpenResetLibrary={() => {
            setResetModalOpen(true);
          }}
          onRefreshData={() => {
            setSelectedBookmark(null);
            setActiveFolderId(null);
            loadData();
          }}
        />
      </Modal>

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} maxWidth="max-w-4xl">
        <AboutView onClose={() => setAboutOpen(false)} />
      </Modal>

      <UpdatePromptModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={appUpdateInfo}
      />
    </div>
  );
}
