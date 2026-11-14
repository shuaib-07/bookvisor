import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Trash2,
  Edit2,
  Tag as TagIcon,
  Search,
  Check,
  Palette,
  Sparkles,
  Bookmark,
  Star,
  Heart,
  Zap,
  Flame,
  Pin,
  Flag,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Hash,
  Link,
  Eye,
  Lightbulb,
  Bell,
  Compass,
  Shield,
  ThumbsUp,
  Smile,
  Code,
  Terminal,
  Cpu,
  Layers,
  Globe,
  Database,
  Server,
  GitBranch,
  GitPullRequest,
  Bug,
  FolderGit2,
  Binary,
  FileCode,
  Laptop,
  Smartphone,
  Key,
  Lock,
  Workflow,
  Braces,
  Cloud,
  HardDrive,
  Monitor,
  Wifi,
  Brush,
  Image as ImageIcon,
  Camera,
  Video,
  Film,
  Music,
  Headphones,
  Mic,
  Volume2,
  PenTool,
  Newspaper,
  BookOpen,
  Book,
  Glasses,
  Play,
  Tv,
  Radio,
  Feather,
  Scissors,
  Briefcase,
  Calendar,
  Clock,
  CheckSquare,
  Inbox,
  Mail,
  Send,
  Archive,
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  CreditCard,
  Coins,
  Target,
  Award,
  Coffee,
  Building,
  ShoppingBag,
  ShoppingCart,
  Wrench,
  Hammer,
  Cog,
  Settings,
  Sliders,
  Package,
  Box,
  Rocket,
  Atom,
  FlaskConical,
  Microscope,
  MapPin,
  Plane,
  Car,
  Bike,
  Truck,
  Sun,
  Moon,
  Anchor,
} from "lucide-react";
import { motion } from "framer-motion";
import { SPRING_PANEL } from "@/lib/ease";
import { Button } from "@/components/ui/button";
import { TagBadge } from "./TagBadge";
import { FieldHeader } from "@/components/ui/field-header";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TagItem } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdated: () => void;
  initialTagToEdit?: string | TagItem | null;
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

export const ICON_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "essentials", label: "✨ Essentials" },
  { id: "tech", label: "💻 Tech" },
  { id: "creative", label: "🎨 Creative" },
  { id: "work", label: "💼 Work" },
  { id: "tools", label: "🛠️ Tools" },
  { id: "emojis", label: "😀 Emojis" },
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number]["id"];

export interface IconCatalogItem {
  id: string; // Stored value in DB (either Lucide icon name or emoji string)
  name: string; // Searchable keywords
  category: "essentials" | "tech" | "creative" | "work" | "tools" | "emojis";
  component?: React.ComponentType<{ className?: string }>;
  emoji?: string;
}

