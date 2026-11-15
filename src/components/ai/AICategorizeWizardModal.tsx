import { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Folder as FolderIcon,
  Check,
  RotateCcw,
  Layers,
  Lock,
  Send,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import type {
  AIOrganizationPlan,
  AITaxonomyStrategy,
  Folder,
} from "@/types";

interface Props {
  open: boolean;
  scopeFolder: Folder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AICategorizeWizardModal({
  open,
  scopeFolder,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<AIOrganizationPlan | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("by_tech");
  const [instruction, setInstruction] = useState("");
  const [selectedMoves, setSelectedMoves] = useState<Record<string, boolean>>({});

  const generatePlan = async (userPrompt?: string) => {
    setLoading(true);
    try {
      const scopeId = scopeFolder ? scopeFolder.id : null;
      const res = await api.aiGeneratePlan(scopeId, userPrompt || null);
      setPlan(res);

      if (res.strategies.length > 0) {
        const defaultStrat = res.strategies[0];
        setSelectedStrategyId(defaultStrat.id);
        const map: Record<string, boolean> = {};
        for (const m of defaultStrat.moves) {
          map[m.bookmark_id] = true;
        }
        setSelectedMoves(map);
      }
    } catch (e) {
      console.error("AI Plan generation failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setInstruction("");
      generatePlan();
    }
  }, [open, scopeFolder]);

  const handleStrategyChange = (strat: AITaxonomyStrategy) => {
    setSelectedStrategyId(strat.id);
    const map: Record<string, boolean> = {};
    for (const m of strat.moves) {
      map[m.bookmark_id] = true;
    }
    setSelectedMoves(map);
  };

  const handleApply = async () => {
    if (!currentStrategy) return;
    setApplying(true);
    try {
      const movesToApply = currentStrategy.moves.filter(
        (m) => selectedMoves[m.bookmark_id] !== false
      );
      await api.aiApplyPlan(movesToApply);
      onSuccess();
      onClose();
    } catch (e) {
      console.error("Failed to apply AI plan:", e);
    } finally {
      setApplying(false);
    }
  };

  const currentStrategy =
    plan?.strategies.find((s) => s.id === selectedStrategyId) ||
    plan?.strategies[0];

  const activeMovesCount = currentStrategy
    ? currentStrategy.moves.filter((m) => selectedMoves[m.bookmark_id] !== false)
        .length
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>
            {scopeFolder
              ? scopeFolder.id === "unorganized"
                ? "AI Organize: Unorganized / Inbox"
                : `AI Subfolder Deep Dive: ${scopeFolder.title}`
              : "AI Organization & Taxonomy Wizard"}
          </span>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 py-1 text-xs select-none">
        {/* Scope and Context Banner */}
        <div className="p-3 rounded-xl bg-card border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-muted-foreground">Scope: </span>
              <strong className="text-foreground">
                {scopeFolder
                  ? scopeFolder.id === "unorganized"
                    ? "Unorganized / Inbox"
                    : `Folder "${scopeFolder.title}" (Subfolders)`
                  : "Entire Library"}
              </strong>
              <span className="text-muted-foreground ml-2">
                ({plan?.total_bookmarks_analyzed || 0} bookmarks analyzed)
              </span>
            </div>
          </div>

          {(plan?.locked_folders_preserved.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <Lock className="w-3 h-3" />
              <span>
                {plan?.locked_folders_preserved.length} locked folders preserved
              </span>
            </div>
          )}
        </div>

        {/* 1. Strategy Selection Cards */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Select Organization Strategy
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {plan?.strategies.map((strat) => {
              const isSelected = selectedStrategyId === strat.id;
              return (
                <div
                  key={strat.id}
                  onClick={() => handleStrategyChange(strat)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? "bg-primary/15 border-primary shadow-xs ring-1 ring-primary/40"
                      : "bg-card/60 hover:bg-card border-border/70 hover:border-border"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-foreground text-xs flex items-center justify-between gap-1">
                      <span>{strat.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed whitespace-normal break-words">
                      {strat.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40 text-[10px] font-mono text-primary flex items-center gap-1 shrink-0">
                    <FolderPlus className="w-3 h-3" />
                    <span>{strat.moves.length} moves proposed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Interactive Prompt Refinement */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Prompt-Driven Refinement (Conversational Adjustment)
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) {
                generatePlan(instruction.trim());
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="e.g. In Coding, separate React from React Native, and put icon registries into their own subfolder..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-card border border-border/70 focus:border-primary focus:outline-none text-foreground text-xs placeholder:text-muted-foreground/60 transition-colors"
            />
            <Button
              type="submit"
              disabled={loading || !instruction.trim()}
              size="sm"
              className="h-8 gap-1.5 text-xs px-3"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Refine</span>
            </Button>
          </form>
        </div>

        {/* 3. Visual Diff Preview Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={
                    Boolean(
                      currentStrategy?.moves.length &&
                        activeMovesCount === currentStrategy.moves.length
                    )
                  }
                  onCheckedChange={(val) => {
                    const checked = Boolean(val);
                    const next: Record<string, boolean> = {};
                    currentStrategy?.moves.forEach((m) => {
                      next[m.bookmark_id] = checked;
                    });
                    setSelectedMoves(next);
                  }}
                  aria-label="Select all proposed moves"
                />
              </div>
              <span>Proposed Moves & New Subfolder Tree</span>
            </div>
            <span>
              {activeMovesCount} of {currentStrategy?.moves.length || 0} moves
              selected
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-card/40 p-2 space-y-1.5">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>AI analyzing bookmarks and generating taxonomy...</span>
              </div>
            ) : currentStrategy && currentStrategy.moves.length > 0 ? (
              currentStrategy.moves.map((m) => {
                const isChecked = selectedMoves[m.bookmark_id] !== false;
                return (
                  <div
                    key={m.bookmark_id}
                    onClick={() =>
                      setSelectedMoves((prev) => ({
                        ...prev,
                        [m.bookmark_id]: !isChecked,
                      }))
                    }
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-card border-border/80"
                        : "opacity-40 bg-secondary/20 border-border/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(val) =>
                            setSelectedMoves((prev) => ({
                              ...prev,
                              [m.bookmark_id]: Boolean(val),
                            }))
                          }
                          aria-label={`Select move for ${m.bookmark_title}`}
                        />
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {m.bookmark_title}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                        {m.clean_url}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.2 rounded bg-secondary text-muted-foreground text-[10px]">
                        {m.current_folder}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-medium text-[11px] flex items-center gap-1">
                        <FolderIcon className="w-3 h-3" />
                        {m.target_folder_path}
                      </span>
                      {m.suggested_tags.length > 0 && (
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          #{m.suggested_tags[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No bookmark moves needed for this scope.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-2 flex items-center justify-between border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generatePlan()}
            disabled={loading || applying}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Proposal</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={applying}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={loading || applying || activeMovesCount === 0}
              className="gap-1.5 text-xs px-4"
            >
              {applying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Apply Changes ({activeMovesCount} moves)</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
