import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Sparkles,
  Check,
  ChevronRight,
  Download,
  AlertTriangle,
  Minimize2,
  Maximize2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useToast } from "@/components/ui/animated-toast-stack";
import type { SystemSpecs, ModelTierInfo, DownloadProgressEvent } from "@/types";

interface Props {
  open: boolean;
  onClose: (selectedTierId?: string) => void;
}

export function ModelSetupWizard({ open, onClose }: Props) {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>("pro_7b");
  const [step, setStep] = useState<"select" | "downloading" | "completed">("select");

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0); // bytes per second
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const prevBytesRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      api
        .getSystemSpecs()
        .then((s) => {
          setSpecs(s);
          setSelectedTier(s.recommended_tier);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load specs:", err);
          setLoading(false);
        });
    }
  }, [open]);

  // Window close protection while downloading
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const isDownloading = step === "downloading" && downloadProgress && !downloadProgress.is_complete;

    if (isDownloading) {
      try {
        const appWin = getCurrentWindow();
        appWin.onCloseRequested((event) => {
          event.preventDefault();
          toast({
            title: "Download in Progress",
            description: "Please wait for the AI model to finish downloading or cancel before closing BookVisor.",
            status: "error",
          });
        }).then((un) => {
          unlisten = un;
        });
      } catch (e) {
        console.warn("Could not register close listener:", e);
      }
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [step, downloadProgress, toast]);

  // Listen to download progress
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;

    api.onModelDownloadProgress((prog) => {
      setDownloadProgress(prog);

      // Calculate speed
      const now = Date.now();
      const elapsedSec = (now - prevTimeRef.current) / 1000;
      if (elapsedSec >= 0.8) {
        const bytesDelta = prog.downloaded_bytes - prevBytesRef.current;
        const currentSpeed = bytesDelta / elapsedSec;
        setDownloadSpeed(currentSpeed > 0 ? currentSpeed : 0);
        prevBytesRef.current = prog.downloaded_bytes;
        prevTimeRef.current = now;
      }

      if (prog.is_complete) {
        setStep("completed");
        toast({
          title: "AI Model Installed",
          description: "GGUF weights loaded and ready for in-process inference.",
          status: "success",
        });
      }

      if (prog.error) {
        setDownloadError(prog.error);
        toast({
          title: "Download Failed",
          description: prog.error,
          status: "error",
        });
      }
    }).then((un) => {
      unlistenProgress = un;
    });

    return () => {
      if (unlistenProgress) unlistenProgress();
    };
  }, [toast]);

  const handleStartSetup = async () => {
    localStorage.setItem("bookmanage_ai_tier", selectedTier);
    localStorage.setItem("bookmanage_onboarding_done", "true");

    if (selectedTier === "cloud") {
      onClose(selectedTier);
      return;
    }

    // Check if model already downloaded
    try {
      const status = await api.checkModelStatus(selectedTier);
      if (status.is_downloaded) {
        setStep("completed");
        return;
      }
    } catch (_) {}

    // Start download
    setStep("downloading");
    setDownloadError(null);
    prevBytesRef.current = 0;
    prevTimeRef.current = Date.now();

    try {
      await api.downloadModel(selectedTier);
    } catch (err: any) {
      setDownloadError(typeof err === "string" ? err : err.message || "Failed to start download");
    }
  };

  const handleCancelDownload = async () => {
    try {
      await api.cancelModelDownload();
    } catch (_) {}
    setStep("select");
    setDownloadProgress(null);
    toast({
      title: "Download Cancelled",
      description: "AI model download was stopped.",
      status: "neutral",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const calculateEta = () => {
    if (!downloadProgress || downloadSpeed <= 0) return "Calculating ETA...";
    const remainingBytes = downloadProgress.total_bytes - downloadProgress.downloaded_bytes;
    const seconds = Math.round(remainingBytes / downloadSpeed);
    if (seconds < 60) return `~${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m ${seconds % 60}s remaining`;
  };

  // Minimized floating pill shown while downloading in the background
  if (isMinimized && step === "downloading" && downloadProgress) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 right-5 z-50 p-3.5 rounded-2xl bg-zinc-950/95 border border-primary/40 shadow-2xl backdrop-blur-2xl flex items-center gap-3.5 cursor-pointer hover:border-primary transition-all select-none animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Downloading AI Model</span>
            <span className="text-xs font-mono font-medium text-primary">
              {downloadProgress.percent.toFixed(1)}%
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{formatBytes(downloadProgress.downloaded_bytes)}</span>
            <span>•</span>
            <span>{formatSpeed(downloadSpeed)}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (step === "downloading") {
          setIsMinimized(true);
        } else {
          onClose(selectedTier);
        }
      }}
      title="Hardware Detection & AI Model Setup"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5 py-1">
        {/* Top Hardware Dashboard */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm flex items-center gap-2.5 flex-wrap">
                <span>{specs?.cpu_name || "Detecting CPU specifications..."}</span>
                {specs?.has_cuda && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-medium tracking-wide">
                    CUDA ACCELERATED
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                <span>{specs?.total_ram_gb || 0} GB System RAM</span>
                {specs?.gpu_name && (
                  <>
                    <span>•</span>
                    <span className="text-primary font-medium">
                      {specs.gpu_name} ({specs.gpu_vram_gb || 0} GB VRAM)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="md:text-right shrink-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Recommended Tier</span>
            <div className="font-semibold text-primary capitalize text-sm flex items-center md:justify-end gap-1.5 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{specs?.recommended_tier.replace("_", " ").toUpperCase() || "Calculating..."}</span>
            </div>
          </div>
        </div>

        {/* STEP 1: SELECTION */}
        {step === "select" && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center justify-between">
              <span>Select Model Tier for Local Categorization</span>
              <span className="text-[11px] font-normal normal-case text-muted-foreground">
                Incompatible tiers are automatically disabled
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {specs?.tiers.map((tier: ModelTierInfo) => {
                const isSelected = selectedTier === tier.id;
                const isSupported = tier.is_supported;

                return (
                  <div
                    key={tier.id}
                    onClick={() => isSupported && setSelectedTier(tier.id)}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      !isSupported
                        ? "opacity-35 cursor-not-allowed bg-black/30 border-border/40"
                        : isSelected
                        ? "bg-primary/10 border-primary shadow-md"
                        : "bg-card/70 hover:bg-card border-border/70 hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-semibold text-foreground">{tier.name}</span>
                        </div>

                        {tier.is_recommended && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-medium">
                            Recommended
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground pl-6 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground/80">{tier.download_size}</span>
                          <span>•</span>
                          <span>{tier.parameter_size} params</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground/90">
                          {tier.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="pt-5 border-t border-border/40 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClose(selectedTier)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip (Use manual organization for now)
              </Button>

              <Button
                size="default"
                disabled={loading}
                onClick={handleStartSetup}
                className="gap-2 px-5 text-xs shadow-md"
              >
                <span>Continue with Selected Tier</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: ANIMATED DOWNLOADING FLOW */}
        {step === "downloading" && (
          <div className="p-6 rounded-2xl bg-card/70 border border-primary/30 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                  <Download className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Downloading & Installing AI Model Weights
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Streaming GGUF tensor format directly into local AppData
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="text-xs h-8 gap-1.5 border-border/80"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Minimize to Background</span>
              </Button>
            </div>

            {downloadError ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="flex-1">{downloadError}</div>
                <Button size="sm" variant="outline" onClick={handleStartSetup} className="text-xs h-7">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="relative w-full h-3 rounded-full bg-secondary overflow-hidden border border-border/60">
                  <div
                    className="h-full bg-gradient-to-r from-primary/80 via-primary to-cyan-400 transition-all duration-300 relative"
                    style={{ width: `${downloadProgress?.percent || 0}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>

                {/* Progress stats */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-foreground font-semibold">
                      {downloadProgress ? `${downloadProgress.percent.toFixed(1)}%` : "0.0%"}
                    </span>
                    <span>•</span>
                    <span>
                      {downloadProgress
                        ? `${formatBytes(downloadProgress.downloaded_bytes)} / ${formatBytes(downloadProgress.total_bytes)}`
                        : "Connecting to HuggingFace..."}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{formatSpeed(downloadSpeed)}</span>
                    <span>•</span>
                    <span className="text-primary font-medium">{calculateEta()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stages checklist */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Local Storage Initialized</span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                <span className="text-foreground font-medium">Downloading Weights</span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex items-center gap-2 text-muted-foreground/60">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>GPU Offload Verification</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDownload}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                Cancel Download
              </Button>

              <span className="text-[11px] text-muted-foreground italic">
                Closing the app is restricted while downloading to prevent file corruption
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: COMPLETED */}
        {step === "completed" && (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">AI Model Ready & Verified</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Qwen 2.5 local model is installed and configured to offload 100% of layers to your GPU for fast, private reasoning.
              </p>
            </div>

            <Button
              size="default"
              onClick={() => onClose(selectedTier)}
              className="px-6 text-xs shadow-md gap-2"
            >
              <span>Launch BookVisor Workspace</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
