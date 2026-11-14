"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  Sparkles,
  Cpu,
  Shield,
  Database,
  Trash2,
  X,
  RefreshCw,
  Power,
  Minimize2,
  HelpCircle,
  Monitor,
  Check,
  FolderSync,
  FolderOpen,
  ArrowUpDown,
  Copy,
  Zap,
  Globe,
} from "lucide-react";
import {
  ZenIcon,
  ChromeIcon,
  EdgeIcon,
  BraveIcon,
  FirefoxIcon,
} from "@/components/icons/BrowserIcons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { DirectionAwareTabs, type Tab } from "@/components/ui/direction-aware-tabs";
import { useToast } from "@/components/ui/animated-toast-stack";
import { api } from "@/lib/api";
import {
  getStoredCloseBehavior,
  setStoredCloseBehavior,
  type AppCloseBehavior,
} from "@/lib/closeSettings";
import { cn } from "@/lib/utils";
import type { ModelStatus, ZenSyncStatus, DetectedBrowser, DiscoveredProfile } from "@/types";
import { AboutView } from "@/components/about/AboutView";

export type ThemeMode = "sefirah" | "deep-blue" | "neutral";
export type AccentMode = string;

export function resolveAccentHex(accent: string): string {
  if (!accent) return "#3B82F6";
  if (accent === "blue") return "#3B82F6";
  if (accent === "lavender") return "#A855F7";
  if (accent.startsWith("#")) return accent.toUpperCase();
  return "#3B82F6";
}

