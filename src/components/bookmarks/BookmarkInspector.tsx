import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  Pin,
  Tag as TagIcon,
  Globe,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Link2,
  Trash2,
  Sparkles,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  Settings,
  Type,
  Folder as FolderIcon,
  ListFilter,
  Maximize2,
  Activity,
  CheckCircle2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrowserIcon } from "@/components/icons/BrowserIcons";
import { NativeDelete } from "@/components/NativeDelete";
import { AnimatedCombobox } from "@/components/ui/combobox";
import { WysiwygNotesEditor } from "@/components/bookmarks/WysiwygNotesEditor";
import { SharePopover } from "@/components/bookmarks/SharePopover";
import { TagBadge } from "@/components/tags/TagBadge";
import { TagManagerModal } from "@/components/tags/TagManagerModal";
import { EditableRow } from "@/components/ui/inline-edit";
import { CustomTimeModal } from "@/components/ui/custom-time-modal";
import { PreviewLinkCard } from "@/components/ui/preview-link-card";
import { FieldHeader } from "@/components/ui/field-header";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { useToast } from "@/components/ui/animated-toast-stack";
import { api } from "@/lib/api";
import { openExternalUrl } from "@/lib/updater";
import { cn } from "@/lib/utils";
import type { Bookmark, Folder, BrowserAccount, TagItem, CustomList } from "@/types";

interface Props {
  bookmark: Bookmark | null;
  folders: Folder[];
  accounts?: BrowserAccount[];
  onClose: () => void;
  onUpdate: (updated: Bookmark) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleAccountAssign?: (bookmarkId: string, accountId: string, isAssigned: boolean) => void;
}

