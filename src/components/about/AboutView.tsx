"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GitBranch,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Code2,
  Layers,
  Heart,
  User,
  Info,
  Globe,
  Database,
  Cpu,
  History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DirectionAwareTabs, type Tab } from "@/components/ui/direction-aware-tabs";
import {
  APP_VERSION,
  checkAppUpdates,
  getAutoCheckUpdates,
  setAutoCheckUpdates,
  openExternalUrl,
  type UpdateInfo,
} from "@/lib/updater";
import { WhatsNewModal } from "./WhatsNewModal";
import { LicenseModal } from "./LicenseModal";
import { UpdatePromptModal } from "./UpdatePromptModal";
import { cn } from "@/lib/utils";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.225 0z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface AboutViewProps {
  initialUpdateInfo?: UpdateInfo | null;
  onUpdateStatusChange?: (updateInfo: UpdateInfo | null) => void;
  onClose?: () => void;
}

export function AboutView({ initialUpdateInfo, onUpdateStatusChange }: AboutViewProps) {
  const [activeTab, setActiveTab] = useState<string>("about-app");
  const [autoCheck, setAutoCheck] = useState<boolean>(getAutoCheckUpdates);
  const [checking, setChecking] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(initialUpdateInfo || null);
  const [checkStatus, setCheckStatus] = useState<"idle" | "success" | "up-to-date" | "error">(
    initialUpdateInfo ? (initialUpdateInfo.updateAvailable ? "success" : "up-to-date") : "idle"
  );

  const [whatsNewOpen, setWhatsNewOpen] = useState<boolean>(false);
  const [licenseOpen, setLicenseOpen] = useState<boolean>(false);
  const [updatePromptOpen, setUpdatePromptOpen] = useState<boolean>(false);

  // Sync auto check preference
  const handleToggleAutoCheck = (checked: boolean) => {
    setAutoCheck(checked);
    setAutoCheckUpdates(checked);
  };

  // Check for updates manually
  const handleCheckUpdates = async () => {
    setChecking(true);
    setCheckStatus("idle");
    try {
      const res = await checkAppUpdates();
      setUpdateInfo(res);
      onUpdateStatusChange?.(res);
      if (res.error) {
        setCheckStatus("error");
      } else if (res.updateAvailable) {
        setCheckStatus("success");
      } else {
        setCheckStatus("up-to-date");
      }
    } catch {
      setCheckStatus("error");
    } finally {
      setChecking(false);
    }
  };

  const tabs: Tab[] = [
    {
      id: "about-app",
      label: (
        <span className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>About BookVisor</span>
        </span>
      ),
    },
    {
      id: "about-dev",
      label: (
        <span className="flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          <span>About the Developer</span>
        </span>
      ),
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Top Header & Direction Aware Segmented Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>About & System Information</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            App configuration, live release updates, legal licensing, and developer profile.
          </p>
        </div>

        <div className="flex items-center">
          <DirectionAwareTabs
            tabs={tabs}
            activeTabId={activeTab}
            onChange={(id) => setActiveTab(String(id))}
            showContent={false}
            className="border border-white/[0.06] bg-muted/40 p-1 rounded-xl"
            tabClassName="px-3.5 py-1.5 text-xs font-medium cursor-pointer"
            bubbleClassName="bg-card shadow-sm border border-white/[0.08]"
          />
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "about-app" ? (
          <motion.div
            key="about-app"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* App Hero Card */}
            <Card className="p-6 border border-white/[0.06] bg-card/70 backdrop-blur-xl rounded-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src="/bookmarked.png"
                      alt="BookVisor Logo"
                      className="h-16 w-16 rounded-2xl object-contain shadow-md border border-white/[0.08] bg-black/40 p-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-2xl font-black tracking-tight text-foreground">
                        BookVisor
                      </h1>
                      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-mono text-primary font-semibold border border-primary/30">
                        v{APP_VERSION}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      Local-First AI Bookmark Manager & Multi-Browser Sync Cockpit for Windows
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-emerald-400" />
                        <span>Local-First SQLite</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-cyan-400" />
                        <span>2-Way Browser Bridge</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3 text-blue-400" />
                        <span>Windows 11 True Mica</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-white/[0.08] hover:bg-white/[0.04] cursor-pointer"
                    onClick={() => setWhatsNewOpen(true)}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>What's New</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-white/[0.08] hover:bg-white/[0.04] cursor-pointer"
                    onClick={() => openExternalUrl("https://github.com/shuaib-07/bookvisor")}
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>GitHub</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Updates Section Card */}
            <Card className="p-5 border border-white/[0.06] bg-card/60 backdrop-blur-xl rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <RotateCw className="h-3.5 w-3.5 text-primary" />
                    <span>Application Updates</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Keep BookVisor up to date with automated link scrapers, sync improvements, and AI features.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckUpdates}
                  disabled={checking}
                  className="gap-2 h-8 text-xs border-white/[0.08] hover:bg-white/[0.04] cursor-pointer"
                >
                  <RotateCw className={cn("h-3.5 w-3.5", checking && "animate-spin text-primary")} />
                  <span>{checking ? "Checking..." : "Check for Updates"}</span>
                </Button>
              </div>

              {/* Status Banner */}
              {checkStatus !== "idle" && (
                <div
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border text-xs",
                    checkStatus === "up-to-date" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                    checkStatus === "success" && "border-primary/30 bg-primary/10 text-primary",
                    checkStatus === "error" && "border-rose-500/20 bg-rose-500/10 text-rose-400"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {checkStatus === "up-to-date" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {checkStatus === "success" && <Sparkles className="h-4 w-4 shrink-0" />}
                    {checkStatus === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>
                      {checkStatus === "up-to-date" && `BookVisor is up to date (version v${APP_VERSION}).`}
                      {checkStatus === "success" &&
                        `Update available: v${updateInfo?.latestVersion} (${updateInfo?.releaseName || "New Release"})`}
                      {checkStatus === "error" && (updateInfo?.error || "Failed to reach GitHub release servers.")}
                    </span>
                  </div>

                  {checkStatus === "success" && (
                    <Button
                      size="sm"
                      onClick={() => setUpdatePromptOpen(true)}
                      className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 cursor-pointer"
                    >
                      Update Now
                    </Button>
                  )}
                </div>
              )}

              {/* Preferences Checkbox */}
              <div className="flex items-center gap-2.5 pt-1">
                <Checkbox
                  id="auto-update-check"
                  checked={autoCheck}
                  onCheckedChange={(checked) => handleToggleAutoCheck(checked === true)}
                />
                <label
                  htmlFor="auto-update-check"
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none"
                >
                  Automatically check for updates on application startup
                </label>
              </div>
            </Card>

            {/* Core Feature Showcase Grid */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Core Capabilities & Architecture
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 2-Way Browser Sync Bridge */}
                <Card className="p-5 border border-white/[0.06] bg-card/60 backdrop-blur-xl rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">Universal 2-Way Sync</h4>
                          <span className="text-[10px] font-mono text-cyan-400 font-medium">Zen, Firefox, Chrome, Edge</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Instant bidirectional synchronization over local WebSocket. Changes in your browser reflect immediately in BookVisor, and edits in BookVisor instantly push back into your browser.
                    </p>
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Highlights:</span>
                      <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Multi-browser profile support with isolated vaults.</li>
                        <li>Zero SQLite database locks or browser crashes.</li>
                        <li>Firefox Account cloud sync propagates across devices.</li>
                      </ul>
                    </div>
                  </div>
                </Card>

                {/* AI Assistant & Semantic Search */}
                <Card className="p-5 border border-white/[0.06] bg-card/60 backdrop-blur-xl rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">AI Semantic Engine</h4>
                          <span className="text-[10px] font-mono text-primary font-medium">Local Vector Search & Chat</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Natural language search and interactive multi-session chat across your entire library. Find links by meaning and intent rather than just memorized keywords.
                    </p>
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Highlights:</span>
                      <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Persistent multi-chat sessions with rename & delete.</li>
                        <li>Automated smart AI folder categorizer.</li>
                        <li>100% private: hidden items strictly excluded from AI.</li>
                      </ul>
                    </div>
                  </div>
                </Card>

                {/* Self-Healing & Scraping Engine */}
                <Card className="p-5 border border-white/[0.06] bg-card/60 backdrop-blur-xl rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <History className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">Self-Healing & Hygiene</h4>
                          <span className="text-[10px] font-mono text-emerald-400 font-medium">Wayback Machine & Health</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Background link scraper detects 404/dead links, extracts rich OpenGraph metadata & favicons, strips UTM tracking bloat, and restores dead links from the Internet Archive.
                    </p>
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Highlights:</span>
                      <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Wayback Machine 1-click fallback recovery.</li>
                        <li>Automatic tracking parameter cleaning (utm_*, ref).</li>
                        <li>Duplicate link detector with smart merge options.</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Architecture & Stack Card */}
            <Card className="p-5 border border-white/[0.06] bg-card/50 backdrop-blur-xl rounded-2xl space-y-3">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                System Architecture & Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Runtime Platform</span>
                  <p className="font-semibold text-foreground">Tauri v2 + Rust</p>
                  <p className="text-[11px] text-muted-foreground">High performance memory-safe native backend</p>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Display Engine</span>
                  <p className="font-semibold text-foreground">Windows 11 DWM Mica</p>
                  <p className="text-[11px] text-muted-foreground">Translucent native desktop composition</p>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Storage Layer</span>
                  <p className="font-semibold text-foreground">SQLite WAL Mode</p>
                  <p className="text-[11px] text-muted-foreground">Local-first on-device data with zero telemetry</p>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Browser Bridge</span>
                  <p className="font-semibold text-foreground">Local WebSocket</p>
                  <p className="text-[11px] text-muted-foreground">Real-time bi-directional WebExtension sync</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="about-dev"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Developer Card */}
            <Card className="p-6 md:p-8 border border-white/[0.06] bg-card/70 backdrop-blur-xl rounded-2xl relative overflow-hidden space-y-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Developer Avatar SVG */}
                <div className="relative flex-shrink-0">
                  <div className="h-28 w-28 rounded-3xl border border-white/[0.08] bg-zinc-950/80 p-1 shadow-xl overflow-hidden flex items-center justify-center">
                    <img
                      src="/ic_dev_avatar.svg"
                      alt="Muhammed Shuaib"
                      className="h-full w-full object-contain filter drop-shadow"
                    />
                  </div>
                </div>

                {/* Developer Bio & Identity */}
                <div className="space-y-2 text-center md:text-left flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      Muhammed Shuaib
                    </h2>
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 w-fit mx-auto md:mx-0">
                      @shuaib-07
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80">
                    Full-Stack Developer & Infrastructure Freelancer
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl pt-1">
                    Building resilient developer tools, local-first applications, and clean client experiences.
                    Specialized in backend architectures, systems engineering, and modern desktop applications.
                  </p>
                </div>
              </div>

              {/* Developer Motivation & Story Section */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <Heart className="h-3.5 w-3.5 text-rose-400" />
                  <span>Why I Built BookVisor</span>
                </div>
                <blockquote className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-3">
                  "I collect hundreds of research papers, documentation links, and development bookmarks across different browsers.
                  Existing tools were either sluggish web apps with subscription lock-in or simple browser lists lacking semantic search.
                  I built BookVisor to give power users a 100% local-first SQLite library with instant bidirectional syncing to Zen and Firefox,
                  local AI categorization, dead link healing via Wayback Machine, and a sleek Windows 11 True Mica experience."
                </blockquote>
              </div>

              {/* Developer Social Links & Projects Grid */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Connect & Projects
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {/* GitHub Profile */}
                  <Button
                    variant="outline"
                    onClick={() => openExternalUrl("https://github.com/shuaib-07")}
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-foreground">
                      <GithubIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">GitHub Profile</span>
                      <span className="text-[10px] text-muted-foreground">@shuaib-07</span>
                    </div>
                  </Button>

                  {/* BookVisor Repository */}
                  <Button
                    variant="outline"
                    onClick={() => openExternalUrl("https://github.com/shuaib-07/bookvisor")}
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <GitBranch className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">BookVisor Repo</span>
                      <span className="text-[10px] text-muted-foreground">shuaib-07/bookvisor</span>
                    </div>
                  </Button>

                  {/* Termizen Repository */}
                  <Button
                    variant="outline"
                    onClick={() => openExternalUrl("https://github.com/shuaib-07/termizen")}
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                      <Code2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Termizen Project</span>
                      <span className="text-[10px] text-muted-foreground">shuaib-07/termizen</span>
                    </div>
                  </Button>

                  {/* LinkedIn */}
                  <Button
                    variant="outline"
                    onClick={() =>
                      openExternalUrl(
                        "https://www.linkedin.com/in/muhammed-shuaib-6430881b5?utm_source=share_via&utm_content=profile&utm_medium=member_android"
                      )
                    }
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0077b5]/20 text-[#0077b5]">
                      <LinkedinIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">LinkedIn</span>
                      <span className="text-[10px] text-muted-foreground">Muhammed Shuaib</span>
                    </div>
                  </Button>

                  {/* Email */}
                  <Button
                    variant="outline"
                    onClick={() => openExternalUrl("mailto:mdshuaib2005@gmail.com")}
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
                      <Mail className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Email</span>
                      <span className="text-[10px] text-muted-foreground">mdshuaib2005@gmail.com</span>
                    </div>
                  </Button>

                  {/* Instagram */}
                  <Button
                    variant="outline"
                    onClick={() => openExternalUrl("https://instagram.com/shuaib07_")}
                    className="justify-start gap-2.5 h-11 px-3.5 border-white/[0.06] bg-card/40 hover:bg-card/80 hover:border-white/10 text-foreground cursor-pointer"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-pink-500/10 text-pink-400">
                      <InstagramIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Instagram</span>
                      <span className="text-[10px] text-muted-foreground">@shuaib07_</span>
                    </div>
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* What's New Sheet / Modal */}
      <WhatsNewModal
        isOpen={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        latestUpdate={updateInfo}
      />

      {/* Licenses Modal */}
      <LicenseModal
        isOpen={licenseOpen}
        onClose={() => setLicenseOpen(false)}
      />

      {/* In-App Update Prompt Modal */}
      <UpdatePromptModal
        isOpen={updatePromptOpen}
        onClose={() => setUpdatePromptOpen(false)}
        updateInfo={updateInfo}
      />
    </div>
  );
}

export default AboutView;
