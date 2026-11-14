import { useEffect, useState } from "react";
import { X, RefreshCw, CheckCircle2, AlertCircle, ArrowRight, Download, Globe, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DetectedBrowser } from "@/types";
import { ChromeIcon, EdgeIcon, BraveIcon, ZenIcon, FirefoxIcon } from "../icons/BrowserIcons";
import { ZenExtensionPromptModal } from "@/components/modals/ZenExtensionPromptModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  onOpenSettings?: (initialTab?: number, highlightSection?: string) => void;
}

export function BrowserImportModal({ open, onClose, onImportSuccess, onOpenSettings }: Props) {
  const [browsers, setBrowsers] = useState<DetectedBrowser[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [isZenPromptOpen, setIsZenPromptOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
    isExtensionError?: boolean;
  } | null>(null);

  const fetchBrowsers = async () => {
    setLoading(true);
    try {
      const list = await api.detectInstalledBrowsers();
      setBrowsers(list);
    } catch (err) {
      console.error("Failed to detect browsers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchBrowsers();
      setStatusMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const handleImport = async (browser: DetectedBrowser) => {
    setImportingId(browser.id);
    setStatusMessage(null);

    try {
      if (browser.id === "zen") {
        await api.zenRequestBrowserSync();
        setStatusMessage({
          type: "success",
          text: "Zen Browser sync requested! All bookmarks and folders are streaming live into BookVisor.",
        });
        setTimeout(() => {
          onImportSuccess();
          onClose();
        }, 1200);
      } else {
        const res = await api.importFromBrowserProfile(browser.id);
        const skippedMsg = res.total_bookmarks_skipped && res.total_bookmarks_skipped > 0
          ? ` (${res.total_bookmarks_skipped} duplicates skipped)`
          : "";
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${res.total_bookmarks_imported} new bookmarks${skippedMsg} across ${res.total_folders_created} folders from ${browser.name}!`,
        });
        setTimeout(() => {
          onImportSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      const errMsg = typeof err === "string" ? err : err.message || "Failed to import from browser profile";
      const isExtensionError =
        browser.id === "zen" &&
        (errMsg.toLowerCase().includes("not connected") ||
          errMsg.toLowerCase().includes("extension"));

      if (isExtensionError) {
        setIsZenPromptOpen(true);
      }

      setStatusMessage({
        type: "error",
        text: errMsg,
        isExtensionError,
      });
    } finally {
      setImportingId(null);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-white/[0.09] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Import from Installed Browsers</h2>
              <p className="text-[11px] text-muted-foreground">Auto-detect bookmark profiles without manual HTML export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : statusMessage.isExtensionError
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : statusMessage.isExtensionError ? (
                  <ZenIcon className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>
                  {statusMessage.isExtensionError
                    ? "Zen Browser Extension is not installed or connected. Install the extension to import."
                    : statusMessage.text}
                </span>
              </div>

              {statusMessage.isExtensionError && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenSettings?.(2, "zen");
                  }}
                  className="h-7 px-2.5 text-xs gap-1 bg-primary hover:bg-primary/90 font-medium shrink-0 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Guide Me →</span>
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Scanning browser profiles on your system...</span>
              </div>
            ) : browsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No supported browser profiles found in standard directories.
              </div>
            ) : (
              browsers.map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    b.is_available
                      ? "bg-card/70 border-border/80 hover:border-primary/50"
                      : "bg-card/30 border-border/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 border border-border/40">
                      {getBrowserIcon(b.id)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{b.name}</span>
                        {b.id === "zen" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                            Live Sync Bridge
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {!b.is_available
                          ? "Not found on this PC"
                          : b.bookmark_count_estimate !== null && b.bookmark_count_estimate > 0
                          ? `~${b.bookmark_count_estimate.toLocaleString()} bookmarks detected`
                          : "Detected on PC"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Button
                      size="sm"
                      disabled={!b.is_available || importingId !== null}
                      onClick={() => handleImport(b)}
                      className="text-xs h-8 px-3 gap-1.5"
                    >
                      {importingId === b.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <span>Import</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-secondary/30 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Strips tracking tokens & preserves folder hierarchy</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7">
            Close
          </Button>
        </div>
      </div>

      <ZenExtensionPromptModal
        isOpen={isZenPromptOpen}
        onClose={() => setIsZenPromptOpen(false)}
        onOpenSettings={(tab, sec) => {
          setIsZenPromptOpen(false);
          onClose();
          onOpenSettings?.(tab, sec);
        }}
      />
    </div>
  );
}

