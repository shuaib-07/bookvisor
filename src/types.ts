export interface ModelTierInfo {
  id: string;
  name: string;
  parameter_size: string;
  download_size: string;
  min_ram_gb: number;
  min_vram_gb: number;
  is_supported: boolean;
  is_recommended: boolean;
  reason: string;
}

export interface SystemSpecs {
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_name: string;
  cpu_cores: number;
  gpu_name: string | null;
  gpu_vram_gb: number | null;
  has_cuda: boolean;
  recommended_tier: string;
  tiers: ModelTierInfo[];
}

export interface Folder {
  id: string;
  parent_id: string | null;
  browser_guid: string | null;
  title: string;
  position: number;
  is_locked: boolean;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_hidden?: boolean;
  bookmark_count?: number;
}

export interface Bookmark {
  id: string;
  folder_id: string | null;
  browser_guid: string | null;
  url: string;
  clean_url: string;
  domain: string;
  title: string;
  description?: string | null;
  user_notes?: string | null;
  cover_image_url?: string | null;
  reminder_at?: string | null;
  expires_at?: string | null;
  scraped_title: string | null;
  scraped_summary: string | null;
  favicon_url: string | null;
  link_status: "LIVE" | "DEAD" | "REDIRECT" | "TIMEOUT" | "UNCHECKED" | "BOT CHECK" | "BOT_CHECK";
  http_code: number | null;
  wayback_url: string | null;
  is_pinned: boolean;
  is_favorite?: boolean;
  is_hidden?: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  account_ids?: string[];
  list_ids?: string[];
}

export interface CustomList {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  bookmark_count?: number;
}

export interface SmartListCounts {
  favorites: number;
  trash: number;
  reminders: number;
}

export interface TagItem {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  created_at: string;
  bookmark_count?: number;
}

export interface ReminderItem {
  id: string;
  bookmark_id: string;
  title: string;
  url: string;
  due_at: string;
  is_delivered: boolean;
  delivered_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
}

export interface DuplicateGroup {
  clean_url: string;
  domain: string;
  count: number;
  bookmarks: Bookmark[];
}

export interface LibraryStats {
  total_bookmarks: number;
  unorganized_count: number;
  dead_links_count: number;
  duplicate_count: number;
  folder_count: number;
  scraped_count: number;
}

export interface ScraperProgress {
  is_running: boolean;
  is_paused: boolean;
  total: number;
  completed: number;
  current_url: string | null;
}

export interface ImportResult {
  total_bookmarks_imported: number;
  total_folders_created: number;
  total_bookmarks_skipped?: number;
}

export interface ProposedFolder {
  name: string;
  description: string;
  subfolders: ProposedFolder[];
}

export interface BookmarkMove {
  bookmark_id: string;
  bookmark_title: string;
  clean_url: string;
  current_folder: string;
  target_folder_path: string;
  suggested_tags: string[];
}

export interface AITaxonomyStrategy {
  id: string;
  name: string;
  description: string;
  proposed_tree: ProposedFolder[];
  moves: BookmarkMove[];
}

export interface AIOrganizationPlan {
  strategies: AITaxonomyStrategy[];
  total_bookmarks_analyzed: number;
  locked_folders_preserved: string[];
}

export interface ModelStatus {
  model_id: string;
  filename: string;
  is_downloaded: boolean;
  file_size_bytes: number;
  expected_size_bytes: number;
}

export interface DownloadProgressEvent {
  model_id: string;
  total_bytes: number;
  downloaded_bytes: number;
  percent: number;
  is_complete: boolean;
  error: string | null;
}

export interface ZenSyncStatus {
  is_running: boolean;
  connected_clients: number;
  port: number;
  connected_browser?: string | null;
}

export interface DetectedBrowser {
  id: string;
  name: string;
  is_available: boolean;
  bookmark_count_estimate: number | null;
  icon_name: string;
}

export type ViewFilter =
  | "all"
  | "unorganized"
  | "dead"
  | "duplicates"
  | "tags"
  | "favorites"
  | "trash"
  | "reminders"
  | "list";
export type DisplayMode = "cards" | "table" | "compact";
export type LayoutMode = "3-pane" | "2-pane" | "tabbed";
export type TabOrientation = "horizontal" | "vertical";

export interface AISearchResult {
  bookmark: Bookmark;
  score: number;
  matched_terms: string[];
  explanation: string;
}

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIChatResponse {
  reply: string;
  relevant_bookmarks: Bookmark[];
  proposed_moves?: BookmarkMove[];
}

export type CloudProviderId = "openai" | "anthropic" | "gemini" | "groq" | "openrouter" | "custom";

export interface CloudAIConfig {
  provider: CloudProviderId;
  api_key: string;
  model: string;
  base_url?: string | null;
}

export interface DefaultBrowserInfo {
  id: string;
  name: string;
  is_available: boolean;
}

export interface SyncDefaultBrowserResult {
  browser_id: string;
  browser_name: string;
  is_live_websocket: boolean;
  imported_count: number;
  skipped_count: number;
  folders_count: number;
}

export interface BrowserAccount {
  id: string;
  browser_type: string;
  profile_folder_name: string;
  display_name: string;
  user_email: string | null;
  color_dot: string;
  icon_name: string;
  bookmarks_file_path: string | null;
  is_active: boolean;
  sync_mode: "live" | "staged" | "manual";
  last_synced_at: string | null;
  created_at: string;
  bookmark_count?: number;
}

export interface DiscoveredProfile {
  id: string;
  browser_type: string;
  profile_folder_name: string;
  display_name: string;
  user_email: string | null;
  avatar_url: string | null;
  bookmarks_file_path: string | null;
  bookmark_count_estimate: number;
  is_connected: boolean;
  suggested_color: string;
}

export interface StagedSyncMutation {
  id: string;
  account_id: string;
  account_name: string | null;
  action_type: "ADD" | "REMOVE" | "MOVE" | "UPDATE";
  bookmark_id: string;
  bookmark_title: string | null;
  bookmark_url: string | null;
  payload_json: string;
  created_at: string;
}

export interface AccountSyncResult {
  account_id: string;
  backup_path: string | null;
  synced_count: number;
  message: string;
}

export interface AIChatSession {
  id: string;
  title: string;
  scope_folder_id: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface AIChatMessageItem {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  cited_bookmarks_json: string | null;
  created_at: string;
}



