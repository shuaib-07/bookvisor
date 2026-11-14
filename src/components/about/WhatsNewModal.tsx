import {
  Sparkles,
  Globe,
  ExternalLink,
  Layers,
  Download,
  History,
  EyeOff,
  Cpu,
  BookmarkCheck,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { openExternalUrl, APP_VERSION, type UpdateInfo } from "@/lib/updater";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestUpdate?: UpdateInfo | null;
}

export function WhatsNewModal({ isOpen, onClose, latestUpdate }: WhatsNewModalProps) {
  const HIGHLIGHTS = [
    {
      icon: Globe,
      title: "Universal 2-Way Browser Sync Bridge",
      description: "Real-time bidirectional synchronization with Zen Browser, Firefox, Chrome, and Edge over a local WebSocket with zero database lock conflicts.",
    },
    {
      icon: Cpu,
      title: "AI Semantic Search & Interactive Multi-Chat",
      description: "Ask questions and search by concept rather than keywords. Persistent conversation history, custom session titles, and smart folder auto-categorization.",
    },
    {
      icon: EyeOff,
      title: "Privacy & Cascading Folder Concealment",
      description: "Hide private or sensitive bookmarks and entire folder trees from global search, AI assistants, and background link scrapers with one click.",
    },
    {
      icon: History,
      title: "Wayback Machine Self-Healing & Scraper",
      description: "Automatic link health checking, UTM tracking parameter stripping hygiene, and instant 1-click dead link restoration from the Internet Archive.",
    },
    {
      icon: Download,
      title: "One-Click In-App Update Downloader",
      description: "Direct in-app release downloads with live progress speed tracking, passive auto-install, and seamless restarts powered by GitHub Releases.",
    },
    {
      icon: Layers,
      title: "Windows 11 True DWM Mica Material",
      description: "Native translucent desktop composition, fluid physics-based tab transitions, customizable theme accents, and fullscreen desktop support.",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What's New in BookVisor"
      description="Latest updates, architecture enhancements, and release notes."
      icon={<Sparkles className="h-4 w-4 text-primary" />}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1 select-none">
        {/* Dynamic Latest Release Notice (if available) */}
        {latestUpdate && latestUpdate.updateAvailable && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-xs text-foreground">
                  New Version Available: v{latestUpdate.latestVersion}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-primary/40 bg-primary/20 hover:bg-primary/30 text-foreground cursor-pointer"
                onClick={() => openExternalUrl(latestUpdate.releaseUrl)}
              >
                <span>View Release</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            {latestUpdate.releaseNotes && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-36 overflow-y-auto bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
                {latestUpdate.releaseNotes}
              </div>
            )}
          </div>
        )}

        {/* Current Release Banner */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2.5">
            <BookmarkCheck className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs font-semibold text-foreground">
                Current Installed Version: v{APP_VERSION}
              </div>
              <div className="text-[10px] text-muted-foreground">
                100% Local-First SQLite Storage • Windows 11 True Mica
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openExternalUrl("https://github.com/shuaib-07/bookvisor/releases")}
            className="text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            All Releases
          </Button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Key Highlights
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {HIGHLIGHTS.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-white/[0.05] bg-card/40 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <h5 className="text-xs font-semibold text-foreground">{item.title}</h5>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed pl-8">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-white/[0.04]">
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs px-4 cursor-pointer"
          >
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
