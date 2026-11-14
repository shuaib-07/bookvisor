"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ListFilter,
  Check,
  Search,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { SPRING_PANEL } from "@/lib/ease";
import { Button } from "@/components/ui/button";
import { FieldHeader } from "@/components/ui/field-header";
import { NativeDelete } from "@/components/NativeDelete";
import {
  ICON_CATEGORIES,
  ICON_CATALOG,
  type IconCategory,
} from "@/components/tags/TagManagerModal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CustomList } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onListSaved: (list: CustomList) => void;
  onListDeleted?: (id: string) => void;
  editingList?: CustomList | null;
}

const COLOR_PALETTE = [
  { name: "Blue", hex: "#3b82f6" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Rose", hex: "#ef4444" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Orange", hex: "#f97316" },
  { name: "Slate", hex: "#64748b" },
];

export function ListManagerModal({
  isOpen,
  onClose,
  onListSaved,
  onListDeleted,
  editingList,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [selectedIcon, setSelectedIcon] = useState<string>("Bookmark");
  const [iconCategory, setIconCategory] = useState<IconCategory>("all");
  const [iconSearch, setIconSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingList) {
        setName(editingList.name);
        setDescription(editingList.description || "");
        setSelectedColor(editingList.color || "#3b82f6");
        setSelectedIcon(editingList.icon || "Bookmark");
      } else {
        setName("");
        setDescription("");
        setSelectedColor("#3b82f6");
        setSelectedIcon("Bookmark");
      }
      setIconSearch("");
      setIconCategory("all");
    }
  }, [isOpen, editingList]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredIcons = useMemo(() => {
    let list = ICON_CATALOG;
    if (iconCategory !== "all") {
      list = list.filter((item) => item.category === iconCategory);
    }
    if (iconSearch.trim()) {
      const q = iconSearch.toLowerCase();
      list = list.filter(
        (item) => item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [iconCategory, iconSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (editingList) {
        const updated = await api.updateList(
          editingList.id,
          trimmed,
          description.trim() || null,
          selectedColor,
          selectedIcon
        );
        onListSaved(updated);
      } else {
        const created = await api.createList(
          trimmed,
          description.trim() || null,
          selectedColor,
          selectedIcon
        );
        onListSaved(created);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save list:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingList) return;
    try {
      await api.deleteList(editingList.id);
      onListDeleted?.(editingList.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete list:", err);
    }
  };

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  // Selected icon preview
  const catalogMatch = ICON_CATALOG.find((item) => item.id === selectedIcon);
  const SelectedIconComponent = catalogMatch?.component;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={SPRING_PANEL}
        className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#141416]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ListFilter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingList ? "Edit List" : "Create New List"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Logical bookmark collections across folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* List Name */}
          <div className="space-y-1.5">
            <FieldHeader icon={ListFilter} label="List Name" />
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Reading List, AI Tools, Client Work..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-card border border-white/[0.08] focus:border-primary/50 focus:outline-none text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <FieldHeader icon={Sparkles} label="Description (Optional)" />
            <input
              type="text"
              placeholder="Brief description of this list..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-card border border-white/[0.08] focus:border-primary/50 focus:outline-none text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          {/* Color Swatch */}
          <div className="space-y-1.5">
            <FieldHeader icon={ListFilter} label="List Accent Color" />
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-transform cursor-pointer border border-white/20",
                    selectedColor === c.hex
                      ? "scale-115 ring-2 ring-primary ring-offset-2 ring-offset-[#141416]"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {selectedColor === c.hex && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon & Emoji Catalog */}
          <div className="space-y-2">
            <FieldHeader icon={Sparkles} label="List Icon / Emoji" />

            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {ICON_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setIconCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer",
                    iconCategory === cat.id
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground border border-transparent"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Icon Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search 150+ icons and emojis..."
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-card border border-white/[0.08] text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>

            {/* Icons Grid */}
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-xl bg-black/30 border border-white/[0.06]">
              {filteredIcons.map((item) => {
                const IconComp = item.component;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    title={item.name}
                    className={cn(
                      "h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-xs",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs scale-105"
                        : "bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/10"
                    )}
                  >
                    {item.emoji ? (
                      <span className="text-sm">{item.emoji}</span>
                    ) : IconComp ? (
                      <IconComp className="w-3.5 h-3.5" />
                    ) : (
                      <span>{item.id.slice(0, 2)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
              Preview
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-white/[0.08] shadow-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: selectedColor }}
              />
              {catalogMatch?.emoji ? (
                <span className="text-sm">{catalogMatch.emoji}</span>
              ) : SelectedIconComponent ? (
                <SelectedIconComponent className="w-3.5 h-3.5 text-foreground" />
              ) : (
                <ListFilter className="w-3.5 h-3.5 text-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">
                {name || "Untitled List"}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            {editingList ? (
              <NativeDelete
                size="sm"
                onConfirm={() => {}}
                onDelete={handleDelete}
                buttonText="Delete List"
                confirmText="Confirm Delete"
              />
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-xl h-8">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || isSubmitting}
                className="rounded-xl h-8 gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{editingList ? "Save Changes" : "Create List"}</span>
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
