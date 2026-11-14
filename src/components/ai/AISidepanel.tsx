import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Search,
  Send,
  ExternalLink,
  Compass,
  Pin,
  Bot,
  User,
  Layers,
  Globe,
  Loader2,
  AlertCircle,
  Plus,
  History,
  Trash2,
  MessageSquare,
  Clock,
  Edit2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { api } from "@/lib/api";
import { openExternalUrl } from "@/lib/updater";
import { PreviewLinkCard } from "@/components/ui/preview-link-card";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { Bookmark, Folder, AISearchResult, AIChatMessage, AIChatSession } from "@/types";

interface AISidepanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolder: Folder | null;
  onLocateBookmark: (bookmark: Bookmark) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

const QUICK_PROMPT_PILLS = [
  "PDF editing tools",
  "Anime streaming sites",
  "UI component libraries",
  "Video downloaders",
  "Icon & graphic packs",
  "Developer documentation",
  "Free online converters",
];

const DEFAULT_WELCOME_MESSAGE: AIChatMessage & { citedBookmarks?: Bookmark[] } = {
  role: "assistant",
  content:
    "Hello! I am your AI BookVisor assistant. You can ask me to find any website, tool, or resource from your bookmarks using natural language (e.g. *\"Find a pdf editing tool from my bookmarks\"*).",
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

export function AISidepanel({
  isOpen,
  onClose,
  currentFolder,
  onLocateBookmark,
  onTogglePin,
}: AISidepanelProps) {
  const [activeTab, setActiveTab] = useState<"search" | "chat">("search");
  const [scopeToFolder, setScopeToFolder] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AISearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chat Sessions & History state
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem("bookmanage_active_chat_session_id") || null;
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState("");

  // Chat Messages state
  const [chatMessages, setChatMessages] = useState<
    Array<AIChatMessage & { citedBookmarks?: Bookmark[] }>
  >([DEFAULT_WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Active folder ID for queries
  const effectiveFolderId = scopeToFolder && currentFolder ? currentFolder.id : null;

  // Load chat sessions from SQLite
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getAIChatSessions();
      setSessions(data);
      return data;
    } catch (err) {
      console.error("Failed to load chat sessions:", err);
      return [];
    }
  }, []);

  // Load messages for a given session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await api.getAIChatMessages(sessionId);
      if (msgs.length === 0) {
        setChatMessages([DEFAULT_WELCOME_MESSAGE]);
      } else {
        setChatMessages(
          msgs.map((m) => {
            let cited: Bookmark[] | undefined = undefined;
            if (m.cited_bookmarks_json) {
              try {
                cited = JSON.parse(m.cited_bookmarks_json);
              } catch {}
            }
            return {
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              citedBookmarks: cited,
            };
          })
        );
      }
    } catch (err) {
      console.error("Failed to load messages for session:", sessionId, err);
      setChatMessages([DEFAULT_WELCOME_MESSAGE]);
    }
  }, []);

  // Initialize sessions & load active chat when sidepanel opens
  useEffect(() => {
    if (isOpen) {
      loadSessions().then((loadedSessions) => {
        const storedId = localStorage.getItem("bookmanage_active_chat_session_id");
        if (storedId && loadedSessions.some((s) => s.id === storedId)) {
          setActiveSessionId(storedId);
          loadSessionMessages(storedId);
        } else if (loadedSessions.length > 0) {
          setActiveSessionId(loadedSessions[0].id);
          localStorage.setItem("bookmanage_active_chat_session_id", loadedSessions[0].id);
          loadSessionMessages(loadedSessions[0].id);
        } else {
          setActiveSessionId(null);
          setChatMessages([DEFAULT_WELCOME_MESSAGE]);
        }
      });
    }
  }, [isOpen, loadSessions, loadSessionMessages]);

  const handleSelectSession = (session: AIChatSession) => {
    setActiveSessionId(session.id);
    localStorage.setItem("bookmanage_active_chat_session_id", session.id);
    loadSessionMessages(session.id);
    setIsHistoryOpen(false);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    localStorage.removeItem("bookmanage_active_chat_session_id");
    setChatMessages([DEFAULT_WELCOME_MESSAGE]);
    setIsHistoryOpen(false);
    setChatInput("");
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.deleteAIChatSession(sessionId);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0]);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleStartRename = (e: React.MouseEvent, session: AIChatSession) => {
    e.stopPropagation();
    setRenamingSessionId(session.id);
    setRenameTitleInput(session.title);
  };

  const handleConfirmRename = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const trimmed = renameTitleInput.trim();
    if (!trimmed) {
      setRenamingSessionId(null);
      return;
    }
    try {
      await api.renameAIChatSession(sessionId, trimmed);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
    } catch (err) {
      console.error("Failed to rename session:", err);
    } finally {
      setRenamingSessionId(null);
    }
  };

  // Perform semantic search
  const executeSearch = useCallback(
    async (queryText: string) => {
      const q = queryText.trim();
      if (!q) {
        setSearchResults([]);
        setHasSearched(false);
        return;
      }
      setIsSearching(true);
      setHasSearched(true);
      try {
        const results = await api.aiSemanticSearch(q, effectiveFolderId, 30);
        setSearchResults(results);
      } catch (err) {
        console.error("AI Semantic Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [effectiveFolderId]
  );

  // Debounced search when user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  // Handle chat submission
  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend ?? chatInput).trim();
    if (!text || isChatLoading) return;

    let currentSessionId = activeSessionId;

    // If starting a fresh chat without a session, automatically create session with first prompt title
    if (!currentSessionId) {
      try {
        const title = text.length > 36 ? text.slice(0, 36) + "..." : text;
        const newSession = await api.createAIChatSession(title, effectiveFolderId);
        currentSessionId = newSession.id;
        setActiveSessionId(newSession.id);
        localStorage.setItem("bookmanage_active_chat_session_id", newSession.id);
        setSessions((prev) => [newSession, ...prev]);
      } catch (err) {
        console.error("Failed to create new chat session:", err);
      }
    }

    const userMessage: AIChatMessage = { role: "user", content: text };
    const updatedHistory = [...chatMessages, userMessage];
    setChatMessages(updatedHistory);
    setChatInput("");
    setIsChatLoading(true);

    if (currentSessionId) {
      api.saveAIChatMessage(currentSessionId, "user", text, null).catch(console.error);
    }

    try {
      const response = await api.aiChatQuery(
        updatedHistory.map((m) => ({ role: m.role, content: m.content })),
        effectiveFolderId
      );

      const assistantMsg = {
        role: "assistant" as const,
        content: response.reply,
        citedBookmarks: response.relevant_bookmarks,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      if (currentSessionId) {
        await api.saveAIChatMessage(
          currentSessionId,
          "assistant",
          response.reply,
          response.relevant_bookmarks && response.relevant_bookmarks.length > 0
            ? JSON.stringify(response.relevant_bookmarks)
            : null
        );
        loadSessions();
      }
    } catch (err) {
      console.error("AI Chat failed:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I ran into an error querying your bookmark database. Please try again.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Scroll chat to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  if (!isOpen) return null;

  return (
    <div className="w-96 h-full flex flex-col shrink-0 overflow-hidden bg-card/70 backdrop-blur-xl border-l border-white/[0.06] shadow-2xl z-20 select-text">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              AI Assistant & Search
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-normal">
                v2
              </span>
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close AI panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scope Bar */}
      <div className="px-3 py-2 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Layers className="w-3.5 h-3.5 shrink-0 text-primary/70" />
          <span className="truncate">
            Scope:{" "}
            <strong className="text-foreground font-medium">
              {scopeToFolder && currentFolder ? `"${currentFolder.title}"` : "Entire Library"}
            </strong>
          </span>
        </div>

        {currentFolder && (
          <button
            onClick={() => {
              setScopeToFolder((v) => !v);
              if (searchQuery.trim()) {
                executeSearch(searchQuery);
              }
            }}
            className="text-[11px] text-primary hover:underline hover:text-primary/90 shrink-0 font-medium cursor-pointer"
          >
            {scopeToFolder ? "Search All" : "Limit to Folder"}
          </button>
        )}
      </div>

      {/* Top Mode Switcher Tabs (Animated matching Left Sidebar) */}
      <div className="p-2 border-b border-white/[0.06] bg-black/20">
        <div className="grid grid-cols-2 p-0.5 rounded-xl bg-black/40 border border-white/[0.06] relative">
          <button
            type="button"
            onClick={() => {
              setActiveTab("search");
              setIsHistoryOpen(false);
            }}
            className={cn(
              "relative z-10 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === "search"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Semantic Search</span>
            {activeTab === "search" && (
              <motion.div
                layoutId="ai-sidebar-mode-indicator"
                className="absolute inset-0 bg-white/10 rounded-lg -z-10 shadow-xs border border-white/10"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "relative z-10 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === "chat"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Interactive Chat</span>
            {activeTab === "chat" && (
              <motion.div
                layoutId="ai-sidebar-mode-indicator"
                className="absolute inset-0 bg-white/10 rounded-lg -z-10 shadow-xs border border-white/10"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Mode 1: Semantic Search */}
      {activeTab === "search" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search Input Box */}
          <div className="p-3 border-b border-white/[0.04]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='e.g. "Find a pdf editing tool from my bookmarks"'
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {QUICK_PROMPT_PILLS.map((pill) => (
                <button
                  key={pill}
                  onClick={() => setSearchQuery(pill)}
                  className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
            {isSearching && (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs">Analyzing semantic intent & scoring links...</span>
              </div>
            )}

            {!isSearching && hasSearched && searchResults.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                <AlertCircle className="w-6 h-6 text-muted-foreground/60 mb-2" />
                <p className="text-xs font-medium text-foreground">No matching bookmarks found</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                  Try different keywords, searching across the entire library, or scrape your links to
                  index page content.
                </p>
              </div>
            )}

            {!isSearching && !hasSearched && (
              <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-foreground">Smart Natural Language Search</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
                  Type what you are looking for in plain English. BookVisor scans titles, summaries,
                  clean URLs, and taxonomy.
                </p>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between pb-1 px-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Found {searchResults.length} ranked result
                    {searchResults.length === 1 ? "" : "s"}
                  </span>
                </div>

                {searchResults.map(({ bookmark, score, explanation }) => (
                  <BookmarkResultCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    score={score}
                    explanation={explanation}
                    onLocate={() => onLocateBookmark(bookmark)}
                    onTogglePin={() => onTogglePin(bookmark.id, bookmark.is_pinned)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Interactive Chat */}
      {activeTab === "chat" && (() => {
        const currentSession = sessions.find((s) => s.id === activeSessionId);

        return (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {/* Chat Session Control Bar */}
            <div className="px-3 py-2 border-b border-white/[0.04] bg-white/[0.015] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-medium text-foreground truncate" title={currentSession?.title || "New Chat"}>
                  {currentSession ? currentSession.title : "New Chat"}
                </span>
                {currentSession && currentSession.message_count !== undefined && currentSession.message_count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-muted-foreground font-mono shrink-0">
                    {currentSession.message_count}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                  title="Start a fresh chat conversation"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </Button>

                <Button
                  variant={isHistoryOpen ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setIsHistoryOpen((v) => !v)}
                  className={cn(
                    "h-6 px-2 text-[11px] gap-1 rounded-lg cursor-pointer transition-colors",
                    isHistoryOpen
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  )}
                  title="View past conversation history"
                >
                  <History className="w-3 h-3" />
                  <span>History</span>
                  {sessions.length > 0 && (
                    <span className="text-[10px] px-1 rounded-full bg-white/[0.08] font-mono">
                      {sessions.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* History Drawer Overlay */}
            <AnimatePresence>
              {isHistoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute inset-x-0 top-[37px] bottom-0 z-30 bg-zinc-950/96 backdrop-blur-2xl flex flex-col p-3 border-t border-white/[0.08]"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Chat History</span>
                      <span className="text-[10px] text-muted-foreground">({sessions.length} saved)</span>
                    </div>
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                    {sessions.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                        <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                        <p className="text-xs font-medium text-foreground">No saved chats yet</p>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                          Send a message to start and automatically save your conversation.
                        </p>
                      </div>
                    ) : (
                      sessions.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        const isRenaming = sess.id === renamingSessionId;

                        return (
                          <div
                            key={sess.id}
                            onClick={() => handleSelectSession(sess)}
                            className={cn(
                              "group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                              isActive
                                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20 text-foreground"
                                : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={renameTitleInput}
                                    onChange={(e) => setRenameTitleInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleConfirmRename(e as any, sess.id);
                                      if (e.key === "Escape") setRenamingSessionId(null);
                                    }}
                                    autoFocus
                                    className="w-full text-xs px-2 py-1 rounded bg-black/50 border border-primary/50 text-foreground outline-none"
                                  />
                                  <button
                                    onClick={(e) => handleConfirmRename(e, sess.id)}
                                    className="p-1 rounded text-primary hover:bg-primary/20 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingSessionId(null);
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:bg-white/10 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="text-xs font-medium text-foreground truncate">
                                    {sess.title}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {formatRelativeTime(sess.updated_at)}
                                    </span>
                                    <span>•</span>
                                    <span>{sess.message_count ?? 0} messages</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {!isRenaming && (
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleStartRename(e, sess)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Rename conversation"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSession(e, sess.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete conversation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Messages Log */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-col gap-1.5",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center justify-between w-full max-w-[90%] px-1">
                  <div className="flex items-center gap-1.5">
                    {msg.role === "assistant" ? (
                      <>
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-medium text-primary">BookVisor AI</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-medium text-muted-foreground">You</span>
                        <User className="w-3 h-3 text-muted-foreground" />
                      </>
                    )}
                  </div>
                  {msg.role === "assistant" && (
                    <CopyButton
                      value={msg.content}
                      label="Copy text"
                      iconOnly
                    />
                  )}
                </div>

                <div
                  className={cn(
                    "text-xs leading-relaxed rounded-2xl px-3.5 py-2.5 max-w-[90%] shadow-xs select-text cursor-text",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-xs font-normal whitespace-pre-line"
                      : "bg-white/[0.04] border border-white/[0.06] text-foreground rounded-bl-xs"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <PreviewLinkCard href={href || "#"} side="top" className="inline">
                            <a
                              href={href}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (href) openExternalUrl(href);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                              title={href ? `Open ${href} in browser` : undefined}
                            >
                              <span>{children}</span>
                              <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-70" />
                            </a>
                          </PreviewLinkCard>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-muted-foreground">{children}</em>
                        ),
                        code: ({ children }) => {
                          const text = String(children || "").trim();
                          const isUrlLike =
                            text.startsWith("http://") ||
                            text.startsWith("https://") ||
                            (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(text) &&
                              !text.includes(" "));

                          if (isUrlLike) {
                            const targetUrl = text.startsWith("http") ? text : `https://${text}`;
                            return (
                              <PreviewLinkCard href={targetUrl} side="top" className="inline">
                                <code
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openExternalUrl(targetUrl);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.14] text-cyan-400 hover:text-cyan-300 hover:underline font-mono text-[11px] border border-white/[0.08] cursor-pointer inline-flex items-center gap-1 transition-colors"
                                  title={`Open ${targetUrl} in browser`}
                                >
                                  <span>{children}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70 inline" />
                                </code>
                              </PreviewLinkCard>
                            );
                          }

                          return (
                            <code className="px-1.5 py-0.5 rounded bg-white/[0.08] text-primary font-mono text-[11px] border border-white/[0.06]">
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 space-y-1.5 my-2">{children}</ol>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>
                        ),
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Cited Bookmarks underneath assistant reply */}
                {msg.citedBookmarks && msg.citedBookmarks.length > 0 && (
                  <div className="w-full mt-1.5 space-y-1.5 pl-1">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Matched Links:
                    </span>
                    {msg.citedBookmarks.map((b) => (
                      <BookmarkResultCard
                        key={b.id}
                        bookmark={b}
                        compact
                        onLocate={() => onLocateBookmark(b)}
                        onTogglePin={() => onTogglePin(b.id, b.is_pinned)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isChatLoading && (
              <div className="flex items-start gap-2 pt-1">
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs text-muted-foreground">
                  Searching library & analyzing context...
                </div>
              </div>
            )}
          </div>

          {/* Quick Chat Suggestions */}
          <div className="px-3 py-1.5 border-t border-white/[0.04] bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendChat("Find a pdf editing tool from my bookmarks")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer"
            >
              "PDF editing tool"
            </button>
            <button
              onClick={() => handleSendChat("Which video downloaders do I have?")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer"
            >
              "Video downloaders"
            </button>
            <button
              onClick={() => handleSendChat("Show me my anime bookmarks")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer"
            >
              "Anime bookmarks"
            </button>
          </div>

          {/* Chat Input Bar */}
          <div className="p-2.5 border-t border-white/[0.06] bg-background/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask BookVisor AI..."
                disabled={isChatLoading}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!chatInput.trim() || isChatLoading}
                className="h-8 w-8 p-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      );
    })()}
    </div>
  );
}

interface BookmarkResultCardProps {
  bookmark: Bookmark;
  score?: number;
  explanation?: string;
  compact?: boolean;
  onLocate: () => void;
  onTogglePin: () => void;
}

function BookmarkResultCard({
  bookmark,
  score,
  explanation,
  compact = false,
  onLocate,
  onTogglePin,
}: BookmarkResultCardProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);

  const displayTitle = bookmark.scraped_title || bookmark.title || bookmark.domain;
  const displaySummary = bookmark.scraped_summary;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-white/[0.06] bg-card/60 hover:bg-card/90 transition-all p-2.5 flex flex-col gap-1.5 shadow-xs hover:border-white/[0.12] select-text",
        compact && "p-2 bg-card/40"
      )}
    >
      {/* Top row: Icon, Title, Actions */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {bookmark.favicon_url && !faviconFailed ? (
            <img
              src={bookmark.favicon_url}
              alt=""
              className="w-4 h-4 rounded-xs shrink-0 mt-0.5 object-contain"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          )}

          <div className="min-w-0 flex-1">
            <h4
              onClick={onLocate}
              className="text-xs font-medium text-foreground hover:text-primary transition-colors truncate cursor-pointer select-text"
              title={displayTitle}
            >
              {displayTitle}
            </h4>
            <PreviewLinkCard
              href={bookmark.url}
              title={bookmark.title}
              coverUrl={bookmark.cover_image_url}
              description={bookmark.description || bookmark.scraped_summary}
              domain={bookmark.domain}
              faviconUrl={bookmark.favicon_url}
              side="top"
            >
              <span className="text-[10px] text-muted-foreground truncate block font-mono select-text cursor-pointer hover:text-primary transition-colors">
                {bookmark.domain}
              </span>
            </PreviewLinkCard>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <CopyButton value={bookmark.clean_url} label="Copy clean URL" iconOnly />

          <Tooltip content="Open in browser">
            <button
              onClick={() => openExternalUrl(bookmark.url)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Locate in library">
            <button
              onClick={onLocate}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={bookmark.is_pinned ? "Unpin bookmark" : "Pin bookmark"}>
            <button
              onClick={onTogglePin}
              className={cn(
                "p-1 rounded-md transition-colors cursor-pointer",
                bookmark.is_pinned
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
              )}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Summary preview */}
      {displaySummary && (
        <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed select-text cursor-text">
          {displaySummary}
        </p>
      )}

      {/* Explanation for semantic search */}
      {explanation && !compact && (
        <p className="text-[10px] text-primary/75 italic line-clamp-1 select-text cursor-text">
          {explanation}
        </p>
      )}

      {/* Tags and Metadata */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {score !== undefined && (
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-medium font-mono">
            {Math.min(99, Math.round(score * 2.5))}% match
          </span>
        )}

        {bookmark.link_status === "DEAD" && (
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 font-medium">
            DEAD
          </span>
        )}

        {(bookmark.link_status === "BOT CHECK" || bookmark.link_status === "BOT_CHECK") && (
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-medium">
            BOT CHECK
          </span>
        )}

        {bookmark.tags &&
          bookmark.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/[0.04] text-muted-foreground/90 font-mono"
            >
              #{t}
            </span>
          ))}
      </div>
    </div>
  );
}