export const ICON_CATALOG: IconCatalogItem[] = [
  // ✨ Essentials
  { id: "Tag", name: "tag label mark", category: "essentials", component: TagIcon },
  { id: "Bookmark", name: "bookmark save ribbon", category: "essentials", component: Bookmark },
  { id: "Star", name: "star favorite rating", category: "essentials", component: Star },
  { id: "Heart", name: "heart love favorite like", category: "essentials", component: Heart },
  { id: "Sparkles", name: "sparkles magic ai clean star", category: "essentials", component: Sparkles },
  { id: "Pin", name: "pin stick keep top", category: "essentials", component: Pin },
  { id: "Flag", name: "flag mark country priority", category: "essentials", component: Flag },
  { id: "Flame", name: "flame fire hot trending", category: "essentials", component: Flame },
  { id: "Zap", name: "zap lightning flash fast power energy", category: "essentials", component: Zap },
  { id: "CheckCircle2", name: "check done complete success", category: "essentials", component: CheckCircle2 },
  { id: "AlertCircle", name: "alert warning danger caution notice", category: "essentials", component: AlertCircle },
  { id: "Info", name: "info notice help details", category: "essentials", component: Info },
  { id: "HelpCircle", name: "help question support faq", category: "essentials", component: HelpCircle },
  { id: "Hash", name: "hash number tag topic channel", category: "essentials", component: Hash },
  { id: "Link", name: "link url web chain hyper", category: "essentials", component: Link },
  { id: "Eye", name: "eye view watch look inspect", category: "essentials", component: Eye },
  { id: "Lightbulb", name: "lightbulb idea inspiration bright tip", category: "essentials", component: Lightbulb },
  { id: "Bell", name: "bell reminder notification alert chime", category: "essentials", component: Bell },
  { id: "Compass", name: "compass explore guide navigate discover", category: "essentials", component: Compass },
  { id: "Shield", name: "shield secure protect safety guard", category: "essentials", component: Shield },
  { id: "ThumbsUp", name: "thumbs up like agree approve good", category: "essentials", component: ThumbsUp },
  { id: "Smile", name: "smile happy face joy friendly", category: "essentials", component: Smile },

  // 💻 Tech / Dev
  { id: "Code", name: "code program syntax dev script", category: "tech", component: Code },
  { id: "Terminal", name: "terminal console shell cli bash prompt", category: "tech", component: Terminal },
  { id: "Cpu", name: "cpu processor chip hardware intel amd arm", category: "tech", component: Cpu },
  { id: "Layers", name: "layers stack architecture design framework", category: "tech", component: Layers },
  { id: "Globe", name: "globe web internet network online site", category: "tech", component: Globe },
  { id: "Database", name: "database sql storage sqlite postgres table", category: "tech", component: Database },
  { id: "Server", name: "server backend cloud hosting node cluster", category: "tech", component: Server },
  { id: "GitBranch", name: "git branch repository merge vcs source", category: "tech", component: GitBranch },
  { id: "GitPullRequest", name: "git pull request pr review commit", category: "tech", component: GitPullRequest },
  { id: "Bug", name: "bug debug error issue fix inspect", category: "tech", component: Bug },
  { id: "FolderGit2", name: "git folder repo project workspace", category: "tech", component: FolderGit2 },
  { id: "Binary", name: "binary machine lowlevel bytes bits", category: "tech", component: Binary },
  { id: "FileCode", name: "file code snippet source script html css js", category: "tech", component: FileCode },
  { id: "Laptop", name: "laptop computer macbook pc device screen", category: "tech", component: Laptop },
  { id: "Smartphone", name: "smartphone mobile phone android ios app", category: "tech", component: Smartphone },
  { id: "Key", name: "key auth secret password token access api", category: "tech", component: Key },
  { id: "Lock", name: "lock security private encrypt ssl guard", category: "tech", component: Lock },
  { id: "Workflow", name: "workflow pipeline automation process ci cd", category: "tech", component: Workflow },
  { id: "Braces", name: "braces json object code bracket curly", category: "tech", component: Braces },
  { id: "Cloud", name: "cloud aws gcp azure saas storage online", category: "tech", component: Cloud },
  { id: "HardDrive", name: "harddrive disk storage hdd ssd drive memory", category: "tech", component: HardDrive },
  { id: "Monitor", name: "monitor screen display desktop terminal", category: "tech", component: Monitor },
  { id: "Wifi", name: "wifi network wireless internet connect signal", category: "tech", component: Wifi },

  // 🎨 Creative / Media
  { id: "Palette", name: "palette art design color theme painter css", category: "creative", component: Palette },
  { id: "Brush", name: "brush paint draw artwork creative canvas", category: "creative", component: Brush },
  { id: "Image", name: "image photo picture gallery wallpaper graphic", category: "creative", component: ImageIcon },
  { id: "Camera", name: "camera photo lens shoot photography", category: "creative", component: Camera },
  { id: "Video", name: "video movie recording film clip player", category: "creative", component: Video },
  { id: "Film", name: "film movie cinema reel stream show", category: "creative", component: Film },
  { id: "Music", name: "music song audio sound melody track spotify", category: "creative", component: Music },
  { id: "Headphones", name: "headphones audio listen podcast music sound", category: "creative", component: Headphones },
  { id: "Mic", name: "mic microphone voice speak podcast audio record", category: "creative", component: Mic },
  { id: "Volume2", name: "volume sound speaker loud listen audio", category: "creative", component: Volume2 },
  { id: "PenTool", name: "pentool figma vector bezier illustrator design", category: "creative", component: PenTool },
  { id: "Newspaper", name: "newspaper article news press feed blog post", category: "creative", component: Newspaper },
  { id: "BookOpen", name: "book open read study literature manual", category: "creative", component: BookOpen },
  { id: "Book", name: "book read library textbook fiction doc", category: "creative", component: Book },
  { id: "Glasses", name: "glasses read look style vision reader", category: "creative", component: Glasses },
  { id: "Play", name: "play video audio start stream media", category: "creative", component: Play },
  { id: "Tv", name: "tv television monitor screen display broadcast", category: "creative", component: Tv },
  { id: "Radio", name: "radio broadcast audio stream tune podcast", category: "creative", component: Radio },
  { id: "Feather", name: "feather write author poem gentle quill", category: "creative", component: Feather },
  { id: "Scissors", name: "scissors cut craft edit trim design", category: "creative", component: Scissors },

  // 💼 Work / Business
  { id: "Briefcase", name: "briefcase work business portfolio career job", category: "work", component: Briefcase },
  { id: "Calendar", name: "calendar date schedule event month plan", category: "work", component: Calendar },
  { id: "Clock", name: "clock time hour minute schedule history", category: "work", component: Clock },
  { id: "CheckSquare", name: "check square todo task list completed", category: "work", component: CheckSquare },
  { id: "Inbox", name: "inbox incoming messages items unread queue", category: "work", component: Inbox },
  { id: "Mail", name: "mail email message envelope contact send", category: "work", component: Mail },
  { id: "Send", name: "send message forward paper plane deliver", category: "work", component: Send },
  { id: "Archive", name: "archive vault store backup drawer history", category: "work", component: Archive },
  { id: "BarChart3", name: "chart analytics stats metrics report data", category: "work", component: BarChart3 },
  { id: "PieChart", name: "pie chart analytics stats segments metrics", category: "work", component: PieChart },
  { id: "TrendingUp", name: "trend up growth stock finance crypto bull", category: "work", component: TrendingUp },
  { id: "DollarSign", name: "dollar money cash price cost revenue profit", category: "work", component: DollarSign },
  { id: "CreditCard", name: "card payment buy billing bank checkout", category: "work", component: CreditCard },
  { id: "Coins", name: "coins money gold tokens crypto cash wealth", category: "work", component: Coins },
  { id: "Target", name: "target goal aim objective bullseye mission", category: "work", component: Target },
  { id: "Award", name: "award badge prize medal honor win achievement", category: "work", component: Award },
  { id: "Coffee", name: "coffee tea break cafe morning energy drink", category: "work", component: Coffee },
  { id: "Building", name: "building office company corporate enterprise", category: "work", component: Building },
  { id: "ShoppingBag", name: "bag shopping store retail ecommerce purchase", category: "work", component: ShoppingBag },
  { id: "ShoppingCart", name: "cart shopping buy order ecommerce store", category: "work", component: ShoppingCart },

  // 🛠️ Tools & Science
  { id: "Wrench", name: "wrench tool fix repair configure maintenance", category: "tools", component: Wrench },
  { id: "Hammer", name: "hammer tool build construct craft work", category: "tools", component: Hammer },
  { id: "Cog", name: "cog gear settings configure engine mechanism", category: "tools", component: Cog },
  { id: "Settings", name: "settings preferences options configure setup", category: "tools", component: Settings },
  { id: "Sliders", name: "sliders filter adjust control tweak equalizer", category: "tools", component: Sliders },
  { id: "Package", name: "package box npm cargo crate parcel deploy", category: "tools", component: Package },
  { id: "Box", name: "box container storage cube element item", category: "tools", component: Box },
  { id: "Rocket", name: "rocket launch deploy fast startup speed blast", category: "tools", component: Rocket },
  { id: "Atom", name: "atom science react physics research lab", category: "tools", component: Atom },
  { id: "FlaskConical", name: "flask test experiment lab chemistry science", category: "tools", component: FlaskConical },
  { id: "Microscope", name: "microscope research science study inspect look", category: "tools", component: Microscope },
  { id: "MapPin", name: "map pin location place destination marker spot", category: "tools", component: MapPin },
  { id: "Plane", name: "plane flight travel airline vacation transport", category: "tools", component: Plane },
  { id: "Car", name: "car auto drive vehicle road travel transport", category: "tools", component: Car },
  { id: "Bike", name: "bike bicycle cycle ride sport transit", category: "tools", component: Bike },
  { id: "Truck", name: "truck transport delivery freight shipping vehicle", category: "tools", component: Truck },
  { id: "Sun", name: "sun day bright weather light morning outdoor", category: "tools", component: Sun },
  { id: "Moon", name: "moon night dark sleep astronomy space", category: "tools", component: Moon },
  { id: "Anchor", name: "anchor marine maritime port sea hold dock", category: "tools", component: Anchor },

  // 😀 Emojis (Popular Curated Set)
  { id: "⭐", name: "star favorite rating golden glow", category: "emojis", emoji: "⭐" },
  { id: "🔥", name: "fire flame hot trending lit viral", category: "emojis", emoji: "🔥" },
  { id: "⚡", name: "zap lightning high voltage fast speed electric", category: "emojis", emoji: "⚡" },
  { id: "💡", name: "idea light bulb thought eureka innovation", category: "emojis", emoji: "💡" },
  { id: "🎯", name: "target bullseye goal focus aim direct", category: "emojis", emoji: "🎯" },
  { id: "💎", name: "gem diamond crystal luxury rare premium", category: "emojis", emoji: "💎" },
  { id: "❤️", name: "heart love favorite red passion sweet", category: "emojis", emoji: "❤️" },
  { id: "✨", name: "sparkles magic stars clean shiny ai", category: "emojis", emoji: "✨" },
  { id: "🚀", name: "rocket ship blast off launch startup fast", category: "emojis", emoji: "🚀" },
  { id: "📌", name: "pushpin pin pinned mark stick note", category: "emojis", emoji: "📌" },
  { id: "🏷️", name: "label tag price marker item bookmark", category: "emojis", emoji: "🏷️" },
  { id: "🔔", name: "bell ring notification alert remind", category: "emojis", emoji: "🔔" },
  { id: "💻", name: "laptop computer dev macbook code software", category: "emojis", emoji: "💻" },
  { id: "🖥️", name: "desktop computer screen monitor workstation", category: "emojis", emoji: "🖥️" },
  { id: "📱", name: "mobile phone smartphone iphone app", category: "emojis", emoji: "📱" },
  { id: "⌨️", name: "keyboard typing coding hardware keys mechanical", category: "emojis", emoji: "⌨️" },
  { id: "💾", name: "floppy disk save storage retro memory", category: "emojis", emoji: "💾" },
  { id: "🤖", name: "robot ai machine bot intelligent assistant", category: "emojis", emoji: "🤖" },
  { id: "👾", name: "alien monster arcade retro pixel game 8bit", category: "emojis", emoji: "👾" },
  { id: "🔧", name: "wrench tool fix settings mechanics", category: "emojis", emoji: "🔧" },
  { id: "⚙️", name: "gear cog settings engine mechanical options", category: "emojis", emoji: "⚙️" },
  { id: "🔒", name: "lock locked secure private encryption key", category: "emojis", emoji: "🔒" },
  { id: "🎨", name: "artist palette art design colors paint ui", category: "emojis", emoji: "🎨" },
  { id: "🎬", name: "clapper board movie cinema film production video", category: "emojis", emoji: "🎬" },
  { id: "🎵", name: "music note melody song audio tunes sound", category: "emojis", emoji: "🎵" },
  { id: "🎧", name: "headphones audio listening sound beats podcast", category: "emojis", emoji: "🎧" },
  { id: "📸", name: "camera flash photography photo picture snap", category: "emojis", emoji: "📸" },
  { id: "📚", name: "books reading literature study library learn", category: "emojis", emoji: "📚" },
  { id: "📖", name: "open book reading manual novel guide doc", category: "emojis", emoji: "📖" },
  { id: "🎮", name: "video game controller console play gaming steam", category: "emojis", emoji: "🎮" },
  { id: "🍿", name: "popcorn cinema movie snack watch stream", category: "emojis", emoji: "🍿" },
  { id: "✍️", name: "writing hand pen notes blogging authoring", category: "emojis", emoji: "✍️" },
  { id: "🖌️", name: "paintbrush creative illustration drawing art", category: "emojis", emoji: "🖌️" },
  { id: "💼", name: "briefcase business work professional office", category: "emojis", emoji: "💼" },
  { id: "📊", name: "bar chart stats analytics performance dashboard", category: "emojis", emoji: "📊" },
  { id: "📈", name: "chart increasing growth metrics bull market up", category: "emojis", emoji: "📈" },
  { id: "📝", name: "memo notepad notes writing document checklist", category: "emojis", emoji: "📝" },
  { id: "📋", name: "clipboard task list plan todo register survey", category: "emojis", emoji: "📋" },
  { id: "📅", name: "calendar date schedule event month plan", category: "emojis", emoji: "📅" },
  { id: "☕", name: "hot beverage coffee espresso latte morning break", category: "emojis", emoji: "☕" },
  { id: "💰", name: "money bag cash coins dollar rich finance wealth", category: "emojis", emoji: "💰" },
  { id: "🏆", name: "trophy winner award champion success first gold", category: "emojis", emoji: "🏆" },
  { id: "🎓", name: "graduation cap education college university degree", category: "emojis", emoji: "🎓" },
  { id: "📬", name: "mailbox open mail email letter received message", category: "emojis", emoji: "📬" },
  { id: "🔑", name: "key access password security unlock api secret", category: "emojis", emoji: "🔑" },
  { id: "🌍", name: "globe earth world planet geography map international", category: "emojis", emoji: "🌍" },
  { id: "✈️", name: "airplane flight travel airport trip holiday abroad", category: "emojis", emoji: "✈️" },
  { id: "🚗", name: "automobile car vehicle road trip drive transit", category: "emojis", emoji: "🚗" },
  { id: "🏖️", name: "beach umbrella vacation ocean summer tropical island", category: "emojis", emoji: "🏖️" },
  { id: "🌲", name: "evergreen tree forest nature outdoors camping woods", category: "emojis", emoji: "🌲" },
  { id: "🌙", name: "crescent moon night sky darkness dream sleep astronomy", category: "emojis", emoji: "🌙" },
  { id: "☀️", name: "sun sunny weather bright warm daylight light summer", category: "emojis", emoji: "☀️" },
  { id: "🌊", name: "water wave ocean sea surfing splash beach", category: "emojis", emoji: "🌊" },
  { id: "🍕", name: "pizza food italian slice cheese meal dinner", category: "emojis", emoji: "🍕" },
  { id: "🍔", name: "hamburger burger fast food meal diner snack", category: "emojis", emoji: "🍔" },
  { id: "🍻", name: "clinking beer mugs drink toast celebration party bar", category: "emojis", emoji: "🍻" },
  { id: "🎉", name: "party popper celebration festival congratulations yay", category: "emojis", emoji: "🎉" },
];

