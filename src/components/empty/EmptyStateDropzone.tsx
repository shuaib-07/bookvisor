import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  ShieldCheck,
  Zap,
  RefreshCw,
  ArrowRight,
  Globe,
  CheckCircle2,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DetectedBrowser } from "@/types";
import { ChromeIcon, EdgeIcon, BraveIcon, ZenIcon, FirefoxIcon } from "../icons/BrowserIcons";
import { ZenExtensionPromptModal } from "@/components/modals/ZenExtensionPromptModal";

interface Props {
  onImportHtml: (htmlContent: string) => void;
  onImportDemo: () => void;
  onBrowserImportSuccess: () => void;
  loading: boolean;
  onOpenSettings?: (initialTab?: number, highlightSection?: string) => void;
}

export function EmptyStateDropzone({
  onImportHtml,
  onImportDemo,
  onBrowserImportSuccess,
  loading,
  onOpenSettings,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [browsers, setBrowsers] = useState<DetectedBrowser[]>([]);
  const [detectingBrowsers, setDetectingBrowsers] = useState(true);
  const [importingBrowserId, setImportingBrowserId] = useState<string | null>(null);
  const [isZenPromptOpen, setIsZenPromptOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
    isExtensionError?: boolean;
    browserId?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .detectInstalledBrowsers()
      .then((list) => {
        if (mounted) {
          setBrowsers(list);
          setDetectingBrowsers(false);
        }
      })
      .catch((err) => {
        console.error("Failed to detect browsers:", err);
        if (mounted) setDetectingBrowsers(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onImportHtml(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleBrowserImport = async (browser: DetectedBrowser) => {
    setImportingBrowserId(browser.id);
    setNotification(null);

    try {
      if (browser.id === "zen") {
        await api.zenRequestBrowserSync();
        setNotification({
          type: "success",
          text: "Zen Browser sync requested! Bookmarks are syncing live.",
        });
        setTimeout(() => onBrowserImportSuccess(), 1200);
      } else {
        const res = await api.importFromBrowserProfile(browser.id);
        const skippedMsg = res.total_bookmarks_skipped && res.total_bookmarks_skipped > 0
          ? ` (${res.total_bookmarks_skipped} duplicates skipped)`
          : "";
        setNotification({
          type: "success",
          text: `Successfully imported ${res.total_bookmarks_imported} new bookmarks${skippedMsg} across ${res.total_folders_created} folders from ${browser.name}!`,
        });
        setTimeout(() => onBrowserImportSuccess(), 1200);
      }
    } catch (err: any) {
      const errMsg = typeof err === "string" ? err : err.message || "Failed to import from browser";
      const isExtensionError =
        browser.id === "zen" &&
        (errMsg.toLowerCase().includes("not connected") ||
          errMsg.toLowerCase().includes("extension"));

      if (isExtensionError) {
        setIsZenPromptOpen(true);
      }

      setNotification({
        type: "error",
        text: errMsg,
        isExtensionError,
        browserId: browser.id,
      });
    } finally {
      setImportingBrowserId(null);
    }
  };

  const getBrowserIcon = (id: string) => {
    switch (id) {
      case "zen":
        return <ZenIcon className="w-5 h-5 shrink-0" />;
      case "chrome":
        return <ChromeIcon className="w-5 h-5 shrink-0" />;
      case "edge":
        return <EdgeIcon className="w-5 h-5 shrink-0" />;
      case "brave":
        return <BraveIcon className="w-5 h-5 shrink-0" />;
      case "firefox":
        return <FirefoxIcon className="w-5 h-5 shrink-0" />;
      default:
        return <Globe className="w-5 h-5 text-primary shrink-0" />;
    }
  };

  const availableBrowsers = browsers.filter((b) => b.is_available);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 max-w-2xl mx-auto select-none space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={handleFileInput}
      />

      {notification && (
        <div
          className={`w-full p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              : notification.isExtensionError
              ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
              : "bg-red-500/10 border-red-500/25 text-red-400"
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : notification.isExtensionError ? (
              <ZenIcon className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">
                {notification.isExtensionError
                  ? "Zen Browser Extension Not Connected"
                  : notification.type === "success"
                  ? "Import Success"
                  : "Import Failed"}
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                {notification.isExtensionError
                  ? "To live sync bookmarks from Zen Browser, install the BookVisor extension in Zen Browser."
                  : notification.text}
              </p>
            </div>
          </div>

          {notification.isExtensionError && (
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pt-1 sm:pt-0">
              <Button
                size="sm"
                onClick={() => {
                  if (onOpenSettings) {
                    onOpenSettings(2, "zen");
                  } else {
                    setIsZenPromptOpen(true);
                  }
                }}
                className="h-7.5 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90 font-medium shadow-xs cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Guide Me in Settings →</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 1. AUTO-IMPORT FROM INSTALLED BROWSERS */}
      <div className="w-full bg-card/60 backdrop-blur-md border border-white/[0.09] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">1-Click Auto-Import from Installed Browsers</h3>
              <p className="text-[11px] text-muted-foreground">Instantly reads existing bookmarks profiles without exporting</p>
            </div>
          </div>
          {detectingBrowsers && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {detectingBrowsers ? (
            <div className="col-span-2 py-4 text-center text-xs text-muted-foreground">
              Scanning local browser profiles...
            </div>
          ) : availableBrowsers.length === 0 ? (
            <div className="col-span-2 py-3 px-4 rounded-xl bg-secondary/30 border border-border/60 text-xs text-muted-foreground text-center">
              No local Chromium profiles detected. Use the HTML dropzone below.
            </div>
          ) : (
            availableBrowsers.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-card/80 border border-border/50 flex items-center justify-center shrink-0">
                    {getBrowserIcon(b.id)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {b.id === "zen"
                        ? "WebSocket Live Bridge"
                        : b.bookmark_count_estimate
                        ? `~${b.bookmark_count_estimate.toLocaleString()} bookmarks`
                        : "Ready to import"}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={importingBrowserId !== null || loading}
                  onClick={() => handleBrowserImport(b)}
                  className="text-xs h-7 px-2.5 shrink-0 gap-1 border-primary/30 hover:border-primary hover:bg-primary/10"
                >
                  {importingBrowserId === b.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Import</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. MANUAL HTML DROPZONE */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border/70 hover:border-primary/60 bg-card/40 hover:bg-card/70"
        }`}
      >
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
          <UploadCloud className="w-5 h-5" />
        </div>

        <div>
          <h2 className="text-xs font-semibold text-foreground">Or Import from HTML File</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
            Drag & drop an exported <code className="text-primary font-mono font-medium">bookmarks.html</code> file
          </p>
        </div>

        <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 pointer-events-none mt-1">
          <FileText className="w-3 h-3 text-primary" />
          <span>Browse File</span>
        </Button>
      </div>

      {/* 3. DEMO PACK & SECURITY PILLS */}
      <div className="flex flex-col items-center gap-3 w-full">
        <Button
          onClick={onImportDemo}
          disabled={loading}
          variant="secondary"
          className="w-full gap-2 text-xs h-9 border border-border/80 hover:border-primary/60 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Load Developer & Media Demo Library</span>
        </Button>

        <div className="grid grid-cols-2 gap-2 w-full text-[11px] text-muted-foreground">
          <div className="p-2 rounded-lg bg-card/60 border border-border/60 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Strips utm_* and tracking parameters</span>
          </div>
          <div className="p-2 rounded-lg bg-card/60 border border-border/60 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">100% Local-first SQLite storage</span>
          </div>
        </div>
      </div>

      <ZenExtensionPromptModal
        isOpen={isZenPromptOpen}
        onClose={() => setIsZenPromptOpen(false)}
        onOpenSettings={(tab, sec) => {
          setIsZenPromptOpen(false);
          onOpenSettings?.(tab, sec);
        }}
      />
    </div>
  );
}
