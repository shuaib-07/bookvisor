import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  RemoveFormatting,
} from "lucide-react";
import { FloatingPreviewCard } from "@/components/ui/preview-link-card";
import { openExternalUrl } from "@/lib/updater";
import { cn } from "@/lib/utils";

interface Props {
  initialContent?: string | null;
  placeholder?: string;
  onChange: (htmlContent: string) => void;
  onBlur?: (htmlContent: string) => void;
  className?: string;
}

export function WysiwygNotesEditor({
  initialContent = "",
  placeholder = "Write notes, key takeaways, snippets, or reminders...",
  onChange,
  onBlur,
  className,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSavedContent = useRef(initialContent || "");
  const [isEmpty, setIsEmpty] = useState(!initialContent || initialContent.trim() === "");
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });
  const [hoveredLink, setHoveredLink] = useState<{
    href: string;
    coords: { x: number; y: number };
  } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorMouseOver = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a && a.getAttribute("href")) {
      const href = a.getAttribute("href")!;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        const rect = a.getBoundingClientRect();
        const cardWidth = 260;
        const cardHeight = 220;
        let x = rect.left + rect.width / 2 - cardWidth / 2;
        let y = rect.top - cardHeight - 8;
        if (y < 10) y = rect.bottom + 8;
        if (x < 12) x = 12;
        if (x + cardWidth > window.innerWidth - 12)
          x = window.innerWidth - cardWidth - 12;
        setHoveredLink({ href, coords: { x, y } });
      }, 220);
    }
  };

  const handleEditorMouseOut = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      closeTimer.current = setTimeout(() => {
        setHoveredLink(null);
      }, 200);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a && a.getAttribute("href")) {
      e.preventDefault();
      openExternalUrl(a.getAttribute("href")!);
    }
  };

  // Sync initial content once or on bookmark switch
  useEffect(() => {
    if (editorRef.current) {
      const current = editorRef.current.innerHTML;
      const next = initialContent || "";
      if (current !== next) {
        editorRef.current.innerHTML = next;
        lastSavedContent.current = next;
        setIsEmpty(!next || next.trim() === "" || next === "<br>");
      }
    }
  }, [initialContent]);

  const updateFormatStates = useCallback(() => {
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      // Ignored if document selection is unavailable
    }
  }, []);

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    updateFormatStates();
    handleInput();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || "";
    setIsEmpty(text.trim() === "");
    onChange(html);
  };

  const handleBlur = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (html !== lastSavedContent.current) {
      lastSavedContent.current = html;
      onBlur?.(html);
    }
  };

  const handleAddLink = () => {
    const url = window.prompt("Enter link URL (e.g. https://...):");
    if (url && url.trim()) {
      executeCommand("createLink", url.trim());
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-md overflow-hidden flex flex-col transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20",
        className
      )}
    >
      {/* Editor Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] bg-black/20 text-muted-foreground flex-wrap">
        <button
          type="button"
          onClick={() => executeCommand("bold")}
          title="Bold (Ctrl+B)"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.bold && "bg-white/15 text-primary font-bold"
          )}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("italic")}
          title="Italic (Ctrl+I)"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.italic && "bg-white/15 text-primary"
          )}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("underline")}
          title="Underline (Ctrl+U)"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.underline && "bg-white/15 text-primary"
          )}
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("strikeThrough")}
          title="Strikethrough"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.strikeThrough && "bg-white/15 text-primary"
          )}
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand("formatBlock", "<h2>")}
          title="Heading"
          className="p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("insertUnorderedList")}
          title="Bullet List"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.insertUnorderedList && "bg-white/15 text-primary"
          )}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("insertOrderedList")}
          title="Numbered List"
          className={cn(
            "p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer",
            activeFormats.insertOrderedList && "bg-white/15 text-primary"
          )}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

        <button
          type="button"
          onClick={handleAddLink}
          title="Insert Link"
          className="p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("formatBlock", "<pre>")}
          title="Code Block"
          className="p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand("removeFormat")}
          title="Clear Formatting"
          className="p-1.5 rounded-md hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer ml-auto"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable Canvas */}
      <div className="relative min-h-[110px] max-h-[300px] overflow-y-auto p-3 text-sm leading-relaxed text-foreground/90 selection:bg-primary/20">
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 p-3 text-sm text-muted-foreground/40 select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyUp={updateFormatStates}
          onMouseUp={updateFormatStates}
          onMouseOver={handleEditorMouseOver}
          onMouseOut={handleEditorMouseOut}
          onClick={handleEditorClick}
          className="outline-none focus:outline-none [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_pre]:font-mono [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded-md [&_pre]:text-xs [&_pre]:my-1"
        />
      </div>

      {typeof document !== "undefined" &&
        hoveredLink &&
        createPortal(
          <AnimatePresence>
            <FloatingPreviewCard
              href={hoveredLink.href}
              coords={hoveredLink.coords}
              onMouseEnter={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current);
              }}
              onMouseLeave={() => {
                closeTimer.current = setTimeout(() => setHoveredLink(null), 200);
              }}
            />
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