export function TagManagerModal({
  isOpen,
  onClose,
  onTagsUpdated,
  initialTagToEdit,
}: Props) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [search, setSearch] = useState("");
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"color" | "icon">("color");
  const [selectedColor, setSelectedColor] = useState<string | null>(COLOR_PALETTE[0].hex);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconCategory, setIconCategory] = useState<IconCategory>("all");
  const [iconSearch, setIconSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingTag(null);
    setName("");
    setMode("color");
    setSelectedColor(COLOR_PALETTE[0].hex);
    setSelectedIcon(null);
    setIconCategory("all");
    setIconSearch("");
    setDeleteConfirmId(null);
  };

  const handleStartEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setName(tag.name);
    if (tag.icon) {
      setMode("icon");
      setSelectedIcon(tag.icon);
      setSelectedColor(null);
      // Auto-switch to category if known
      const found = ICON_CATALOG.find((item) => item.id === tag.icon);
      if (found) setIconCategory(found.category);
    } else {
      setMode("color");
      setSelectedColor(tag.color || COLOR_PALETTE[0].hex);
      setSelectedIcon(null);
    }
  };

  const loadTags = async () => {
    try {
      const items = await api.getTags();
      setTags(items);
      return items;
    } catch (err) {
      console.error("Failed to load tags:", err);
      return [];
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTags().then((items) => {
        if (initialTagToEdit) {
          const targetName = typeof initialTagToEdit === "string" ? initialTagToEdit : initialTagToEdit.name;
          const found = items.find((t) => t.name.toLowerCase() === targetName.toLowerCase());
          if (found) {
            handleStartEdit(found);
          } else {
            resetForm();
            setName(targetName);
          }
        } else {
          resetForm();
        }
      });
    }
  }, [isOpen, initialTagToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const finalColor = mode === "color" ? selectedColor : null;
      const finalIcon = mode === "icon" ? selectedIcon : null;

      if (editingTag) {
        await api.updateTag(editingTag.id, trimmed, finalColor, finalIcon);
      } else {
        await api.createTag(trimmed, finalColor, finalIcon);
      }
      await loadTags();
      onTagsUpdated();
      resetForm();
    } catch (err) {
      console.error("Failed to save tag:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTag(id);
      await loadTags();
      onTagsUpdated();
      setDeleteConfirmId(null);
      if (editingTag?.id === id) resetForm();
    } catch (err) {
      console.error("Failed to delete tag:", err);
    }
  };

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const s = search.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(s));
  }, [tags, search]);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

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
        className="w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-[#141416]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <TagIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Tag Manager</h2>
              <p className="text-xs text-muted-foreground">
                Manage tags, assign colors or icons.
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

        {/* Content Body: Split View (List on left, Create/Edit Form on right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          {/* Left Column: Tags List (5 cols) */}
          <div className="md:col-span-5 flex flex-col p-4 space-y-3 min-h-0 bg-black/10">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Tags Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[260px] max-h-[460px]">
              {filteredTags.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <TagIcon className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-xs">No tags found.</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Create your first custom tag using the form.
                  </p>
                </div>
              ) : (
                filteredTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border border-white/[0.04] bg-card/40 hover:bg-card hover:border-white/[0.1] transition-all group",
                      editingTag?.id === tag.id && "border-primary/50 bg-primary/10"
                    )}
                  >
                    <TagBadge
                      name={tag.name}
                      color={tag.color}
                      icon={tag.icon}
                      count={tag.bookmark_count ?? 0}
                    />

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tag)}
                        title="Edit tag"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === tag.id ? (
                        <div className="flex items-center gap-1 bg-red-500/20 p-0.5 rounded-lg border border-red-500/30">
                          <button
                            type="button"
                            onClick={() => handleDelete(tag.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:underline cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(tag.id)}
                          title="Delete tag"
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Create/Edit Form (7 cols) */}
          <div className="md:col-span-7 p-4 flex flex-col justify-between space-y-3 overflow-y-auto max-h-[540px]">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <span className="text-xs font-semibold text-foreground">
                  {editingTag ? "Edit Tag" : "Create New Tag"}
                </span>
                {editingTag && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Tag Name Input */}
              <div className="space-y-1">
                <FieldHeader icon={TagIcon} label="Tag Name" />
                <input
                  type="text"
                  placeholder="e.g. Design Systems"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Visual Mode Selector: Color vs Icon */}
              <div className="space-y-1.5">
                <FieldHeader icon={Palette} label="Visual Style" />
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-black/40 border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("color");
                      if (!selectedColor) setSelectedColor(COLOR_PALETTE[0].hex);
                      setSelectedIcon(null);
                    }}
                    className={cn(
                      "py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                      mode === "color"
                        ? "bg-white/15 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Color Dot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("icon");
                      if (!selectedIcon) setSelectedIcon(ICON_CATALOG[0].id);
                      setSelectedColor(null);
                    }}
                    className={cn(
                      "py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                      mode === "icon"
                        ? "bg-white/15 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Icon & Emoji</span>
                  </button>
                </div>
              </div>

              {/* Choice Palette: Colors */}
              {mode === "color" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Select Color</label>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        title={c.name}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ring-offset-2 ring-offset-[#141416]",
                          selectedColor === c.hex ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                        )}
                        style={{ backgroundColor: c.hex }}
                      >
                        {selectedColor === c.hex && (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Choice Palette: Categorized Icons & Emojis */}
              {mode === "icon" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">Select Icon or Emoji</label>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {filteredIcons.length} available
                    </span>
                  </div>

                  {/* Category Filter Pills (Emoji Picker Style) */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {ICON_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setIconCategory(cat.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0",
                          iconCategory === cat.id
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Icon Search Bar */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search icons (e.g. code, star, fire, rocket)..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  {/* Icon & Emoji Grid Canvas */}
                  <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-[175px] overflow-y-auto p-1.5 rounded-xl bg-black/30 border border-white/[0.06]">
                    {filteredIcons.length === 0 ? (
                      <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                        No icons matching &ldquo;{iconSearch}&rdquo;
                      </div>
                    ) : (
                      filteredIcons.map((item) => {
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
                                ? "bg-primary/25 text-primary border border-primary/50 shadow-xs scale-105 font-bold"
                                : "text-muted-foreground hover:bg-white/10 hover:text-foreground hover:scale-105"
                            )}
                          >
                            {IconComp ? (
                              <IconComp className="w-3.5 h-3.5" />
                            ) : (
                              <span className="text-[13px] leading-none select-none">{item.emoji}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Live Preview */}
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.06] space-y-1">
                <FieldHeader icon={Sparkles} label="Preview" />
                <TagBadge
                  name={name || "Tag Preview"}
                  color={mode === "color" ? selectedColor : null}
                  icon={mode === "icon" ? selectedIcon : null}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full h-8 text-xs font-semibold rounded-xl cursor-pointer"
              >
                {editingTag ? "Update Tag" : "Create Tag"}
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
