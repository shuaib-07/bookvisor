import { useId, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  Globe,
  Plus,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrowserAccount } from "@/types";
import {
  ChromeIcon,
  EdgeIcon,
  BraveIcon,
  ZenIcon,
  FirefoxIcon,
} from "@/components/icons/BrowserIcons";
import { Tooltip } from "@/components/ui/tooltip";

interface VaultTabsProps {
  accounts: BrowserAccount[];
  activeAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
  onOpenConnectWizard: () => void;
  onOpenStagedDrawer?: () => void;
  stagedCount?: number;
  onDropBookmarkOnAccount?: (
    bookmarkId: string,
    targetAccountId: string,
    isMove: boolean
  ) => void;
}

export function VaultTabs({
  accounts,
  activeAccountId,
  onSelectAccount,
  onOpenConnectWizard,
  onOpenStagedDrawer,
  stagedCount = 0,
  onDropBookmarkOnAccount,
}: VaultTabsProps) {
  const pillLayoutId = useId();
  const [dragOverAccountId, setDragOverAccountId] = useState<string | null>(null);

  const getBrowserIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "chrome":
        return <ChromeIcon className="w-3.5 h-3.5 shrink-0" />;
      case "edge":
        return <EdgeIcon className="w-3.5 h-3.5 shrink-0" />;
      case "brave":
        return <BraveIcon className="w-3.5 h-3.5 shrink-0" />;
      case "zen":
        return <ZenIcon className="w-3.5 h-3.5 shrink-0" />;
      case "firefox":
        return <FirefoxIcon className="w-3.5 h-3.5 shrink-0" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-primary shrink-0" />;
    }
  };

  const handleDragOver = (e: React.DragEvent, accountId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.shiftKey ? "move" : "copy";
    if (dragOverAccountId !== accountId) {
      setDragOverAccountId(accountId);
    }
  };

  const handleDragLeave = () => {
    setDragOverAccountId(null);
  };

  const handleDrop = (e: React.DragEvent, targetAccountId: string) => {
    e.preventDefault();
    setDragOverAccountId(null);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.bookmarkId && onDropBookmarkOnAccount) {
          const isMove = e.shiftKey; // Holding Shift moves, otherwise copies
          onDropBookmarkOnAccount(data.bookmarkId, targetAccountId, isMove);
        }
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-card/40 backdrop-blur-md select-none shrink-0 overflow-x-auto no-scrollbar">
        {/* Left: Tab items */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Unified "All Accounts" Tab */}
          <motion.button
            type="button"
            layout="position"
            onClick={() => onSelectAccount(null)}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors",
              activeAccountId === null
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            )}
          >
            {activeAccountId === null && (
              <motion.div
                layoutId={pillLayoutId}
                className="absolute inset-0 z-[-1] rounded-lg border border-primary/40 bg-white/[0.09] shadow-xs"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <div className="w-4 h-4 rounded-md bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
            </div>
            <span>All Accounts (Unified)</span>
          </motion.button>

          <div className="h-4 w-[1px] bg-white/[0.08] mx-1 shrink-0" />

          {/* Connected Account Tabs */}
          {accounts.map((acc) => {
            const isActive = activeAccountId === acc.id;
            const isDragOver = dragOverAccountId === acc.id;

            return (
              <Tooltip
                key={acc.id}
                content={
                  acc.user_email
                    ? `${acc.display_name} (${acc.user_email}) — Drag bookmark here to copy (Shift+Drag to move)`
                    : `${acc.display_name} — Drag bookmark here to copy`
                }
              >
                <motion.button
                  type="button"
                  layout="position"
                  onClick={() => onSelectAccount(acc.id)}
                  onDragOver={(e) => handleDragOver(e, acc.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, acc.id)}
                  whileTap={{ scale: 0.96 }}
                  className={cn(
                    "relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors",
                    isActive
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                    isDragOver && "ring-2 ring-primary bg-primary/20 scale-105"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={pillLayoutId}
                      className="absolute inset-0 z-[-1] rounded-lg border shadow-xs bg-white/[0.09]"
                      style={{
                        borderColor: `${acc.color_dot}60`,
                      }}
                      transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                    />
                  )}

                  {/* Account Color Dot */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: acc.color_dot }}
                  />

                  {/* Browser Logo Icon */}
                  {getBrowserIcon(acc.icon_name || acc.browser_type)}

                  {/* Display Name */}
                  <span className="truncate max-w-[140px]">{acc.display_name}</span>

                  {/* Bookmark Count Badge */}
                  {acc.bookmark_count !== undefined && acc.bookmark_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.08] font-mono text-muted-foreground/90">
                      {acc.bookmark_count}
                    </span>
                  )}
                </motion.button>
              </Tooltip>
            );
          })}

          {/* "+ Connect Profile" Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onOpenConnectWizard}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.06] border border-dashed border-white/[0.12] transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Profile</span>
          </motion.button>
        </div>

        {/* Right: Staged Review indicator if pending mutations exist */}
        {stagedCount > 0 && onOpenStagedDrawer && (
          <Tooltip content="Review pending changes before syncing to browsers">
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenStagedDrawer}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-all cursor-pointer shrink-0 animate-pulse"
            >
              <Clock className="w-3 h-3" />
              <span>{stagedCount} Unsynced Change{stagedCount === 1 ? "" : "s"}</span>
            </motion.button>
          </Tooltip>
        )}
      </div>
    </MotionConfig>
  );
}