export function isLightColor(hex: string): boolean {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

interface Props {
  onClose?: () => void;
  onOpenModelSetup?: () => void;
  onOpenBrowserImport?: () => void;
  onRefreshData?: () => void;
  onOpenResetLibrary?: () => void;
  initialTabId?: number | string;
  highlightSection?: string | null;
}

export function SettingsView({
  onClose,
  onOpenModelSetup,
  onOpenBrowserImport,
  onOpenResetLibrary,
  initialTabId,
  highlightSection,
}: Props) {
  const [activeTabId, setActiveTabId] = useState<number | string>(initialTabId ?? 0);
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem("bookmanage_theme") as ThemeMode) || "sefirah"
  );
  const [accent, setAccent] = useState<AccentMode>(
    () => localStorage.getItem("bookmanage_accent") || "#3B82F6"
  );
  const [closeBehavior, setCloseBehavior] = useState<AppCloseBehavior>(getStoredCloseBehavior);
  const [aiTier] = useState<string>(
    () => localStorage.getItem("bookmanage_ai_tier") || "pro_7b"
  );
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [zenStatus, setZenStatus] = useState<ZenSyncStatus | null>(null);
  const [resyncing, setResyncing] = useState(false);

  const [stripTracking, setStripTracking] = useState<boolean>(() => {
    const val = localStorage.getItem("bookmanage_strip_tracking");
    return val !== null ? val === "true" : true;
  });

  const [waybackFallback, setWaybackFallback] = useState<boolean>(() => {
    const val = localStorage.getItem("bookmanage_wayback_fallback");
    return val !== null ? val === "true" : true;
  });

  const [syncPolicy, setSyncPolicy] = useState<"realtime" | "safe" | "manual">(() => {
    return (localStorage.getItem("bookmanage_sync_policy") as any) || "realtime";
  });
  const [browserLandingRoot, setBrowserLandingRoot] = useState<"smart" | "container">(() => {
    return (localStorage.getItem("bookmanage_browser_landing") as any) || "smart";
  });
  const [setupTab, setSetupTab] = useState<"chromium" | "gecko">("chromium");
  const [detectedBrowsers, setDetectedBrowsers] = useState<DetectedBrowser[]>([]);
  const [discoveredProfiles, setDiscoveredProfiles] = useState<DiscoveredProfile[]>([]);
  const [launchingBrowser, setLaunchingBrowser] = useState<string | null>(null);
  const [copiedBrowser, setCopiedBrowser] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const isBrowserAvailable = (id: string) =>
    detectedBrowsers.some((b) => b.id === id && b.is_available);

  const { toast } = useToast();

  const handleCopyExtensionUrl = async (browserId: string) => {
    const url =
      browserId === "edge"
        ? "edge://extensions"
        : browserId === "zen" || browserId === "firefox"
        ? "about:debugging#/runtime/this-firefox"
        : browserId === "brave"
        ? "brave://extensions"
        : "chrome://extensions";
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiedUrl(browserId);
    toast({
      title: "Extensions URL Copied",
      description: `Copied "${url}". Press Ctrl+L in your browser, paste (Ctrl+V), and hit Enter!`,
      status: "success",
    });
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handle1ClickSetup = async (
    browserId: string,
    browserName: string,
    profileDirectory?: string
  ) => {
    if (!isBrowserAvailable(browserId)) {
      toast({
        title: `${browserName} Not Detected`,
        description: `${browserName} was not found on this computer. Please install it first or choose a detected browser.`,
        status: "error",
      });
      return;
    }

    const launchKey = profileDirectory ? `${browserId}_${profileDirectory}` : browserId;
    setLaunchingBrowser(launchKey);
    try {
      if (browserId === "zen" || browserId === "firefox") {
        const extDir = await api.getExtensionDirectory(browserId);
        const manifestFile = `${extDir}\\manifest.json`;
        await api.launchBrowserForExtensionSetup(browserId, profileDirectory);
        await navigator.clipboard.writeText(manifestFile).catch(() => {});
        toast({
          title: `${browserName} Launched!`,
          description: `Manifest path copied to clipboard! In Zen Browser, click 'This Zen' -> 'Load Temporary Add-on...', paste (Ctrl+V) into the file dialog, and click Open.`,
          status: "success",
        });
        return;
      }

      const extUrl =
        browserId === "edge"
          ? "edge://extensions"
          : browserId === "brave"
          ? "brave://extensions"
          : "chrome://extensions";
      await api.launchBrowserForExtensionSetup(browserId, profileDirectory);
      await navigator.clipboard.writeText(extUrl).catch(() => {});
      toast({
        title: `${browserName} Launched!`,
        description: `We opened ${browserName} and copied "${extUrl}" to your clipboard. Press Ctrl+L then Ctrl+V & Enter, toggle Developer Mode, and drag the opened folder into the tab!`,
        status: "success",
      });
    } catch (err: any) {
      toast({
        title: "Setup Launch Failed",
        description: String(err),
        status: "error",
      });
    } finally {
      setLaunchingBrowser(null);
    }
  };

  const handleOpenExtensionFolder = async (browserId?: string) => {
    try {
      const path = await api.openExtensionDirectory(browserId);
      await navigator.clipboard.writeText(path).catch(() => {});
      toast({
        title: "Extension Folder Opened",
        description: `Guaranteed folder opened in Windows Explorer. Path copied to clipboard: ${path}`,
        status: "success",
      });
    } catch (err: any) {
      toast({
        title: "Failed to Open Folder",
        description: String(err),
        status: "error",
      });
    }
  };

  const handleCopyExtensionPath = async (browserId: string) => {
    try {
      const path = await api.getExtensionDirectory(browserId);
      const isGecko = browserId === "zen" || browserId === "firefox";
      const targetPath = isGecko ? `${path}\\manifest.json` : path;
      await navigator.clipboard.writeText(targetPath);
      setCopiedBrowser(browserId);
      setTimeout(() => setCopiedBrowser(null), 2000);
      toast({
        title: isGecko ? "Manifest Path Copied" : "Path Copied to Clipboard",
        description: targetPath,
        status: "success",
      });
    } catch (err: any) {
      console.error("Failed to copy path:", err);
    }
  };

  useEffect(() => {
    localStorage.setItem("bookmanage_sync_policy", syncPolicy);
  }, [syncPolicy]);

  useEffect(() => {
    localStorage.setItem("bookmanage_browser_landing", browserLandingRoot);
  }, [browserLandingRoot]);

  // Apply theme and accent variables dynamically
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const hex = resolveAccentHex(accent);
    document.documentElement.setAttribute("data-accent", hex);
    document.documentElement.style.setProperty("--primary", hex);
    document.documentElement.style.setProperty("--ring", `${hex}66`);

    const isLight = isLightColor(hex);
    document.documentElement.style.setProperty(
      "--primary-foreground",
      isLight ? "#09090b" : "#ffffff"
    );

    localStorage.setItem("bookmanage_theme", theme);
    localStorage.setItem("bookmanage_accent", hex);
  }, [theme, accent]);

  // Persist hygiene settings
  useEffect(() => {
    localStorage.setItem("bookmanage_strip_tracking", String(stripTracking));
  }, [stripTracking]);

  useEffect(() => {
    localStorage.setItem("bookmanage_wayback_fallback", String(waybackFallback));
  }, [waybackFallback]);

  // Listen for external close behavior changes
  useEffect(() => {
    const handleStorage = () => {
      setCloseBehavior(getStoredCloseBehavior());
    };
    window.addEventListener("bookvisor-close-behavior-changed", handleStorage);
    return () => {
      window.removeEventListener("bookvisor-close-behavior-changed", handleStorage);
    };
  }, []);

  // Fetch live AI model status and Zen sync status
  useEffect(() => {
    api.checkModelStatus(aiTier)
      .then(setModelStatus)
      .catch(() => { });

    api.zenGetSyncStatus()
      .then(setZenStatus)
      .catch(() => { });

    api.detectInstalledBrowsers()
      .then(setDetectedBrowsers)
      .catch(() => { });

    api.discoverAllBrowserProfiles()
      .then(setDiscoveredProfiles)
      .catch(() => { });
  }, [aiTier]);

  // Sync activeTabId if initialTabId changes
  useEffect(() => {
    if (initialTabId !== undefined) {
      setActiveTabId(initialTabId);
    }
  }, [initialTabId]);

  // Handle section focus and scrolling (e.g. Zen Browser extension setup)
  useEffect(() => {
    if (highlightSection === "zen") {
      setActiveTabId(2);
      setSetupTab("gecko");
      const timer = setTimeout(() => {
        const el = document.getElementById("zen-extension-card");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightSection]);

  const handleSelectCloseBehavior = (b: AppCloseBehavior) => {
    setCloseBehavior(b);
    setStoredCloseBehavior(b);
  };

  const appearanceTab = (
    <div className="space-y-4 pt-1 pb-16">
      {/* Backdrop Material Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
              <Monitor className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Backdrop Material</div>
              <div className="text-xs text-muted-foreground">
                Windows 11 Native Mica sampling with real-time desktop composition
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Mica Active
          </span>
        </div>
      </Card>

      {/* Theme Palette Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <span>Mica Theme Palette</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Windows 11 DWM True Mica compositing with Fluent 2 dark presets
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {[
            { id: "sefirah", name: "Sefirah", desc: "Smoked Obsidian Mica", color: "#16131b" },
            { id: "deep-blue", name: "Navy", desc: "Deep Midnight Blue", color: "#0f172a" },
            { id: "neutral", name: "Neutral", desc: "Monochrome Dark Mica", color: "#18181b" },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setTheme(item.id as ThemeMode)}
              className={cn(
                "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
                theme === item.id
                  ? "bg-primary/15 border-primary shadow-xs"
                  : "bg-secondary/40 border-border/70 hover:border-primary/40"
              )}
            >
              {theme === item.id && (
                <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-semibold text-foreground">{item.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Accent Color Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3 relative z-30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Primary Accent Color</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drives active indicators, badges, selection rings, and primary buttons
            </p>
          </div>
          {accent !== "#3B82F6" && (
            <button
              type="button"
              onClick={() => setAccent("#3B82F6")}
              className="text-xs px-2.5 py-1 rounded-md border border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Reset Default
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { hex: "#3B82F6", label: "Electric Blue" },
            { hex: "#06B6D4", label: "Cyan" },
            { hex: "#10B981", label: "Emerald" },
            { hex: "#A855F7", label: "Lavender" },
            { hex: "#F59E0B", label: "Amber" },
            { hex: "#EC4899", label: "Rose" },
          ].map((preset) => (
            <button
              key={preset.hex}
              onClick={() => setAccent(preset.hex)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all cursor-pointer",
                accent === preset.hex
                  ? "bg-primary/20 border-primary text-foreground font-medium"
                  : "bg-secondary/40 border-border/70 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.hex }} />
              <span>{preset.label}</span>
            </button>
          ))}
          <ColorPicker color={accent} onChange={setAccent} align="right" />
        </div>
      </Card>

      {/* Window Close Behavior Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Power className="w-4 h-4 text-primary" />
            <span>Window Close Behavior</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose what happens when the window close (X) button is pressed
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Ask Every Time */}
          <div
            onClick={() => handleSelectCloseBehavior("ask")}
            className={cn(
              "relative flex flex-col p-3.5 rounded-xl border transition-all cursor-pointer",
              closeBehavior === "ask"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground border border-white/[0.08]">
                  Default
                </span>
                {closeBehavior === "ask" && (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs font-semibold text-foreground">Ask Every Time</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Prompt with a dialog to choose between minimizing or closing.
            </div>
          </div>

          {/* Minimize to Tray */}
          <div
            onClick={() => handleSelectCloseBehavior("background")}
            className={cn(
              "relative flex flex-col p-3.5 rounded-xl border transition-all cursor-pointer",
              closeBehavior === "background"
                ? "border-sky-500 bg-sky-500/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Minimize2 className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Tray
                </span>
                {closeBehavior === "background" && (
                  <div className="h-4 w-4 rounded-full bg-sky-500 flex items-center justify-center text-white">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs font-semibold text-foreground">Keep in Background</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Silently minimize to system tray. Live browser sync stays active.
            </div>
          </div>

          {/* Exit Completely */}
          <div
            onClick={() => handleSelectCloseBehavior("quit")}
            className={cn(
              "relative flex flex-col p-3.5 rounded-xl border transition-all cursor-pointer",
              closeBehavior === "quit"
                ? "border-rose-500 bg-rose-500/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Power className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Exit
                </span>
                {closeBehavior === "quit" && (
                  <div className="h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center text-white">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs font-semibold text-foreground">Close Completely</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Shut down all background processes and exit immediately.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  const aiTab = (
    <div className="space-y-4 pt-1 pb-4">
      {/* Local AI Engine Status Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span>Hardware Specs & AI Model Setup</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active Tier: <strong className="text-foreground capitalize">{aiTier.replace("_", " ")}</strong>
            </p>
          </div>

          {onOpenModelSetup && (
            <Button size="sm" onClick={onOpenModelSetup} className="h-8 text-xs gap-1.5 cursor-pointer">
              <Cpu className="w-3.5 h-3.5" />
              <span>Hardware Specs & AI Setup Wizard</span>
            </Button>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center justify-between">
            <span>Model Weights Status:</span>
            {modelStatus?.is_downloaded ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Downloaded ({(modelStatus.file_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB)
              </span>
            ) : (
              <span className="text-amber-400 font-medium">Downloading / Not Installed</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Inference Runtime:</span>
            <span className="text-foreground font-mono">In-Process GGUF Loader</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Hardware Offload:</span>
            <span className="text-emerald-400 font-medium">100% GPU VRAM (CUDA Enabled)</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Supported Models:</span>
            <span className="text-foreground">Qwen 2.5 (7B / 3B / 1.5B) + nomic-embed</span>
          </div>
        </div>
      </Card>

      {/* Data Hygiene Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Data Hygiene & Scraper Rules</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated URL sanitization and dead link recovery options
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <Checkbox
            checked={stripTracking}
            onCheckedChange={setStripTracking}
            label="Automatically strip tracking parameters (utm_*, fbclid, gclid, ref) upon import"
          />

          <Checkbox
            checked={waybackFallback}
            onCheckedChange={setWaybackFallback}
            label="Query Internet Archive Wayback Machine API automatically when a link is 404/dead"
          />
        </div>
      </Card>
    </div>
  );

  const syncAndStorageTab = (
    <div className="space-y-4 pt-1 pb-4">
      {/* Auto-Import from Browser Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Auto-Import from Browser</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Directly scan and import bookmarks from Chrome, Edge, Brave, and Zen profiles
            </p>
          </div>

          {onOpenBrowserImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenBrowserImport}
              className="text-xs h-8 gap-1.5 border-border/80 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import from Browser...</span>
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          One-click bookmark ingestion without needing manual HTML exports. Automatically discovers default and custom user profiles across all Chromium and Gecko browsers installed on your system.
        </p>
      </Card>

      {/* Live Cross-Browser Sync Bridge Status Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderSync className="w-4 h-4 text-cyan-400" />
              <span>Universal Two-Way Browser Bridge</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              WebSocket server listening on <code className="text-primary font-mono">ws://127.0.0.1:{zenStatus?.port ?? 49152}</code>
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={resyncing}
            onClick={async () => {
              setResyncing(true);
              try {
                await api.zenRequestBrowserSync();
                const updated = await api.zenGetSyncStatus();
                setZenStatus(updated);
              } catch (_) {
              } finally {
                setTimeout(() => setResyncing(false), 800);
              }
            }}
            className="text-xs h-8 gap-1.5 border-border/80 cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", resyncing && "animate-spin")} />
            <span>{resyncing ? "Syncing..." : "Trigger Full Resync"}</span>
          </Button>
        </div>

        {/* Live Client Status & Supported Browsers Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border text-xs",
                (zenStatus?.connected_clients ?? 0) > 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-secondary text-muted-foreground border-border/70"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  (zenStatus?.connected_clients ?? 0) > 0
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-muted-foreground"
                )}
              />
              {(zenStatus?.connected_clients ?? 0) > 0
                ? `${zenStatus?.connected_browser || "Browser Extension"} Connected (${zenStatus?.connected_clients} active)`
                : "Waiting for Browser Extension"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/30 border border-white/[0.06] px-2.5 py-1 rounded-lg">
            <span className="text-[11px] text-muted-foreground mr-1">Supported:</span>
            <div className="flex items-center gap-1.5">
              <span title="Zen Browser" className="inline-flex"><ZenIcon className="w-3.5 h-3.5" /></span>
              <span title="Google Chrome" className="inline-flex"><ChromeIcon className="w-3.5 h-3.5" /></span>
              <span title="Brave Browser" className="inline-flex"><BraveIcon className="w-3.5 h-3.5" /></span>
              <span title="Microsoft Edge" className="inline-flex"><EdgeIcon className="w-3.5 h-3.5" /></span>
              <span title="Mozilla Firefox" className="inline-flex"><FirefoxIcon className="w-3.5 h-3.5" /></span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Full bidirectional bridge: when you save, edit, move, or delete bookmarks in BookVisor, your connected browser updates instantly. Conversely, Ctrl+D bookmarking in your browser streams straight into BookVisor in real-time with echo-cancellation locks.
        </p>
      </Card>

      {/* Sync Policy Selector Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <span>Two-Way Sync Policy</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control how bookmark updates propagate between BookVisor and connected browsers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div
            onClick={() => setSyncPolicy("realtime")}
            className={cn(
              "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
              syncPolicy === "realtime"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">Real-Time Sync</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium">
                  Recommended
                </span>
                {syncPolicy === "realtime" && (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Instant live reflection on both ends. Bookmarks, folders, and moves sync without manual action.
            </p>
          </div>

          <div
            onClick={() => setSyncPolicy("safe")}
            className={cn(
              "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
              syncPolicy === "safe"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">Safe Deletions</span>
              {syncPolicy === "safe" && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Creates and moves sync immediately. Deletions made in BookVisor require explicit user approval.
            </p>
          </div>

          <div
            onClick={() => setSyncPolicy("manual")}
            className={cn(
              "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
              syncPolicy === "manual"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">Manual Only</span>
              {syncPolicy === "manual" && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Background auto-sync disabled. Only syncs when "Trigger Full Resync" button is pressed.
            </p>
          </div>
        </div>
      </Card>

      {/* Browser Landing Container Strategy */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Browser Landing Container</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose where BookVisor folders and links land in your browser bookmarks bar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div
            onClick={() => setBrowserLandingRoot("smart")}
            className={cn(
              "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
              browserLandingRoot === "smart"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">Smart Root Mirroring</span>
              {browserLandingRoot === "smart" && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Mirrors root folders directly into your browser's native Bookmarks Toolbar / Bar.
            </p>
          </div>

          <div
            onClick={() => setBrowserLandingRoot("container")}
            className={cn(
              "relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
              browserLandingRoot === "container"
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/70 bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">Isolated [BookVisor] Folder</span>
              {browserLandingRoot === "container" && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Organizes all synced bookmarks inside a dedicated, pristine "[BookVisor]" container.
            </p>
          </div>
        </div>
      </Card>

      {/* Browser Extension Installation & Setup Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Universal WebExtension Setup & Launcher</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated bridge installation for Chrome, Edge, Brave, Zen, and Firefox
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenExtensionFolder("chrome")}
              className="text-xs h-7.5 gap-1.5 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-primary" />
              <span>Open Chrome Folder</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenExtensionFolder("firefox")}
              className="text-xs h-7.5 gap-1.5 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Open Firefox Folder</span>
            </Button>
          </div>
        </div>

        {/* Chromium Sandbox Setup Clarification & 15-Second Guide */}
        <div className="p-3.5 rounded-xl bg-card/60 border border-primary/20 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Chromium Extension 15-Second Setup</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Chrome • Edge • Brave</span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Chromium browsers open a blank New Tab when launched externally due to internal security sandbox rules.
            Clicking <strong>Setup</strong> opens your browser profile, opens the extension folder in Windows Explorer, and puts <code className="text-primary font-mono text-[10px]">chrome://extensions</code> on your clipboard!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Open Extensions</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] font-mono text-[10px]">Ctrl+L</kbd>, paste (<kbd className="px-1 py-0.5 rounded bg-white/[0.08] font-mono text-[10px]">Ctrl+V</kbd>) and hit <strong>Enter</strong>.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Turn On Dev Mode</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Toggle the <strong>Developer mode</strong> switch at the top-right corner to ON.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Drag Extension In</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Drag the opened extension folder directly into the browser tab!
              </p>
            </div>
          </div>
        </div>

        {/* Browser Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* Chrome */}
          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.06] space-y-2.5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <ChromeIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Google Chrome</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Manifest V3 Unpacked</div>
                </div>
              </div>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                isBrowserAvailable("chrome")
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/[0.04] text-muted-foreground border-white/[0.06]"
              )}>
                {isBrowserAvailable("chrome") ? "Detected" : "Not Detected"}
              </span>
            </div>

            <div className="space-y-1.5">
              {discoveredProfiles.filter((p) => p.browser_type === "chrome").length > 1 ? (
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground font-medium flex items-center justify-between">
                    <span>Target Profile:</span>
                    <span className="text-[9px] text-primary font-mono">Direct profile bypass</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {discoveredProfiles
                      .filter((p) => p.browser_type === "chrome")
                      .map((cp) => (
                        <Button
                          key={cp.id}
                          size="sm"
                          onClick={() =>
                            handle1ClickSetup(
                              "chrome",
                              `Chrome (${cp.display_name})`,
                              cp.profile_folder_name
                            )
                          }
                          disabled={launchingBrowser === `chrome_${cp.profile_folder_name}`}
                          className="h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
                          title={`Open ${cp.display_name} (${cp.user_email || cp.profile_folder_name})`}
                        >
                          <Zap className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="truncate">
                            {launchingBrowser === `chrome_${cp.profile_folder_name}`
                              ? "Opening..."
                              : `Setup: ${cp.display_name}`}
                          </span>
                        </Button>
                      ))}
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    handle1ClickSetup(
                      "chrome",
                      "Google Chrome",
                      discoveredProfiles.find((p) => p.browser_type === "chrome")
                        ?.profile_folder_name || "Default"
                    )
                  }
                  disabled={launchingBrowser === "chrome"}
                  className="w-full h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
                >
                  <Zap className="w-3.5 h-3.5 text-white" />
                  <span>{launchingBrowser === "chrome" ? "Launching..." : "Setup"}</span>
                </Button>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionUrl("chrome")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy chrome://extensions to clipboard"
                >
                  {copiedUrl === "chrome" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-primary" />
                  )}
                  <span>{copiedUrl === "chrome" ? "URL Copied!" : "Copy URL"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionPath("chrome")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy path to paste into Load Unpacked"
                >
                  {copiedBrowser === "chrome" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{copiedBrowser === "chrome" ? "Copied!" : "Copy Path"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Microsoft Edge */}
          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.06] space-y-2.5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <EdgeIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Microsoft Edge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Manifest V3 Unpacked</div>
                </div>
              </div>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                isBrowserAvailable("edge")
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/[0.04] text-muted-foreground border-white/[0.06]"
              )}>
                {isBrowserAvailable("edge") ? "Detected" : "Not Detected"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Button
                size="sm"
                onClick={() => handle1ClickSetup("edge", "Microsoft Edge")}
                disabled={launchingBrowser === "edge"}
                className="w-full h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>{launchingBrowser === "edge" ? "Launching..." : "Setup"}</span>
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionUrl("edge")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy edge://extensions to clipboard"
                >
                  {copiedUrl === "edge" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-primary" />
                  )}
                  <span>{copiedUrl === "edge" ? "URL Copied!" : "Copy URL"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionPath("edge")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy path to paste into Load Unpacked"
                >
                  {copiedBrowser === "edge" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{copiedBrowser === "edge" ? "Copied!" : "Copy Path"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Zen Browser */}
          <div
            id="zen-extension-card"
            className={cn(
              "p-3 rounded-xl bg-card/60 border border-white/[0.06] space-y-2.5 flex flex-col justify-between transition-all duration-500",
              highlightSection === "zen" &&
                "ring-2 ring-cyan-400 bg-cyan-950/30 border-cyan-400/40 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <ZenIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Zen Browser</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Gecko Add-on (MV2)</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Live Bridge
              </span>
            </div>

            <div className="space-y-1.5">
              <Button
                size="sm"
                onClick={() => handle1ClickSetup("zen", "Zen Browser")}
                disabled={launchingBrowser === "zen"}
                className="w-full h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>{launchingBrowser === "zen" ? "Launching..." : "Setup"}</span>
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenExtensionFolder("firefox")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Open folder containing manifest.json"
                >
                  <FolderOpen className="w-3 h-3 text-muted-foreground" />
                  <span>Open Folder</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionPath("firefox")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy path for Zen Add-on picker"
                >
                  {copiedBrowser === "firefox" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{copiedBrowser === "firefox" ? "Copied!" : "Copy Path"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Brave Browser */}
          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.06] space-y-2.5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <BraveIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Brave Browser</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Chromium Extensions</div>
                </div>
              </div>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                isBrowserAvailable("brave")
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/[0.04] text-muted-foreground border-white/[0.06]"
              )}>
                {isBrowserAvailable("brave") ? "Detected" : "Not Detected"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Button
                size="sm"
                onClick={() => handle1ClickSetup("brave", "Brave Browser")}
                disabled={launchingBrowser === "brave"}
                className="w-full h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>{launchingBrowser === "brave" ? "Launching..." : "Setup"}</span>
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionUrl("brave")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                  title="Copy brave://extensions to clipboard"
                >
                  {copiedUrl === "brave" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-primary" />
                  )}
                  <span>{copiedUrl === "brave" ? "URL Copied!" : "Copy URL"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionPath("brave")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                >
                  {copiedBrowser === "brave" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{copiedBrowser === "brave" ? "Copied!" : "Copy Path"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Mozilla Firefox */}
          <div className="p-3 rounded-xl bg-card/60 border border-white/[0.06] space-y-2.5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                  <FirefoxIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Mozilla Firefox</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Gecko Add-on (MV2)</div>
                </div>
              </div>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                isBrowserAvailable("firefox")
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/[0.04] text-muted-foreground border-white/[0.06]"
              )}>
                {isBrowserAvailable("firefox") ? "Detected" : "Not Detected"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Button
                size="sm"
                onClick={() => handle1ClickSetup("firefox", "Mozilla Firefox")}
                disabled={launchingBrowser === "firefox"}
                className="w-full h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary cursor-pointer shadow-xs font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>{launchingBrowser === "firefox" ? "Launching..." : "Setup"}</span>
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenExtensionFolder("firefox")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3 text-muted-foreground" />
                  <span>Open Folder</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyExtensionPath("firefox")}
                  className="h-7 text-[11px] gap-1 border-white/[0.08] hover:bg-white/[0.06] cursor-pointer"
                >
                  {copiedBrowser === "firefox" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span>{copiedBrowser === "firefox" ? "Copied!" : "Copy Path"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Step Guide Tabs */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
            <button
              type="button"
              onClick={() => setSetupTab("chromium")}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer",
                setupTab === "chromium"
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChromeIcon className="w-3 h-3" />
              <span>Chromium Instructions (Chrome / Edge / Brave)</span>
            </button>
            <button
              type="button"
              onClick={() => setSetupTab("gecko")}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer",
                setupTab === "gecko"
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ZenIcon className="w-3 h-3" />
              <span>Gecko Instructions (Zen Browser / Firefox)</span>
            </button>
          </div>

          {setupTab === "chromium" ? (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 text-xs text-muted-foreground space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 1:</span>
                <span>Click <strong>Setup</strong> on your browser card above. BookVisor opens your browser directly to its extensions page and opens the unpacked folder in Windows Explorer.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 2:</span>
                <span>In the browser tab that just opened, switch on the <strong>Developer mode</strong> toggle (top-right corner).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 3:</span>
                <span><strong>Drag & drop</strong> the opened folder straight into the browser window, OR click <strong>Load unpacked</strong> and paste (<code className="text-primary font-mono">Ctrl+V</code>) the path already in your clipboard.</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 text-xs text-muted-foreground space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 1:</span>
                <span>Click <strong>Setup</strong> on the Zen or Firefox card. BookVisor opens your browser straight to <code className="text-foreground font-mono">about:debugging</code> and opens the folder in Explorer.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 2:</span>
                <span>Click <strong>This Zen</strong> (or <strong>This Firefox</strong>) in the left navigation sidebar.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">Step 3:</span>
                <div>
                  <span>Click <strong>Load Temporary Add-on...</strong> and select <code className="text-primary font-mono">manifest.json</code> from the opened folder (or paste <code className="text-primary font-mono">Ctrl+V</code>).</span>
                  <p className="mt-1.5 text-[11px] text-amber-300/90">
                    <strong>Note:</strong> Zen Browser requires the Gecko manifest with <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-[10px]">background.scripts</code> (located in the <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-[10px]">firefox</code> or <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-[10px]">zen</code> folder), not the Chrome service_worker.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Database & Reset Library Card */}
      <Card className="p-4 border border-white/[0.08] bg-card/50 backdrop-blur-xl rounded-xl space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span>Database & Library Management</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your local SQLite storage and clean-slate resets
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            Wipe all bookmarks or perform a full factory reset.
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onOpenResetLibrary?.()}
            className="text-xs h-8 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Library Options...</span>
          </Button>
        </div>
      </Card>
    </div>
  );

  const TABS: Tab[] = [
    { id: 0, label: "Appearance & Theme", content: appearanceTab },
    { id: 1, label: "AI & Hygiene", content: aiTab },
    { id: 2, label: "Sync & Storage", content: syncAndStorageTab },
    { id: 3, label: "About & Updates", content: <AboutView /> },
  ];

  return (
    <div className="w-full space-y-4 select-none pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Settings & Preferences</h1>
          <p className="text-xs text-muted-foreground">Customize BookVisor visual themes, AI inference, and browser sync</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7 px-2">
            <X className="w-4 h-4 mr-1" />
            <span>Close</span>
          </Button>
        )}
      </div>

      <DirectionAwareTabs
        tabs={TABS}
        activeTabId={activeTabId}
        onChange={(tabId) => setActiveTabId(tabId)}
      />
    </div>
  );
}

export default SettingsView;