export function BookmarkInspector({
  bookmark,
  folders,
  accounts = [],
  onClose,
  onUpdate,
  onDelete,
  onTogglePin,
  onToggleAccountAssign,
}: Props) {
  if (!bookmark) return null;

  const { toast } = useToast();
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [description, setDescription] = useState(bookmark.description || bookmark.scraped_summary || "");
  const [userNotes, setUserNotes] = useState(bookmark.user_notes || "");
  const [coverUrl, setCoverUrl] = useState<string | null>(bookmark.cover_image_url || null);
  const [reminderAt, setReminderAt] = useState<string | null>(bookmark.reminder_at || null);
  const [expiresAt, setExpiresAt] = useState<string | null>(bookmark.expires_at || null);
  const [folderId, setFolderId] = useState<string | null>(bookmark.folder_id);
  const [tags, setTags] = useState<string[]>(bookmark.tags || []);
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [customTimeModalState, setCustomTimeModalState] = useState<{
    isOpen: boolean;
    mode: "reminder" | "expiration";
  }>({ isOpen: false, mode: "reminder" });
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allLists, setAllLists] = useState<CustomList[]>([]);
  const [bookmarkListIds, setBookmarkListIds] = useState<string[]>(bookmark.list_ids || []);
  const [linkStatus, setLinkStatus] = useState<string>(bookmark.link_status || "UNCHECKED");
  const [httpCode, setHttpCode] = useState<number | null>(bookmark.http_code ?? null);

  // Handle Escape key for fullscreen cover lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen]);

  useEffect(() => {
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setDescription(bookmark.description || bookmark.scraped_summary || "");
    setUserNotes(bookmark.user_notes || "");
    setCoverUrl(bookmark.cover_image_url || null);
    setReminderAt(bookmark.reminder_at || null);
    setExpiresAt(bookmark.expires_at || null);
    setFolderId(bookmark.folder_id);
    setTags(bookmark.tags || []);
    setBookmarkListIds(bookmark.list_ids || []);
    setLinkStatus(bookmark.link_status || "UNCHECKED");
    setHttpCode(bookmark.http_code ?? null);
  }, [bookmark]);

  const handleSetStatus = async (status: "LIVE" | "DEAD" | "UNCHECKED") => {
    try {
      const code = status === "LIVE" ? 200 : status === "DEAD" ? 404 : 0;
      const updated = await api.setBookmarkStatus(bookmark.id, status, code);
      setLinkStatus(status);
      setHttpCode(code);
      onUpdate(updated);
      toast({
        title: status === "LIVE" ? "Marked as Live" : status === "DEAD" ? "Marked as Dead / Broken" : "Status Reset",
        description: status === "LIVE" ? "Website verified accessible (200 OK)" : "Website marked as unreachable",
        status: status === "LIVE" ? "success" : "info",
      });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: String(err), status: "error" });
    }
  };

  const loadAllTags = async () => {
    try {
      const items = await api.getTags();
      setAllTags(items);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  };

  const loadAllLists = async () => {
    try {
      const lists = await api.getLists();
      setAllLists(lists);
    } catch (err) {
      console.error("Failed to fetch lists:", err);
    }
  };

  useEffect(() => {
    loadAllTags();
    loadAllLists();
  }, []);

  const handleToggleListAssign = async (listId: string, currentAssigned: boolean) => {
    try {
      if (currentAssigned) {
        await api.removeBookmarkFromList(bookmark.id, listId);
        const next = bookmarkListIds.filter((id) => id !== listId);
        setBookmarkListIds(next);
        onUpdate({ ...bookmark, list_ids: next });
        const listName = allLists.find((l) => l.id === listId)?.name || "List";
        toast({ title: "Removed from List", description: listName, status: "info" });
      } else {
        await api.addBookmarkToList(bookmark.id, listId);
        const next = [...bookmarkListIds, listId];
        setBookmarkListIds(next);
        onUpdate({ ...bookmark, list_ids: next });
        const listName = allLists.find((l) => l.id === listId)?.name || "List";
        toast({ title: "Added to List", description: listName, status: "success" });
      }
    } catch (err) {
      console.error("Failed to toggle list membership:", err);
    }
  };

  const handleSaveExtended = async (
    updates: Partial<Bookmark>,
    feedback?: { title: string; description?: string; status?: "success" | "info" }
  ) => {
    const updated: Bookmark = {
      ...bookmark,
      title: updates.title !== undefined ? updates.title : title,
      url: updates.url !== undefined ? updates.url : url,
      description: updates.description !== undefined ? updates.description : description,
      user_notes: updates.user_notes !== undefined ? updates.user_notes : userNotes,
      cover_image_url: updates.cover_image_url !== undefined ? updates.cover_image_url : coverUrl,
      folder_id: updates.folder_id !== undefined ? updates.folder_id : folderId,
      tags: updates.tags !== undefined ? updates.tags : tags,
      reminder_at: updates.reminder_at !== undefined ? updates.reminder_at : reminderAt,
      expires_at: updates.expires_at !== undefined ? updates.expires_at : expiresAt,
    };

    onUpdate(updated);

    try {
      const saved = await api.updateBookmarkExtended({
        id: bookmark.id,
        title: updated.title,
        url: updated.url,
        description: updated.description,
        userNotes: updated.user_notes,
        coverImageUrl: updated.cover_image_url,
        folderId: updated.folder_id,
        tags: updated.tags,
        reminderAt: updated.reminder_at,
        expiresAt: updated.expires_at,
      });

      // Confirm local state matches DB
      setTitle(saved.title);
      setUrl(saved.url);
      setDescription(saved.description || "");
      setUserNotes(saved.user_notes || "");
      setCoverUrl(saved.cover_image_url || null);
      setReminderAt(saved.reminder_at || null);
      setExpiresAt(saved.expires_at || null);
      setFolderId(saved.folder_id);
      setTags(saved.tags || []);
      onUpdate(saved);

      if (feedback) {
        toast(feedback);
      }
    } catch (err: any) {
      console.error("Failed to update bookmark:", err);
      toast({
        title: "Save Failed",
        description: String(err),
        status: "error",
      });
    }
  };

  // Cover image operations
  const handleAutoFetchCover = async () => {
    if (isFetchingCover) return;
    setIsFetchingCover(true);
    try {
      const fetched = await api.fetchWebsiteCover(bookmark.id, bookmark.url);
      const targetUrl =
        fetched ||
        `https://v1.screenshot.11ty.dev/${encodeURIComponent(bookmark.url)}/opengraph/`;

      setCoverUrl(targetUrl);
      await handleSaveExtended(
        { cover_image_url: targetUrl },
        {
          title: "Cover Picture Updated",
          description: fetched
            ? "Website preview fetched successfully"
            : "Generated live website screenshot cover",
          status: "success",
        }
      );
    } catch (err) {
      console.error("Fetch cover error:", err);
      // Fallback on error to the screenshot service
      const fallback = `https://v1.screenshot.11ty.dev/${encodeURIComponent(bookmark.url)}/opengraph/`;
      setCoverUrl(fallback);
      await handleSaveExtended(
        { cover_image_url: fallback },
        {
          title: "Cover Picture Updated",
          description: "Using website screenshot preview",
          status: "info",
        }
      );
    } finally {
      setIsFetchingCover(false);
    }
  };

  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setCoverUrl(base64);
      await api.saveCoverImage(bookmark.id, base64);
      handleSaveExtended(
        { cover_image_url: base64 },
        { title: "Cover Picture Uploaded", description: file.name, status: "success" }
      );
    };
    reader.readAsDataURL(file);
  };

  const handlePasteCoverUrl = async () => {
    const input = window.prompt("Paste image URL (https://...):");
    if (input && input.trim()) {
      const trimmed = input.trim();
      setCoverUrl(trimmed);
      await api.saveCoverImage(bookmark.id, trimmed);
      handleSaveExtended(
        { cover_image_url: trimmed },
        { title: "Cover Picture Updated", status: "success" }
      );
    }
  };

  const handleRemoveCover = async () => {
    setCoverUrl(null);
    await api.saveCoverImage(bookmark.id, "");
    handleSaveExtended(
      { cover_image_url: null },
      { title: "Cover Picture Removed", status: "info" }
    );
  };

  // Expiration presets
  const handleSetExpiration = (hours: number | null) => {
    if (hours === null) {
      setExpiresAt(null);
      handleSaveExtended(
        { expires_at: null },
        { title: "Auto-Expiration Cleared", description: "Bookmark will not expire", status: "info" }
      );
    } else {
      const target = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      setExpiresAt(target);
      const label =
        hours === 24
          ? "24 hours"
          : hours === 72
          ? "3 days"
          : hours === 168
          ? "7 days"
          : hours === 720
          ? "30 days"
          : `${hours} hours`;
      handleSaveExtended(
        { expires_at: target },
        {
          title: "Auto-Expiration Set",
          description: `Expires in ${label} (${new Date(target).toLocaleDateString()})`,
          status: "success",
        }
      );
    }
  };

  // Reminder presets
  const handleSetReminderPreset = (type: "today" | "tomorrow" | "3days" | "week" | "clear") => {
    if (type === "clear") {
      setReminderAt(null);
      handleSaveExtended(
        { reminder_at: null },
        { title: "Reminder Cleared", description: "Scheduled notification removed", status: "info" }
      );
      return;
    }

    let targetDate = new Date();
    let label = "";
    if (type === "today") {
      targetDate.setHours(targetDate.getHours() + 4);
      label = "Later Today";
    } else if (type === "tomorrow") {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(9, 0, 0, 0);
      label = "Tomorrow at 9:00 AM";
    } else if (type === "3days") {
      targetDate.setDate(targetDate.getDate() + 3);
      targetDate.setHours(9, 0, 0, 0);
      label = "In 3 Days";
    } else if (type === "week") {
      targetDate.setDate(targetDate.getDate() + 7);
      targetDate.setHours(9, 0, 0, 0);
      label = "Next Week";
    }

    const iso = targetDate.toISOString();
    setReminderAt(iso);
    handleSaveExtended(
      { reminder_at: iso },
      {
        title: "Reminder Set",
        description: `${label} (${targetDate.toLocaleString()})`,
        status: "success",
      }
    );
  };

  // Build hierarchical folder tree
  const hierarchicalFolders = useMemo(() => {
    const childMap = new Map<string | null, Folder[]>();
    for (const f of folders) {
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

  // Tags
  const handleAddTag = (tagName: string) => {
    const clean = tagName.trim().replace(/^#/, "");
    if (clean && !tags.includes(clean)) {
      const next = [...tags, clean];
      setTags(next);
      handleSaveExtended(
        { tags: next },
        { title: "Tag Added", description: `#${clean}`, status: "success" }
      );
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const next = tags.filter((t) => t !== tagToRemove);
    setTags(next);
    handleSaveExtended(
      { tags: next },
      { title: "Tag Removed", description: `#${tagToRemove}`, status: "info" }
    );
  };

  return (
    <div className="flex flex-col h-full text-xs select-none">
      {/* Top Bar */}
      <div className="p-3 border-b border-border/60 flex items-center justify-between bg-card/40">
        <div className="flex items-center gap-2 font-semibold text-foreground min-w-0">
          {bookmark.favicon_url ? (
            <img
              src={bookmark.favicon_url}
              alt=""
              className="w-4 h-4 rounded-xs object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="truncate">Bookmark Details</span>
        </div>

        <div className="flex items-center gap-1">
          <FavoriteButton
            isFavorite={!!bookmark.is_favorite}
            onToggle={async () => {
              try {
                const nextFav = await api.toggleBookmarkFavorite(bookmark.id);
                onUpdate({ ...bookmark, is_favorite: nextFav });
                toast({
                  title: nextFav ? "Added to Favorites" : "Removed from Favorites",
                  description: bookmark.title,
                  status: nextFav ? "success" : "info",
                });
              } catch (err) {
                console.error("Failed to toggle favorite:", err);
              }
            }}
          />

          <SharePopover title={title} url={url} />

          <button
            onClick={() => {
              onTogglePin(bookmark.id);
              toast({
                title: bookmark.is_pinned ? "Bookmark Unpinned" : "Bookmark Pinned",
                description: bookmark.title,
                status: bookmark.is_pinned ? "info" : "success",
              });
            }}
            title={bookmark.is_pinned ? "Unpin bookmark" : "Pin bookmark"}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
              bookmark.is_pinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${bookmark.is_pinned ? "fill-primary" : ""}`} />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Inspector Scroll Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cover Picture Banner */}
        <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden bg-black/40 group">
          {coverUrl ? (
            <div
              className="relative h-36 w-full overflow-hidden cursor-zoom-in"
              onClick={() => setIsLightboxOpen(true)}
              title="Click to view full screen"
            >
              <img
                src={coverUrl}
                alt="Bookmark Cover"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setCoverUrl(null)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Fullscreen Expand Badge on Hover */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-[10px] text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3 h-3 text-primary" />
                <span>Full Screen</span>
              </div>

              {/* Cover Action Bar on Hover */}
              <div
                className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleAutoFetchCover}
                  disabled={isFetchingCover}
                  title="Re-fetch from website"
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all cursor-pointer"
                >
                  <RefreshCw className={cn("w-3 h-3", isFetchingCover && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  title="Remove cover"
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white backdrop-blur-md transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative py-6 px-4 text-center space-y-2 overflow-hidden">
              {/* Subtle live screenshot preview watermark in background */}
              {bookmark.url && (
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                  <img
                    src={`https://v1.screenshot.11ty.dev/${encodeURIComponent(bookmark.url)}/opengraph/`}
                    alt=""
                    className="w-full h-full object-cover filter blur-[2px] scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#141416]/75 via-[#141416]/90 to-[#141416]" />
                </div>
              )}

              <div className="relative z-10 space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Cover Picture</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fetch website preview or upload your own
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAutoFetchCover}
                    disabled={isFetchingCover}
                    className="h-7 text-[11px] gap-1 cursor-pointer bg-card/60 backdrop-blur-md"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>{isFetchingCover ? "Fetching..." : "Auto-Fetch"}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-[11px] gap-1 cursor-pointer bg-card/60 backdrop-blur-md"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePasteCoverUrl}
                    className="h-7 text-[11px] gap-1 cursor-pointer bg-card/60 backdrop-blur-md"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Paste URL</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadCover}
          />
        </div>

        {/* Website Identity */}
        <PreviewLinkCard
          href={bookmark.url}
          title={bookmark.title}
          coverUrl={bookmark.cover_image_url}
          description={bookmark.description || bookmark.scraped_summary}
          domain={bookmark.domain}
          faviconUrl={bookmark.favicon_url}
          className="w-full"
        >
          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.08] flex items-center gap-3 hover:border-white/[0.14] transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-card border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              {bookmark.favicon_url ? (
                <img
                  src={bookmark.favicon_url}
                  alt={bookmark.domain}
                  className="w-5 h-5 object-contain rounded-xs"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <Globe className="w-5 h-5 text-primary/70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground text-xs truncate">
                {bookmark.domain}
              </div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">
                {bookmark.clean_url}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExternalUrl(bookmark.url);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Open website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </PreviewLinkCard>

        {/* Website Health & Status Section */}
        <div className="space-y-2">
          <FieldHeader
            icon={Activity}
            label="Website Health & Status"
            action={
              bookmark.wayback_url ? (
                <button
                  type="button"
                  onClick={() => openExternalUrl(bookmark.wayback_url!)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                  title="Open Wayback Machine Archive snapshot"
                >
                  <History className="w-2.5 h-2.5" />
                  <span>Wayback Archive</span>
                </button>
              ) : undefined
            }
          />

          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.08] space-y-2.5">
            {/* Status Indicator & HTTP Code */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    linkStatus === "LIVE"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"
                      : linkStatus === "DEAD" || linkStatus === "TIMEOUT"
                      ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                      : linkStatus === "BOT CHECK" || linkStatus === "BOT_CHECK"
                      ? "bg-amber-400"
                      : linkStatus === "REDIRECT"
                      ? "bg-cyan-400"
                      : "bg-muted-foreground/50"
                  )}
                />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-xs font-semibold truncate",
                      linkStatus === "LIVE"
                        ? "text-emerald-400"
                        : linkStatus === "DEAD" || linkStatus === "TIMEOUT"
                        ? "text-red-400"
                        : linkStatus === "BOT CHECK" || linkStatus === "BOT_CHECK"
                        ? "text-amber-400"
                        : linkStatus === "REDIRECT"
                        ? "text-cyan-400"
                        : "text-foreground"
                    )}
                  >
                    {linkStatus === "LIVE"
                      ? "Live & Accessible"
                      : linkStatus === "DEAD"
                      ? "Dead / Broken Link"
                      : linkStatus === "TIMEOUT"
                      ? "Connection Timeout"
                      : linkStatus === "BOT CHECK" || linkStatus === "BOT_CHECK"
                      ? "Bot Check / Challenge"
                      : linkStatus === "REDIRECT"
                      ? "Redirected"
                      : "Unverified Link"}
                  </span>
                  {httpCode != null && httpCode > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-muted-foreground border border-white/[0.08] shrink-0">
                      HTTP {httpCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Segmented Quick Switcher */}
              <div className="inline-flex items-center rounded-lg bg-black/40 border border-white/[0.08] p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetStatus("LIVE")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer",
                    linkStatus === "LIVE"
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Mark as Live & accessible"
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("DEAD")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer",
                    linkStatus === "DEAD" || linkStatus === "TIMEOUT"
                      ? "bg-red-500/20 text-red-300 font-semibold border border-red-500/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Mark as Dead / broken"
                >
                  Dead
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("UNCHECKED")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer",
                    linkStatus === "UNCHECKED"
                      ? "bg-white/10 text-white font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Reset to Unchecked"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-1.5 border-t border-white/[0.06]">
              {linkStatus !== "LIVE" ? (
                <button
                  type="button"
                  onClick={() => handleSetStatus("LIVE")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-medium transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Live</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetStatus("DEAD")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-medium transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Mark as Dead</span>
                </button>
              )}

              {bookmark.wayback_url && (
                <button
                  type="button"
                  onClick={() => openExternalUrl(bookmark.wayback_url!)}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground border border-white/[0.06] text-xs font-medium transition-colors cursor-pointer"
                  title="View cached snapshot on archive.org"
                >
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Archive</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Page Title */}
        <EditableRow
          icon={Type}
          label="Page Title"
          value={title}
          placeholder="Bookmark page title..."
          onSave={(v) => {
            setTitle(v);
            handleSaveExtended(
              { title: v },
              { title: "Title Saved", description: v, status: "success" }
            );
          }}
          compact
        />

        {/* Description */}
        <div className="space-y-1">
          {bookmark.scraped_summary && !bookmark.description && (
            <div className="flex justify-end">
              <span className="text-[10px] text-primary lowercase font-mono">scraped from web</span>
            </div>
          )}
          <EditableRow
            icon={FileText}
            label="Description"
            multiline
            value={description}
            placeholder="Add a custom description or summary..."
            onSave={(v) => {
              setDescription(v);
              handleSaveExtended(
                { description: v },
                { title: "Description Saved", status: "success" }
              );
            }}
            compact
          />
        </div>

        {/* Target URL */}
        <EditableRow
          icon={Link2}
          label="Target URL"
          type="url"
          value={url}
          placeholder="https://..."
          onSave={(v) => {
            setUrl(v);
            handleSaveExtended(
              { url: v },
              { title: "Target URL Saved", description: v, status: "success" }
            );
          }}
          compact
        />

        {/* Rich-Text WYSIWYG Notes Editor */}
        <div className="space-y-1">
          <FieldHeader icon={FileText} label="Bookmark Notes" />
          <WysiwygNotesEditor
            initialContent={userNotes}
            onChange={(html) => {
              setUserNotes(html);
              handleSaveExtended({ user_notes: html });
            }}
            onBlur={(html) => {
              handleSaveExtended(
                { user_notes: html },
                { title: "Notes Saved", description: "Bookmark notes updated", status: "success" }
              );
            }}
          />
        </div>

        {/* Reminders Section */}
        <div className="space-y-2 p-3 rounded-2xl bg-card/60 border border-white/[0.08]">
          <FieldHeader
            icon={Clock}
            label="Reminder"
            action={
              reminderAt ? (
                <button
                  type="button"
                  onClick={() => handleSetReminderPreset("clear")}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  Clear Reminder
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground">No reminder set</span>
              )
            }
          />

          {reminderAt && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Due: {new Date(reminderAt).toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => setCustomTimeModalState({ isOpen: true, mode: "reminder" })}
                className="text-[10px] text-amber-400/80 hover:text-amber-200 underline cursor-pointer shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          )}

          {/* Quick Reminder Chips */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            <button
              type="button"
              onClick={() => handleSetReminderPreset("today")}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              Later Today
            </button>
            <button
              type="button"
              onClick={() => handleSetReminderPreset("tomorrow")}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleSetReminderPreset("3days")}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              In 3 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetReminderPreset("week")}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              Next Week
            </button>
            <button
              type="button"
              onClick={() => setCustomTimeModalState({ isOpen: true, mode: "reminder" })}
              className="px-1 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 text-[10px] font-medium transition-colors cursor-pointer text-center truncate"
            >
              Custom...
            </button>
          </div>
        </div>

        {/* Auto-Expiration Section */}
        <div className="space-y-2 p-3 rounded-2xl bg-card/60 border border-white/[0.08]">
          <FieldHeader
            icon={Calendar}
            label="Auto-Expiration"
            action={
              expiresAt ? (
                <button
                  type="button"
                  onClick={() => handleSetExpiration(null)}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  Clear Expiration
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground">Never expires</span>
              )
            }
          />

          {expiresAt && (
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Expires: {new Date(expiresAt).toLocaleDateString()} (auto-moved to Trash)</span>
              </div>
              <button
                type="button"
                onClick={() => setCustomTimeModalState({ isOpen: true, mode: "expiration" })}
                className="text-[10px] text-primary/80 hover:text-primary underline cursor-pointer shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          )}

          {/* Quick Expiration Chips */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            <button
              type="button"
              onClick={() => handleSetExpiration(24)}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              24 Hours
            </button>
            <button
              type="button"
              onClick={() => handleSetExpiration(72)}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              3 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetExpiration(168)}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetExpiration(720)}
              className="px-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center truncate"
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setCustomTimeModalState({ isOpen: true, mode: "expiration" })}
              className="px-1 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary/90 border border-primary/20 text-[10px] font-medium transition-colors cursor-pointer text-center truncate"
            >
              Custom...
            </button>
          </div>
        </div>

        {/* Folder Selector */}
        <div className="space-y-1">
          <FieldHeader icon={FolderIcon} label="Folder Location" />
          <AnimatedCombobox
            items={[
              { value: "unorganized", label: "Unorganized / Inbox" },
              ...hierarchicalFolders.map(({ folder, path }) => ({
                value: folder.id,
                label: path,
              })),
            ]}
            value={folderId || "unorganized"}
            onChange={(val: string) => {
              const fid = val === "unorganized" ? null : val;
              setFolderId(fid);
              const found = hierarchicalFolders.find((h) => h.folder.id === fid);
              const folderLabel = found ? found.path : "Unorganized / Inbox";
              handleSaveExtended(
                { folder_id: fid },
                { title: "Folder Updated", description: `Moved to ${folderLabel}`, status: "success" }
              );
            }}
            placeholder="Select a folder..."
            searchPlaceholder="Search folders..."
          />
        </div>

        {/* Lists Section */}
        <div className="space-y-2">
          <FieldHeader
            icon={ListFilter}
            label="Lists"
            badge={
              <span className="text-[10px] lowercase text-primary font-mono">
                {bookmarkListIds.length} lists
              </span>
            }
          />
          {allLists.length === 0 ? (
            <div className="p-3 rounded-xl bg-card border border-white/[0.08] text-center text-xs text-muted-foreground/60">
              No custom lists created yet.
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-card border border-white/[0.08] space-y-1">
              {allLists.map((list) => {
                const isAssigned = bookmarkListIds.includes(list.id);
                return (
                  <div
                    key={list.id}
                    onClick={() => handleToggleListAssign(list.id, isAssigned)}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => handleToggleListAssign(list.id, isAssigned)}
                        />
                      </div>
                      {list.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: list.color }}
                        />
                      )}
                      <span className="truncate text-foreground font-medium group-hover:text-primary transition-colors">
                        {list.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Tags Section */}
        <div className="space-y-2">
          <FieldHeader
            icon={TagIcon}
            label="Tags"
            action={
              <button
                type="button"
                onClick={() => {
                  setTagToEdit(null);
                  setIsTagManagerOpen(true);
                }}
                className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Manage Tags</span>
              </button>
            }
          />

          {/* Tag Badges with Color/Icon */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t, i) => {
              const meta = allTags.find((tag) => tag.name.toLowerCase() === t.toLowerCase());
              return (
                <TagBadge
                  key={i}
                  name={t}
                  color={meta?.color}
                  icon={meta?.icon}
                  onIconClick={() => {
                    setTagToEdit(t);
                    setIsTagManagerOpen(true);
                  }}
                  onRemove={() => handleRemoveTag(t)}
                />
              );
            })}
          </div>

          {/* Autocomplete Input */}
          <div className="relative">
            <TagIcon className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Add tag and press Enter..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  e.preventDefault();
                  handleAddTag(newTag);
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-card border border-white/[0.08] focus:border-primary/50 focus:outline-none text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>
        </div>

        {/* Assigned Accounts */}
        {accounts && accounts.length > 0 && (
          <div className="space-y-1.5">
            <FieldHeader
              icon={Globe}
              label="Assigned Browser Accounts"
              badge={
                <span className="text-[10px] lowercase text-primary font-mono">
                  {bookmark.account_ids?.length || 0} connected
                </span>
              }
            />
            <div className="space-y-1.5 p-2 rounded-xl bg-card border border-white/[0.08]">
              {accounts.map((acc) => {
                const isAssigned = bookmark.account_ids?.includes(acc.id) ?? false;
                return (
                  <div
                    key={acc.id}
                    onClick={() => onToggleAccountAssign?.(bookmark.id, acc.id, isAssigned)}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => onToggleAccountAssign?.(bookmark.id, acc.id, isAssigned)}
                        />
                      </div>
                      <BrowserIcon browser={acc.browser_type || acc.icon_name} className="w-3.5 h-3.5 shrink-0" />
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color_dot }}
                      />
                      <span className="truncate text-foreground font-medium group-hover:text-primary transition-colors">
                        {acc.display_name}
                      </span>
                    </div>

                    {acc.user_email && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                        {acc.user_email}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 flex items-center justify-between bg-card/40">
        <NativeDelete
          size="md"
          onConfirm={() => {}}
          onDelete={() => onDelete(bookmark.id)}
          buttonText="Delete Bookmark"
          confirmText="Confirm Delete"
        />

        <Button
          size="sm"
          onClick={() => openExternalUrl(bookmark.url)}
          className="gap-1.5 h-8 text-xs cursor-pointer rounded-xl"
        >
          <span>Open in Browser</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Global Tag Manager Dialog */}
      <TagManagerModal
        isOpen={isTagManagerOpen}
        onClose={() => {
          setIsTagManagerOpen(false);
          setTagToEdit(null);
        }}
        onTagsUpdated={loadAllTags}
        initialTagToEdit={tagToEdit}
      />

      {/* Custom Time Modal for Reminder / Auto-Expiration */}
      <CustomTimeModal
        isOpen={customTimeModalState.isOpen}
        mode={customTimeModalState.mode}
        targetTitle={bookmark.title}
        onClose={() =>
          setCustomTimeModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={(iso) => {
          if (customTimeModalState.mode === "reminder") {
            setReminderAt(iso);
            handleSaveExtended(
              { reminder_at: iso },
              {
                title: "Reminder Set",
                description: `Due: ${new Date(iso).toLocaleString()}`,
                status: "success",
              }
            );
          } else {
            setExpiresAt(iso);
            handleSaveExtended(
              { expires_at: iso },
              {
                title: "Auto-Expiration Set",
                description: `Expires on ${new Date(iso).toLocaleDateString()}`,
                status: "success",
              }
            );
          }
        }}
      />

      {/* Full-Screen Cover Image Lightbox Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isLightboxOpen && coverUrl && (
              <div
                className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-2xl"
                onClick={() => setIsLightboxOpen(false)}
              >
                {/* Top Control Bar */}
                <div
                  className="absolute top-4 right-4 z-20 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openExternalUrl(coverUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md transition-colors cursor-pointer"
                    title="Open original image URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Original</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors cursor-pointer"
                    title="Close (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom title pill */}
                <div className="absolute bottom-5 inset-x-0 mx-auto max-w-lg px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-center text-xs text-white/90 truncate pointer-events-none">
                  {bookmark.title}
                </div>

                {/* High-res Image with Spring Zoom Animation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="relative max-w-6xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={coverUrl}
                    alt={bookmark.title}
                    className="w-auto h-auto max-w-full max-h-[85vh] object-contain select-none"
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
