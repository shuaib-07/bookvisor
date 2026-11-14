import { useState } from "react";
import { Zap, Settings, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ZenIcon } from "@/components/icons/BrowserIcons";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/animated-toast-stack";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: (tabIndex?: number, highlightSection?: string) => void;
}

export function ZenExtensionPromptModal({ isOpen, onClose, onOpenSettings }: Props) {
  const [isLaunching, setIsLaunching] = useState(false);
  const { toast } = useToast();

  const handle1ClickSetup = async () => {
    setIsLaunching(true);
    try {
      const extDir = await api.getExtensionDirectory("zen");
      const manifestFile = `${extDir}\\manifest.json`;
      await api.launchBrowserForExtensionSetup("zen");
      await navigator.clipboard.writeText(manifestFile).catch(() => {});
      toast({
        title: "Zen Browser Launched & Manifest Path Copied!",
        description: "Path copied to clipboard. In Zen Browser, click 'This Zen' -> 'Load Temporary Add-on...', paste (Ctrl+V) into the file dialog, and click Open!",
        status: "success",
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to Launch Zen Browser",
        description: String(err),
        status: "error",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Zen Browser Extension Required"
      description="Connect BookVisor to Zen Browser for real-time 2-way bookmark synchronization"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 py-1 text-xs select-none">
        {/* Banner with Zen Icon */}
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
            <ZenIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className="font-semibold text-foreground text-xs">
              Live Bridge Not Connected
            </h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Zen Browser uses a local Gecko Add-on to stream your bookmarks, folders, and active tabs in real-time. To begin importing, please install the lightweight BookVisor extension.
            </p>
          </div>
        </div>

        {/* 3 Step Visual Guide */}
        <div className="space-y-2 rounded-xl bg-card/60 border border-white/[0.08] p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-1">
            Quick 30-Second Setup
          </div>

          <div className="space-y-2 text-muted-foreground text-xs">
            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                1
              </span>
              <span className="leading-snug">
                Click <strong>"Guide Me in Settings"</strong> or <strong>"1-Click Launch Setup"</strong> below.
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                2
              </span>
              <span className="leading-snug">
                In Zen Browser, open <code className="px-1 py-0.5 rounded bg-white/[0.08] text-foreground font-mono text-[10px]">about:debugging</code> and select <strong>"This Zen"</strong> (or "This Firefox").
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                3
              </span>
              <div className="space-y-1 leading-snug">
                <span>
                  Click <strong>"Load Temporary Add-on..."</strong> and select{" "}
                  <code className="px-1 py-0.5 rounded bg-white/[0.08] text-primary font-mono text-[10px]">
                    manifest.json
                  </code>{" "}
                  from the opened folder (or simply paste <code className="text-primary font-mono text-[10px]">Ctrl+V</code> into the file dialog).
                </span>
                <div className="text-[10px] text-amber-300/90">
                  Note: Zen Browser requires the Gecko manifest with <code className="font-mono text-[9px] bg-black/40 px-1 py-0.2 rounded">background.scripts</code> (located in the <code className="font-mono text-[9px] bg-black/40 px-1 py-0.2 rounded">firefox</code> or <code className="font-mono text-[9px] bg-black/40 px-1 py-0.2 rounded">zen</code> folder), not the Chrome service_worker.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 px-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>100% offline & local WebSocket bridge. No external servers or tracking.</span>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground h-8 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handle1ClickSetup}
            disabled={isLaunching}
            className="w-full sm:w-auto text-xs h-8 gap-1.5 border-white/[0.12] hover:bg-white/[0.06] cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isLaunching ? "Launching Zen..." : "1-Click Launch Setup"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              onClose();
              onOpenSettings(2, "zen");
            }}
            className="w-full sm:w-auto text-xs h-8 gap-1.5 bg-primary hover:bg-primary/90 font-medium shadow-xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Guide Me in Settings →</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
