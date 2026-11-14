import { useState, useEffect } from "react";
import {
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/animated-toast-stack";
import { api } from "@/lib/api";
import type { DiscoveredProfile } from "@/types";
import {
  ChromeIcon,
  EdgeIcon,
  BraveIcon,
  ZenIcon,
  FirefoxIcon,
} from "@/components/icons/BrowserIcons";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onAccountConnected: () => void;
}

const COLOR_OPTIONS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#6366f1", // Indigo
];

export function AccountConnectionWizardModal({
  open,
  onClose,
  onAccountConnected,
}: Props) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<DiscoveredProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Per-profile customization state
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [syncModes, setSyncModes] = useState<Record<string, "live" | "staged">>({});

  const fetchProfiles = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const list = await api.discoverAllBrowserProfiles();
      setProfiles(list);

      // Initialize defaults
      const names: Record<string, string> = {};
      const colors: Record<string, string> = {};
      const modes: Record<string, "live" | "staged"> = {};

      list.forEach((p) => {
        names[p.id] = p.display_name;
        colors[p.id] = p.suggested_color;
        modes[p.id] = "live";
      });

      setCustomNames(names);
      setSelectedColors(colors);
      setSyncModes(modes);
    } catch (err) {
      console.error("Failed to discover browser profiles:", err);
      setStatusMessage({
        type: "error",
        text: "Failed to scan machine browser profiles. Please ensure BookVisor has local read access.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  if (!open) return null;

  const handleConnectProfile = async (p: DiscoveredProfile) => {
    setConnectingId(p.id);
    setStatusMessage(null);

    const customName = customNames[p.id] || p.display_name;
    const color = selectedColors[p.id] || p.suggested_color;
    const mode = syncModes[p.id] || "live";

    try {
      await api.connectAndImportProfile(p, customName, color, mode);
      setStatusMessage({
        type: "success",
        text: `Connected "${customName}"! Imported and linked bookmarks to this account vault.`,
      });
      await fetchProfiles();
      onAccountConnected();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: typeof err === "string" ? err : err?.message || "Failed to connect profile",
      });
    } finally {
      setConnectingId(null);
    }
  };

  const getBrowserLogo = (bType: string) => {
    switch (bType.toLowerCase()) {
      case "chrome":
        return <ChromeIcon className="w-5 h-5 shrink-0" />;
      case "edge":
        return <EdgeIcon className="w-5 h-5 shrink-0" />;
      case "brave":
        return <BraveIcon className="w-5 h-5 shrink-0" />;
      case "zen":
        return <ZenIcon className="w-5 h-5 shrink-0" />;
      case "firefox":
        return <FirefoxIcon className="w-5 h-5 shrink-0" />;
      default:
        return <ChromeIcon className="w-5 h-5 text-primary shrink-0" />;
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Connect Browser Profiles & Accounts" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Intro */}
        <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-card/60 border border-white/[0.06] text-xs">
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              Multi-Browser & Multi-Account Unified Hub
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              BookVisor discovered browser profiles across your desktop. Connect your work, personal,
              and secondary browser accounts to view all bookmarks in one unified canvas and transfer
              links across profiles seamlessly.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchProfiles}
            disabled={loading}
            className="h-8 gap-1.5 text-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Rescan</span>
          </Button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={cn(
              "p-3 rounded-xl border text-xs flex items-center gap-2",
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Discovered Profiles Grid */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Scanning machine browser profiles & accounts...</span>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <AlertCircle className="w-6 h-6" />
              <p className="text-xs">No browser profiles detected automatically.</p>
              <p className="text-[11px] text-muted-foreground/70">
                You can install the BookVisor extension in Chrome or Zen to sync live.
              </p>
            </div>
          ) : (
            profiles.map((p) => {
              const isConnecting = connectingId === p.id;
              const currentColor = selectedColors[p.id] || p.suggested_color;
              const currentName = customNames[p.id] || p.display_name;
              const currentSyncMode = syncModes[p.id] || "live";

              return (
                <div
                  key={p.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all flex flex-col gap-3",
                    p.is_connected
                      ? "bg-white/[0.02] border-white/[0.04] opacity-80"
                      : "bg-card/70 border-white/[0.08] hover:border-white/[0.14] shadow-xs"
                  )}
                >
                  {/* Top row: Icon, Name/Email input, Connect button */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                        {getBrowserLogo(p.browser_type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={currentName}
                            disabled={p.is_connected}
                            onChange={(e) =>
                              setCustomNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="Account nickname (e.g. Work)"
                            className="text-xs font-semibold text-foreground bg-transparent border-b border-transparent hover:border-white/[0.2] focus:border-primary focus:outline-none transition-colors w-full"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {p.user_email && <span className="font-mono">{p.user_email}</span>}
                          {p.user_email && <span>•</span>}
                          <span>
                            {p.bookmark_count_estimate > 0
                              ? `~${p.bookmark_count_estimate} bookmarks`
                              : "Empty / New"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    {p.is_connected ? (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => handleConnectProfile(p)}
                        className="h-8 text-xs px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-xs cursor-pointer"
                      >
                        {isConnecting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{isConnecting ? "Importing..." : "Connect Account"}</span>
                      </Button>
                    )}
                  </div>

                  {/* Bottom row: Color Picker & Sync Mode (if not yet connected) */}
                  {!p.is_connected && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.04] text-[11px] text-muted-foreground">
                      {/* Color Palette */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground mr-1">Vault Color:</span>
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSelectedColors((prev) => ({ ...prev, [p.id]: c }))}
                            className={cn(
                              "w-4 h-4 rounded-full transition-transform cursor-pointer",
                              currentColor === c ? "scale-125 ring-2 ring-white/50" : "hover:scale-110 opacity-70 hover:opacity-100"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>

                      {/* Sync Mode Toggle */}
                      <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                        <button
                          onClick={() => setSyncModes((prev) => ({ ...prev, [p.id]: "live" }))}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                            currentSyncMode === "live"
                              ? "bg-white/[0.1] text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Live Sync
                        </button>
                        <button
                          onClick={() => setSyncModes((prev) => ({ ...prev, [p.id]: "staged" }))}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                            currentSyncMode === "staged"
                              ? "bg-white/[0.1] text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Staged Review
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Extension Info / Store Notice */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Need real-time two-way browser sync? Install the BookVisor extension.</span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                const path = await api.openExtensionDirectory();
                await navigator.clipboard.writeText(path).catch(() => {});
                toast({
                  title: "Extension Folder Opened",
                  description: `Folder opened in Explorer. Path copied to clipboard: ${path}`,
                  status: "success",
                });
              } catch (err: any) {
                toast({
                  title: "Failed to Open Folder",
                  description: String(err),
                  status: "error",
                });
              }
            }}
            className="h-7 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.06] cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Extension Folder</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
