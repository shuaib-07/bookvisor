import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AIChatMessageItem,
  AIChatSession,
  AIOrganizationPlan,
  Bookmark,
  BookmarkMove,
  DetectedBrowser,
  DownloadProgressEvent,
  DuplicateGroup,
  Folder,
  ImportResult,
  LibraryStats,
  ModelStatus,
  ReminderItem,
  ScraperProgress,
  SystemSpecs,
  TagItem,
  ZenSyncStatus,
} from "@/types";

export const api = {
  // System specs & hardware wizard
  getSystemSpecs: () => invoke<SystemSpecs>("get_system_specs"),

  // Folders
  getFolders: (accountId?: string | null) =>
    invoke<Folder[]>("db_get_folders", { accountId: accountId || null }),
  createFolder: (title: string, parentId?: string | null, color?: string | null, icon?: string | null) =>
    invoke<Folder>("db_create_folder", { title, parentId: parentId || null, color: color || null, icon: icon || null }),
  updateFolder: (id: string, title: string, parentId?: string | null, color?: string | null, icon?: string | null, isLocked: boolean = false) =>
    invoke<void>("db_update_folder", { id, title, parentId: parentId || null, color: color || null, icon: icon || null, isLocked }),
  toggleFolderLock: (id: string) => invoke<boolean>("db_toggle_folder_lock", { id }),
  toggleFolderHidden: (id: string) => invoke<boolean>("db_toggle_folder_hidden", { id }),
  deleteFolder: (id: string) => invoke<void>("db_delete_folder", { id }),

  // Bookmarks
  getBookmarks: (params?: {
    folderId?: string | null;
    search?: string;
    filterStatus?: string;
    filterTag?: string;
    accountId?: string | null;
    listId?: string | null;
    includeHidden?: boolean;
    limit?: number;
    offset?: number;
  }) => invoke<Bookmark[]>("db_get_bookmarks", {
    folderId: params?.folderId || null,
    search: params?.search || null,
    filterStatus: params?.filterStatus || null,
    filterTag: params?.filterTag || null,
    accountId: params?.accountId || null,
    listId: params?.listId || null,
    includeHidden: params?.includeHidden ?? false,
    limit: params?.limit || 300,
    offset: params?.offset || 0,
  }),
  createBookmark: (url: string, title: string, folderId?: string | null, tags?: string[]) =>
    invoke<Bookmark>("db_create_bookmark", { url, title, folderId: folderId || null, tags: tags || [] }),
  updateBookmark: (id: string, title: string, url: string, folderId?: string | null, tags: string[] = [], isPinned: boolean = false) =>
    invoke<void>("db_update_bookmark", { id, title, url, folderId: folderId || null, tags, isPinned }),
  updateBookmarkExtended: (params: {
    id: string;
    title?: string;
    url?: string;
    description?: string | null;
    userNotes?: string | null;
    coverImageUrl?: string | null;
    folderId?: string | null;
    tags?: string[];
    isPinned?: boolean;
    isFavorite?: boolean;
    reminderAt?: string | null;
    expiresAt?: string | null;
  }) =>
    invoke<Bookmark>("db_update_bookmark_extended", {
      id: params.id,
      title: params.title,
      url: params.url,
      description: params.description,
      userNotes: params.userNotes,
      coverImageUrl: params.coverImageUrl,
      folderId: params.folderId,
      tags: params.tags,
      isPinned: params.isPinned,
      isFavorite: params.isFavorite,
      reminderAt: params.reminderAt,
      expiresAt: params.expiresAt,
    }),
  saveCoverImage: (bookmarkId: string, imageData: string) =>
    invoke<string>("db_save_cover_image", { bookmarkId, imageData }),
  fetchWebsiteCover: (bookmarkId: string, url: string) =>
    invoke<string | null>("db_fetch_website_cover", { bookmarkId, url }),

  // Lists & Favoriting System
  toggleBookmarkFavorite: (bookmarkId: string) =>
    invoke<boolean>("db_toggle_bookmark_favorite", { bookmarkId }),
  getLists: () => invoke<import("../types").CustomList[]>("db_get_lists"),
  createList: (name: string, description?: string | null, color?: string | null, icon?: string | null) =>
    invoke<import("../types").CustomList>("db_create_list", {
      name,
      description: description || null,
      color: color || null,
      icon: icon || null,
    }),
  updateList: (id: string, name: string, description?: string | null, color?: string | null, icon?: string | null) =>
    invoke<import("../types").CustomList>("db_update_list", {
      id,
      name,
      description: description || null,
      color: color || null,
      icon: icon || null,
    }),
  deleteList: (id: string) => invoke<void>("db_delete_list", { id }),
  addBookmarkToList: (bookmarkId: string, listId: string) =>
    invoke<void>("db_add_bookmark_to_list", { bookmarkId, listId }),
  removeBookmarkFromList: (bookmarkId: string, listId: string) =>
    invoke<void>("db_remove_bookmark_from_list", { bookmarkId, listId }),
  getBookmarkLists: (bookmarkId: string) =>
    invoke<string[]>("db_get_bookmark_lists", { bookmarkId }),
  emptyTrash: () => invoke<number>("db_empty_trash"),
  restoreBookmark: (bookmarkId: string) =>
    invoke<void>("db_restore_bookmark", { bookmarkId }),
  purgeBookmark: (bookmarkId: string) =>
    invoke<void>("db_purge_bookmark", { bookmarkId }),
  getSmartListCounts: () =>
    invoke<import("../types").SmartListCounts>("db_get_smart_list_counts"),

  // Custom Tags
  getTags: () => invoke<TagItem[]>("db_get_tags"),
  createTag: (name: string, color?: string | null, icon?: string | null) =>
    invoke<TagItem>("db_create_tag", { name, color: color || null, icon: icon || null }),
  updateTag: (id: string, name: string, color?: string | null, icon?: string | null) =>
    invoke<TagItem>("db_update_tag", { id, name, color: color || null, icon: icon || null }),
  deleteTag: (id: string) => invoke<void>("db_delete_tag", { id }),

  // Reminders & Expiration
  getDueReminders: () => invoke<ReminderItem[]>("db_get_due_reminders"),
  dismissReminder: (reminderId: string) => invoke<void>("db_dismiss_reminder", { reminderId }),
  checkExpiredBookmarks: () => invoke<number>("db_check_expired_bookmarks"),
  moveBookmark: (bookmarkId: string, targetFolderId?: string | null) =>
    invoke<void>("db_move_bookmark", { bookmarkId, targetFolderId: targetFolderId || null }),
  deleteBookmark: (id: string) => invoke<void>("db_delete_bookmark", { id }),
  toggleBookmarkPin: (id: string) => invoke<boolean>("db_toggle_bookmark_pin", { id }),
  toggleBookmarkHidden: (id: string) => invoke<boolean>("db_toggle_bookmark_hidden", { id }),
  markBookmarkLive: (bookmarkId: string) =>
    invoke<Bookmark>("db_mark_bookmark_live", { bookmarkId }),
  setBookmarkStatus: (bookmarkId: string, status: string, httpCode?: number) =>
    invoke<Bookmark>("db_set_bookmark_status", { bookmarkId, status, httpCode }),

  // Duplicates & Stats
  getDuplicates: (folderId?: string | null) =>
    invoke<DuplicateGroup[]>("db_get_duplicates", { folderId: folderId || null }),
  mergeDuplicates: (keepId: string, removeIds: string[]) =>
    invoke<void>("db_merge_duplicates", { keepId, removeIds }),
  getDeadLinks: (folderId?: string | null) =>
    invoke<Bookmark[]>("db_get_dead_links", { folderId: folderId || null }),
  deleteBookmarksBatch: (ids: string[]) =>
    invoke<number>("db_delete_bookmarks_batch", { ids }),
  deleteDeadLinks: (folderId?: string | null) =>
    invoke<number>("db_delete_dead_links", { folderId: folderId || null }),
  getLibraryStats: () => invoke<LibraryStats>("db_get_library_stats"),
  resetLibrary: () => invoke<void>("db_reset_library"),
  deleteAllBookmarks: () => invoke<void>("db_delete_all_bookmarks"),
  deleteAllFolders: () => invoke<void>("db_delete_all_folders"),
  deleteEmptyFolders: () => invoke<number>("db_delete_empty_folders"),

  // Import / Export
  importBookmarksHtml: (htmlContent: string) =>
    invoke<ImportResult>("import_bookmarks_html", { htmlContent }),
  exportBookmarksHtml: (replaceDeadWithWayback: boolean = false) =>
    invoke<string>("export_bookmarks_html", { replaceDeadWithWayback }),
  saveFileDialog: (
    defaultName: string,
    content: string,
    filterName: string,
    extension: string
  ) =>
    invoke<string | null>("save_file_dialog", {
      defaultName,
      content,
      filterName,
      extension,
    }),
  importDemoBookmarks: () => invoke<ImportResult>("import_demo_bookmarks"),

  // Scraper Worker
  startBackgroundScrape: (folderId?: string | null, forceAll?: boolean) =>
    invoke<void>("start_background_scrape", { folderId: folderId ?? null, forceAll: forceAll ?? null }),
  checkBookmarkHealth: (bookmarkId: string) =>
    invoke<Bookmark>("check_single_bookmark_health", { bookmarkId }),
  pauseBackgroundScrape: () => invoke<void>("pause_background_scrape"),
  resumeBackgroundScrape: () => invoke<void>("resume_background_scrape"),
  stopBackgroundScrape: () => invoke<void>("stop_background_scrape"),
  onScraperProgress: (cb: (progress: ScraperProgress) => void): Promise<UnlistenFn> =>
    listen<ScraperProgress>("scraper://progress", (event) => cb(event.payload)),

  // AI & Model Management
  checkModelStatus: (modelId: string) => invoke<ModelStatus>("check_model_status", { modelId }),
  downloadModel: (modelId: string) => invoke<void>("download_model", { modelId }),
  cancelModelDownload: () => invoke<void>("cancel_model_download"),
  onModelDownloadProgress: (cb: (progress: DownloadProgressEvent) => void): Promise<UnlistenFn> =>
    listen<DownloadProgressEvent>("model://download_progress", (event) => cb(event.payload)),

  // AI Organization Suite
  aiGeneratePlan: (scopeFolderId?: string | null, userInstruction?: string | null) =>
    invoke<AIOrganizationPlan>("ai_generate_organization_plan", {
      scopeFolderId: scopeFolderId || null,
      userInstruction: userInstruction || null,
    }),
  aiApplyPlan: (moves: BookmarkMove[]) =>
    invoke<number>("ai_apply_organization_plan", { moves }),
  aiSemanticSearch: (query: string, folderId?: string | null, limit?: number) =>
    invoke<import("../types").AISearchResult[]>("ai_semantic_search", {
      query,
      folderId: folderId || null,
      limit: limit || null,
    }),
  aiChatQuery: (
    messages: import("../types").AIChatMessage[],
    folderId?: string | null,
    cloudConfig?: import("../types").CloudAIConfig | null
  ) =>
    invoke<import("../types").AIChatResponse>("ai_chat_query", {
      messages,
      folderId: folderId || null,
      cloudConfig: cloudConfig || null,
    }),
  aiTestCloudConnection: (config: import("../types").CloudAIConfig) =>
    invoke<string>("ai_test_cloud_connection", { config }),
  getAIChatSessions: () => invoke<AIChatSession[]>("db_get_ai_chat_sessions"),
  createAIChatSession: (title: string, scopeFolderId?: string | null, id?: string) =>
    invoke<AIChatSession>("db_create_ai_chat_session", {
      title,
      scopeFolderId: scopeFolderId || null,
      id: id || null,
    }),
  renameAIChatSession: (sessionId: string, newTitle: string) =>
    invoke<void>("db_rename_ai_chat_session", { sessionId, newTitle }),
  deleteAIChatSession: (sessionId: string) =>
    invoke<void>("db_delete_ai_chat_session", { sessionId }),
  getAIChatMessages: (sessionId: string) =>
    invoke<AIChatMessageItem[]>("db_get_ai_chat_messages", { sessionId }),
  saveAIChatMessage: (
    sessionId: string,
    role: string,
    content: string,
    citedBookmarksJson?: string | null
  ) =>
    invoke<AIChatMessageItem>("db_save_ai_chat_message", {
      sessionId,
      role,
      content,
      citedBookmarksJson: citedBookmarksJson || null,
    }),

  // Zen / Chromium Browser WebSocket Bridge & Extension Setup
  zenGetSyncStatus: () => invoke<ZenSyncStatus>("zen_get_sync_status"),
  zenRequestBrowserSync: () => invoke<void>("zen_request_browser_sync"),
  zenPushTreeMutations: (moves: BookmarkMove[]) =>
    invoke<void>("zen_push_tree_mutations", { moves }),
  getExtensionDirectory: (browser?: string) =>
    invoke<string>("get_extension_directory", { browser: browser || null }),
  openExtensionDirectory: (browser?: string) =>
    invoke<string>("open_extension_directory", { browser: browser || null }),
  launchBrowserForExtensionSetup: (browser: string, profileDirectory?: string | null) =>
    invoke<string>("launch_browser_for_extension_setup", {
      browser,
      profileDirectory: profileDirectory || null,
    }),
  launchBrowserWithExtension: (browser: string) =>
    invoke<string>("launch_browser_with_extension", { browser }),
  onZenSyncStatus: (cb: (status: ZenSyncStatus) => void): Promise<UnlistenFn> =>
    listen<ZenSyncStatus>("zen_sync://status", (event) => cb(event.payload)),
  onZenBookmarkAdded: (cb: (data: { url: string; title: string }) => void): Promise<UnlistenFn> =>
    listen<{ url: string; title: string }>("zen_sync://bookmark_added", (event) => cb(event.payload)),
  onZenBookmarkUpdated: (cb: (data: { guid: string }) => void): Promise<UnlistenFn> =>
    listen<{ guid: string }>("zen_sync://bookmark_updated", (event) => cb(event.payload)),
  onZenBookmarkMoved: (cb: (data: { guid: string }) => void): Promise<UnlistenFn> =>
    listen<{ guid: string }>("zen_sync://bookmark_moved", (event) => cb(event.payload)),
  onZenBookmarkRemoved: (cb: (data: { guid: string }) => void): Promise<UnlistenFn> =>
    listen<{ guid: string }>("zen_sync://bookmark_removed", (event) => cb(event.payload)),
  onZenFolderCreated: (cb: (data: { guid: string; title: string }) => void): Promise<UnlistenFn> =>
    listen<{ guid: string; title: string }>("zen_sync://folder_created", (event) => cb(event.payload)),
  onZenTreeImported: (cb: (data: { imported: number; folders: number }) => void): Promise<UnlistenFn> =>
    listen<{ imported: number; folders: number }>("zen_sync://tree_imported", (event) => cb(event.payload)),

  // Browser Detection & 1-Click Import
  detectInstalledBrowsers: () => invoke<DetectedBrowser[]>("detect_installed_browsers"),
  importFromBrowserProfile: (browserId: string) =>
    invoke<ImportResult>("import_from_browser_profile", { browserId }),
  getDefaultBrowser: () => invoke<import("../types").DefaultBrowserInfo>("get_default_browser"),
  syncDefaultBrowser: () => invoke<import("../types").SyncDefaultBrowserResult>("sync_default_browser"),

  // Multi-Browser & Multi-Account Suite
  getAccounts: () => invoke<import("../types").BrowserAccount[]>("db_get_accounts"),
  upsertAccount: (data: {
    id?: string | null;
    browserType: string;
    profileFolderName: string;
    displayName: string;
    userEmail?: string | null;
    colorDot: string;
    iconName: string;
    bookmarksFilePath?: string | null;
    syncMode?: string | null;
  }) => invoke<import("../types").BrowserAccount>("db_upsert_account", data),
  deleteAccount: (accountId: string) => invoke<void>("db_delete_account", { accountId }),
  assignBookmarkToAccount: (bookmarkId: string, accountId: string) =>
    invoke<void>("db_assign_bookmark_to_account", { bookmarkId, accountId }),
  removeBookmarkFromAccount: (bookmarkId: string, accountId: string) =>
    invoke<void>("db_remove_bookmark_from_account", { bookmarkId, accountId }),
  transferBookmarkAccount: (bookmarkId: string, fromAccountId: string, toAccountId: string) =>
    invoke<void>("db_transfer_bookmark_account", { bookmarkId, fromAccountId, toAccountId }),
  batchAssignAccounts: (bookmarkIds: string[], accountId: string, isMove: boolean, fromAccountId?: string | null) =>
    invoke<number>("db_batch_assign_accounts", { bookmarkIds, accountId, isMove, fromAccountId: fromAccountId || null }),
  getStagedMutations: (accountId?: string | null) =>
    invoke<import("../types").StagedSyncMutation[]>("db_get_staged_mutations", { accountId: accountId || null }),
  clearStagedMutations: (accountId?: string | null) =>
    invoke<void>("db_clear_staged_mutations", { accountId: accountId || null }),
  discoverAllBrowserProfiles: () =>
    invoke<import("../types").DiscoveredProfile[]>("discover_all_browser_profiles"),
  connectAndImportProfile: (
    profile: import("../types").DiscoveredProfile,
    customName?: string | null,
    colorDot?: string | null,
    syncMode?: string | null
  ) =>
    invoke<import("../types").BrowserAccount>("connect_and_import_profile", {
      profile,
      customName: customName || null,
      colorDot: colorDot || null,
      syncMode: syncMode || null,
    }),
  syncAccountToBrowser: (accountId: string) =>
    invoke<import("../types").AccountSyncResult>("sync_account_to_browser", { accountId }),
};
