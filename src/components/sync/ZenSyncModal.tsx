import { useState, useEffect } from "react";
import {
  Radio,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { api } from "@/lib/api";
import type { ZenSyncStatus } from "@/types";

interface Props {
  open: boolean;
  status: ZenSyncStatus | null;
  onClose: () => void;
  onTriggerSync: () => void;
}

export function ZenSyncModal({ open, status, onClose, onTriggerSync }: Props) {
  const [syncing, setSyncing] = useState(false);
  const isConnected = (status?.connected_clients ?? 0) > 0;

  const [manifestPath, setManifestPath] = useState<string>("C:\\bookmanage\\extension\\zen\\manifest.json");

  useEffect(() => {
    api.getExtensionDirectory("zen")
      .then((dir) => {
        setManifestPath(`${dir}\\manifest.json`);
      })
      .catch(() => {
        setManifestPath("C:\\bookmanage\\extension\\zen\\manifest.json");
      });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.zenRequestBrowserSync();
      onTriggerSync();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setSyncing(false), 1000);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Zen Browser Live Sync Bridge" maxWidth="max-w-xl">
      <div className="space-y-4 py-1 text-xs select-none">
        {/* Connection Status Card */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
            isConnected
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-card border-border/70 text-foreground"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>
                  {isConnected
                    ? "Zen Browser Connected!"
                    : "Zen Extension Disconnected"}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  ws://127.0.0.1:{status?.port || 49152}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isConnected
                  ? `${status?.connected_clients} active browser session connected.`
                  : "Start Zen Browser with the BookVisor extension loaded to sync."}
              </p>
            </div>
          </div>

          {isConnected && (
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing..." : "Sync Now"}</span>
            </Button>
          )}
        </div>

        {/* 4-Step Quick Install Guide */}
        <div className="space-y-2 p-3.5 rounded-xl bg-card/60 border border-border/70">
          <div className="font-semibold text-xs text-foreground uppercase tracking-wider mb-2">
            How to Load in Zen Browser (30 Seconds)
          </div>

          <ol className="space-y-2 pl-4 list-decimal text-muted-foreground leading-relaxed">
            <li>
              In Zen Browser's address bar, navigate to{" "}
              <code className="text-primary font-mono bg-secondary/80 px-1.5 py-0.5 rounded">
                about:debugging
              </code>
            </li>
            <li>
              Click on <strong>This Zen</strong> (or <strong>This Firefox</strong>) in the left sidebar.
            </li>
            <li>
              Click the <strong>Load Temporary Add-on...</strong> button.
            </li>
            <li>
              Select the extension manifest path:
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 p-1.5 rounded-lg bg-secondary/80 font-mono text-[10px] text-foreground select-text truncate">
                  {manifestPath}
                </code>
                <CopyButton
                  value={manifestPath}
                  label="Copy"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] shrink-0"
                />
              </div>
            </li>
          </ol>
        </div>

        {/* IronFox Auto-Sync Propagation Card */}
        <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex items-start gap-2.5 text-[11px] text-muted-foreground">
          <Smartphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">IronFox (Android) Sync:</strong> Because Zen Browser and IronFox both utilize Mozilla's native Firefox Sync, any folder mutations applied here automatically propagate to your mobile bookmarks on Android with zero setup!
          </p>
        </div>
      </div>
    </Modal>
  );
}
