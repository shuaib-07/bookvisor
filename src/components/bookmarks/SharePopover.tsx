import React, { useState, useMemo } from "react";
import {
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Code2,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  url: string;
  trigger?: React.ReactNode;
  className?: string;
}

export function SharePopover({ title, url, trigger, className }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Clean tracking parameters from URL
  const cleanUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      const searchParams = new URLSearchParams(parsed.search);
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "fbclid",
        "gclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "_hsenc",
        "_hsmi",
      ];
      trackingParams.forEach((p) => searchParams.delete(p));
      parsed.search = searchParams.toString();
      return parsed.toString();
    } catch {
      return url;
    }
  }, [url]);

  const handleCopy = async (type: "clean" | "markdown" | "html") => {
    try {
      if (type === "clean") {
        await navigator.clipboard.writeText(cleanUrl);
      } else if (type === "markdown") {
        await navigator.clipboard.writeText(`[${title}](${cleanUrl})`);
      } else if (type === "html") {
        const html = `<a href="${cleanUrl}">${title}</a>`;
        if (typeof ClipboardItem !== "undefined") {
          const blobHtml = new Blob([html], { type: "text/html" });
          const blobText = new Blob([cleanUrl], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": blobHtml,
              "text/plain": blobText,
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(html);
        }
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: cleanUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy("clean");
    }
  };

  // Generate lightweight QR SVG URL
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    cleanUrl
  )}&bgcolor=141416&color=ffffff&margin=8`;

  return (
    <div className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger || (
          <button
            type="button"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
            title="Share bookmark"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop click dismiss */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setOpen(false);
                setShowQr(false);
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={SPRING_PANEL}
              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-white/[0.1] bg-[#141416]/95 backdrop-blur-xl p-3 shadow-2xl space-y-2 text-foreground"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Share2 className="w-3.5 h-3.5 text-primary" />
                  <span>Share Bookmark</span>
                </div>
                {Boolean(typeof navigator !== "undefined" && navigator.share) && (
                  <button
                    onClick={handleNativeShare}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>System Share</span>
                  </button>
                )}
              </div>

              {/* URL Display */}
              <div className="p-2 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground truncate select-all">
                  {cleanUrl}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("clean")}
                  className="p-1 rounded-md hover:bg-white/15 text-muted-foreground hover:text-foreground shrink-0 transition-colors cursor-pointer"
                  title="Copy Clean URL"
                >
                  {copiedType === "clean" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy("markdown")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>Copy as Markdown</span>
                  </div>
                  {copiedType === "markdown" ? (
                    <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">[Title](URL)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy("html")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>Copy Rich HTML Link</span>
                  </div>
                  {copiedType === "html" ? (
                    <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">&lt;a&gt;...&lt;/a&gt;</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs cursor-pointer group",
                    showQr && "bg-white/10 text-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <QrCode className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>Mobile QR Code</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {showQr ? "Hide" : "Show"}
                  </span>
                </button>
              </div>

              {/* QR Code Canvas */}
              <AnimatePresence>
                {showQr && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-1 flex flex-col items-center justify-center space-y-1.5"
                  >
                    <div className="p-2 rounded-xl bg-black/60 border border-white/[0.08] shadow-inner">
                      <img
                        src={qrSvgUrl}
                        alt="QR Code"
                        className="w-36 h-36 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center">
                      Scan with mobile phone to open link instantly
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
