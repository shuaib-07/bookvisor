'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Globe, Copy, Check } from 'lucide-react';
import { openExternalUrl } from '@/lib/updater';
import { cn } from '@/lib/utils';

export interface FloatingPreviewCardProps {
  href: string;
  coords: { x: number; y: number };
  title?: string;
  coverUrl?: string | null;
  description?: string | null;
  faviconUrl?: string | null;
  domain?: string | null;
  side?: 'top' | 'bottom' | 'left' | 'right';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function FloatingPreviewCard({
  href,
  coords,
  title,
  coverUrl,
  description,
  faviconUrl,
  domain,
  side = 'top',
  onMouseEnter,
  onMouseLeave,
}: FloatingPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Extract clean domain if not provided
  const parsedDomain =
    domain ||
    (() => {
      try {
        return new URL(href).hostname.replace(/^www\./, '');
      } catch {
        return href;
      }
    })();

  const previewImage =
    coverUrl ||
    (href
      ? `https://v1.screenshot.11ty.dev/${encodeURIComponent(href)}/opengraph/`
      : null);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    openExternalUrl(href);
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.94,
        y: side === 'top' ? 6 : -6,
        filter: 'blur(3px)',
      }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.94, filter: 'blur(3px)' }}
      transition={{
        type: 'spring',
        stiffness: 450,
        damping: 30,
        mass: 0.6,
      }}
      style={{
        position: 'fixed',
        left: coords.x,
        top: coords.y,
        width: 260,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleOpen}
      className="z-[9999] rounded-2xl border border-white/[0.12] bg-[#141416]/95 backdrop-blur-2xl shadow-2xl p-2.5 text-foreground cursor-pointer select-none group/card transition-colors hover:border-white/[0.2]"
    >
      {/* Preview Image Thumbnail */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/50 border border-white/[0.08] mb-2 flex items-center justify-center">
        {previewImage && !imgError ? (
          <img
            src={previewImage}
            alt={title || parsedDomain}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center text-muted-foreground">
            <Globe className="w-6 h-6 opacity-40 mb-1 text-primary" />
            <span className="text-[10px] font-mono opacity-60 truncate max-w-[200px]">
              {parsedDomain}
            </span>
          </div>
        )}

        {/* Top-right open badge */}
        <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-white/80 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* Identity: Favicon + Domain */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          <span className="text-xs font-semibold text-foreground truncate">
            {parsedDomain}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy URL"
          className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Title */}
      {title && (
        <p className="text-[11px] font-medium text-muted-foreground line-clamp-1 mb-1">
          {title}
        </p>
      )}

      {/* Description snippet if available */}
      {description && (
        <p className="text-[10px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Footer URL */}
      <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[9px] text-muted-foreground/50 font-mono">
        <span className="truncate max-w-[200px]">{href}</span>
        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60 ml-1" />
      </div>
    </motion.div>
  );
}

export interface PreviewLinkCardProps {
  href: string;
  title?: string;
  coverUrl?: string | null;
  description?: string | null;
  faviconUrl?: string | null;
  domain?: string | null;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  className?: string;
  children: React.ReactNode;
}

export function PreviewLinkCard({
  href,
  title,
  coverUrl,
  description,
  faviconUrl,
  domain,
  side = 'top',
  sideOffset = 8,
  className,
  children,
}: PreviewLinkCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardWidth = 260;
    const cardHeight = 220;

    let x = rect.left + rect.width / 2 - cardWidth / 2;
    let y = rect.top - cardHeight - sideOffset;

    // Flip to bottom if clipping top
    if (side === 'bottom' || y < 10) {
      y = rect.bottom + sideOffset;
    }

    // Keep within window horizontal bounds
    if (x < 12) x = 12;
    if (x + cardWidth > window.innerWidth - 12) {
      x = window.innerWidth - cardWidth - 12;
    }

    setCoords({ x, y });
  }, [side, sideOffset]);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      calculatePosition();
      setIsOpen(true);
    }, 220);
  };

  const handleMouseLeave = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn('inline-block', className)}
      >
        {children}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <FloatingPreviewCard
                href={href}
                coords={coords}
                title={title}
                coverUrl={coverUrl}
                description={description}
                faviconUrl={faviconUrl}
                domain={domain}
                side={side}
                onMouseEnter={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                }}
                onMouseLeave={handleMouseLeave}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

// Primitives matching user specification for API compatibility
export const PreviewLinkCardTrigger = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <span className={className}>{children}</span>;

export const PreviewLinkCardPanel = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;

export const PreviewLinkCardImage = ({
  alt,
  className,
}: {
  alt?: string;
  className?: string;
}) => <span className={className}>{alt}</span>;
