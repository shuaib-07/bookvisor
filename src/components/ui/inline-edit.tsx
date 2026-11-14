'use client';

import React, { useState, useEffect, useId, type FC } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import {
  Check,
  X,
  Pencil,
  Ticket,
  Calendar,
  Clock,
  Link2,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditableRowProps {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  secondaryValue?: string;
  placeholder?: string;
  onSave?: (value: string) => void;
  onSaveRange?: (v1: string, v2: string) => void;
  type?: 'text' | 'time' | 'url';
  multiline?: boolean;
  className?: string;
  compact?: boolean;
}

export interface EventData {
  event: string;
  date: string;
  start: string;
  end: string;
  location: string;
  url: string;
  desc: string;
}

export interface InlineEditCardProps {
  data: EventData;
  onDataChange: (data: EventData) => void;
  title?: string;
  className?: string;
}

const spring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.6,
};

export const EditableRow: FC<EditableRowProps> = ({
  icon: IconComponent,
  label,
  value,
  secondaryValue,
  placeholder,
  onSave,
  onSaveRange,
  type = 'text',
  multiline = false,
  className,
  compact = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [v1, setV1] = useState(value);
  const [v2, setV2] = useState(secondaryValue || '');
  const inputId = useId();
  const secondaryInputId = useId();
  const isTime = type === 'time';

  // Sync internal state when external prop changes (e.g., selecting another bookmark)
  useEffect(() => {
    setV1(value);
  }, [value]);

  useEffect(() => {
    setV2(secondaryValue || '');
  }, [secondaryValue]);

  const handleSave = () => {
    if (isTime && onSaveRange) onSaveRange(v1, v2);
    else if (onSave) onSave(v1);
    setEditing(false);
  };

  const handleCancel = () => {
    setV1(value);
    setV2(secondaryValue || '');
    setEditing(false);
  };

  return (
    <motion.div
      layout
      transition={spring}
      className={cn(
        'relative flex w-full select-none',
        compact
          ? 'flex-col gap-1.5'
          : multiline
            ? 'flex-col items-start gap-2.5 sm:gap-3'
            : 'flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3',
        className
      )}
    >
      {/* Label and Icon Header */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2',
          compact
            ? 'w-full justify-between'
            : multiline
              ? 'w-full'
              : 'w-full sm:w-[120px]'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center p-1 rounded-lg bg-white/[0.04] text-muted-foreground group-hover:text-primary transition-colors">
            {IconComponent && (
              <IconComponent
                className={cn(
                  compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
                  'stroke-[1.75]'
                )}
              />
            )}
          </div>
          <label
            htmlFor={inputId}
            className="cursor-pointer text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            {label}
          </label>
        </div>
      </div>

      {/* Editable Content Box */}
      <div className="relative w-full rounded-xl bg-card/50 border border-white/[0.08] transition-all hover:border-white/[0.14] group/content overflow-hidden">
        <motion.div
          layout
          className={cn(
            'w-full px-2.5 py-1 transition-colors',
            editing && 'bg-black/40 ring-1 ring-primary/40'
          )}
        >
          <motion.div
            layout
            transition={spring}
            className={cn(
              'relative flex min-h-[36px] w-full gap-2 items-center',
              multiline && 'flex-col py-1.5 items-stretch'
            )}
          >
            {isTime ? (
              <div className="flex w-full gap-2">
                <input
                  id={inputId}
                  autoFocus={editing}
                  type="text"
                  readOnly={!editing}
                  value={v1}
                  onChange={(e) => setV1(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                  className="h-8 w-full rounded-lg border border-transparent bg-transparent text-xs font-medium text-foreground outline-none focus:border-white/20"
                />
                <input
                  id={secondaryInputId}
                  type="text"
                  readOnly={!editing}
                  value={v2}
                  onChange={(e) => setV2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                  className="h-8 w-full rounded-lg border border-transparent bg-transparent text-xs font-medium text-foreground outline-none focus:border-white/20"
                />
              </div>
            ) : multiline ? (
              <textarea
                id={inputId}
                autoFocus={editing}
                readOnly={!editing}
                rows={3}
                value={v1}
                placeholder={placeholder || 'Enter description...'}
                onChange={(e) => setV1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel();
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
                }}
                className={cn(
                  'w-full resize-none rounded-lg bg-transparent px-1 py-1 text-xs leading-relaxed font-normal text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors',
                  !editing && 'cursor-pointer hover:text-foreground/90'
                )}
              />
            ) : (
              <input
                id={inputId}
                autoFocus={editing}
                type="text"
                readOnly={!editing}
                value={v1}
                placeholder={placeholder}
                onChange={(e) => setV1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                className={cn(
                  'h-8 w-full rounded-lg bg-transparent px-1 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors truncate',
                  type === 'url' && 'font-mono text-[11px] text-muted-foreground hover:text-foreground',
                  !editing && 'cursor-pointer'
                )}
              />
            )}

            {/* Action Buttons: Edit trigger vs Save/Cancel controls */}
            <div className={cn('flex shrink-0 items-center justify-end', multiline && 'self-end mt-1')}>
              <AnimatePresence mode="popLayout" initial={false}>
                {editing ? (
                  <motion.div
                    key="edit"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: 18, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.85 }}
                    transition={{
                      duration: 0.25,
                      ease: [0.19, 1, 0.22, 1],
                    }}
                  >
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={handleSave}
                      title="Save changes (Enter)"
                      className="flex size-6.5 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm cursor-pointer hover:brightness-110"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCancel}
                      title="Cancel (Esc)"
                      className="flex size-6.5 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    type="button"
                    exit={{ opacity: 0 }}
                    key="view"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setEditing(true)}
                    title="Click to edit"
                    className="flex size-6.5 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground opacity-0 group-hover/content:opacity-100 hover:text-foreground hover:bg-white/[0.1] transition-all cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-3 h-3 stroke-[2]" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export const InlineEditCard: FC<InlineEditCardProps> = ({
  data,
  onDataChange,
  title = 'Update Details',
  className,
}) => {
  return (
    <div
      className={cn(
        'mx-auto h-fit w-full max-w-md rounded-2xl border border-white/[0.08] bg-card/60 p-1.5 shadow-xl backdrop-blur-xl transition-colors',
        className
      )}
    >
      <div className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-md">
        <div className="rounded-t-xl border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </h4>
        </div>

        <div className="space-y-3 px-3 py-3">
          <EditableRow
            icon={Ticket}
            label="Event"
            value={data.event}
            onSave={(v) => onDataChange({ ...data, event: v })}
          />
          <EditableRow
            icon={Calendar}
            label="Date"
            value={data.date}
            onSave={(v) => onDataChange({ ...data, date: v })}
          />
          <EditableRow
            icon={Clock}
            label="Time"
            type="time"
            value={data.start}
            secondaryValue={data.end}
            onSaveRange={(a, b) => onDataChange({ ...data, start: a, end: b })}
          />
          <EditableRow
            icon={Link2}
            label="URL"
            type="url"
            value={data.url}
            onSave={(v) => onDataChange({ ...data, url: v })}
          />
          <div className="mt-2 border-t border-white/[0.06] pt-3">
            <EditableRow
              icon={FileText}
              label="Description"
              multiline
              value={data.desc}
              onSave={(v) => onDataChange({ ...data, desc: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
