'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Minus,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  Calendar,
  AlertCircle,
  Bell,
  Mail,
  Check,
  Pencil,
} from 'lucide-react';
import { SPRING_PANEL } from '@/lib/ease';
import { cn } from '@/lib/utils';

export type ReminderType = 'Notification' | 'Email';
export type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface Reminder {
  id: string;
  type: ReminderType;
  value: number;
  unit: TimeUnit;
}

export const NumberRoller = ({ value }: { value: number }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [direction, setDirection] = useState(1);

  if (prevValue !== value) {
    setDirection(value >= prevValue ? 1 : -1);
    setPrevValue(value);
  }

  const variants = {
    initial: (d: number) => ({
      y: d * 6,
      opacity: 0,
      scale: 0.8,
      filter: 'blur(2px)',
    }),
    animate: { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: (d: number) => ({
      y: d * -6,
      opacity: 0,
      scale: 0.8,
      filter: 'blur(2px)',
    }),
  };

  const strValue = value.toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-center overflow-hidden px-1">
      {strValue.split('').map((char, i) => (
        <div key={i} className="relative flex items-center justify-center min-w-[14px]">
          <span className="invisible text-xl font-bold tabular-nums font-mono">
            {char}
          </span>
          <AnimatePresence custom={direction} initial={false}>
            <motion.span
              key={`${char}-${i}-${value}`}
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="absolute text-xl font-bold text-foreground tabular-nums font-mono"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export const AnimatedWord = ({ word }: { word: string }) => {
  return (
    <div className="relative flex items-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {word.split('').map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.3,
              delay: i * 0.0175,
            }}
            className="inline-block font-semibold text-foreground text-xs capitalize"
          >
            {i === 0 ? char.toUpperCase() : char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Standalone Modal for setting custom Reminder or Auto-Expiration
export interface CustomTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'reminder' | 'expiration';
  targetTitle?: string;
  initialValue?: number;
  initialUnit?: TimeUnit;
  onConfirm: (dateIso: string, durationMs: number) => void;
}

const UNIT_MULTIPLIERS: Record<TimeUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
};

export function CustomTimeModal({
  isOpen,
  onClose,
  mode,
  targetTitle,
  initialValue,
  initialUnit,
  onConfirm,
}: CustomTimeModalProps) {
  const isReminder = mode === 'reminder';
  const availableUnits: TimeUnit[] = isReminder
    ? ['minutes', 'hours', 'days', 'weeks']
    : ['hours', 'days', 'weeks', 'months'];

  const [value, setValue] = useState(initialValue || (isReminder ? 2 : 7));
  const [unit, setUnit] = useState<TimeUnit>(
    initialUnit || (isReminder ? 'hours' : 'days')
  );
  const [reminderType, setReminderType] = useState<ReminderType>('Notification');

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || (isReminder ? 2 : 7));
      setUnit(initialUnit || (isReminder ? 'hours' : 'days'));
    }
  }, [isOpen, initialValue, initialUnit, isReminder]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') handleSave();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, value, unit]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const durationMs = value * (UNIT_MULTIPLIERS[unit] || UNIT_MULTIPLIERS.days);
  const calculatedDate = new Date(Date.now() + durationMs);

  const handleSave = () => {
    onConfirm(calculatedDate.toISOString(), durationMs);
    onClose();
  };

  const cycleUnit = () => {
    const nextIdx = (availableUnits.indexOf(unit) + 1) % availableUnits.length;
    setUnit(availableUnits[nextIdx]);
  };

  const basePill =
    'border border-white/[0.08] rounded-2xl transition-all bg-card/60 hover:bg-card/90 hover:border-white/[0.14]';
  const softBtn =
    'p-2 rounded-xl transition-all bg-white/[0.06] hover:bg-white/[0.12] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer';

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={SPRING_PANEL}
        className="w-full max-w-md rounded-3xl border border-white/[0.09] bg-[#141416]/95 backdrop-blur-2xl p-6 shadow-2xl transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'p-2.5 rounded-2xl border flex items-center justify-center shadow-xs',
                isReminder
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  : 'bg-primary/10 border-primary/25 text-primary'
              )}
            >
              {isReminder ? (
                <Clock className="w-5 h-5" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isReminder ? 'Custom Reminder' : 'Custom Auto-Expiration'}
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                {targetTitle || 'Configure relative duration'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reminder Delivery Type Pill (if reminder) */}
        {isReminder && (
          <div className="mb-4">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Alert Channel
            </label>
            <motion.div
              layout
              onClick={() =>
                setReminderType(
                  reminderType === 'Notification' ? 'Email' : 'Notification'
                )
              }
              className={`${basePill} flex cursor-pointer items-center justify-between px-4 py-2.5`}
            >
              <div className="flex items-center gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={reminderType}
                    initial={{ y: 5, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -5, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  >
                    {reminderType === 'Notification' ? (
                      <Bell className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Mail className="w-4 h-4 text-primary" />
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">
                    {reminderType === 'Notification'
                      ? 'Desktop Notification'
                      : 'Email Digest'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {reminderType === 'Notification'
                      ? 'Local system toast alert'
                      : 'Scheduled notification'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col -space-y-1 text-muted-foreground">
                <ChevronUp size={13} strokeWidth={2.5} />
                <ChevronDown size={13} strokeWidth={2.5} />
              </div>
            </motion.div>
          </div>
        )}

        {/* Stepper + Unit Roller Controls */}
        <div className="space-y-2 mb-5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {isReminder ? 'Remind me in' : 'Expire after'}
          </label>

          <div className="flex items-center gap-2">
            {/* Value Stepper */}
            <div
              className={`${basePill} flex flex-1 items-center justify-between px-2.5 py-1.5`}
            >
              <button
                type="button"
                onClick={() => setValue(Math.max(1, value - 1))}
                className={softBtn}
                title="Decrease"
              >
                <Minus size={15} />
              </button>

              <NumberRoller value={value} />

              <button
                type="button"
                onClick={() => setValue(value + 1)}
                className={softBtn}
                title="Increase"
              >
                <Plus size={15} />
              </button>
            </div>

            {/* Unit Roller Pill */}
            <motion.div
              layout
              onClick={cycleUnit}
              title="Click to cycle units"
              className={`${basePill} flex flex-[1.2] cursor-pointer items-center justify-between px-4 py-2.5`}
            >
              <div className="flex flex-col">
                <AnimatedWord word={unit} />
                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                  Tap to change
                </span>
              </div>
              <div className="flex flex-col -space-y-1 text-muted-foreground">
                <ChevronUp size={13} strokeWidth={2.5} />
                <ChevronDown size={13} strokeWidth={2.5} />
              </div>
            </motion.div>
          </div>

          {/* Quick presets row */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {isReminder ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setValue(15);
                    setUnit('minutes');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  15m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(1);
                    setUnit('hours');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  1h
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(3);
                    setUnit('hours');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  3h
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(2);
                    setUnit('days');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  2d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(1);
                    setUnit('weeks');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  1w
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setValue(12);
                    setUnit('hours');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  12h
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(2);
                    setUnit('days');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  2d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(14);
                    setUnit('days');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  14d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(60);
                    setUnit('days');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  60d
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(6);
                    setUnit('months');
                  }}
                  className="px-2 py-0.8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  6mo
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Target Preview Card */}
        <div
          className={cn(
            'p-3.5 rounded-2xl border mb-5 transition-all',
            isReminder
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-primary/10 border-primary/20 text-primary'
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isReminder ? (
              <Clock className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isReminder ? 'Scheduled Time:' : 'Auto-Expiration Date:'}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground font-mono">
            {calculatedDate.toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isReminder
              ? `You will receive a notification in ${value} ${unit}.`
              : `Bookmark will automatically be moved to Trash in ${value} ${unit}.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-96',
              isReminder
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
          >
            {isReminder ? 'Set Reminder' : 'Set Auto-Expiration'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// Full Multi-Reminder Card Component as provided by the user specification
export interface EventRemindersProps {
  title: string;
  date: string;
  initialReminders?: Reminder[];
  onUpdate?: (reminders: Reminder[]) => void;
  className?: string;
}

export const EventReminders: React.FC<EventRemindersProps> = ({
  title,
  date: initialDate,
  initialReminders = [],
  onUpdate,
  className,
}) => {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [date, setDate] = useState(initialDate);
  const [isEditingDate, setIsEditingDate] = useState(false);

  const basePill =
    'border border-white/[0.08] rounded-2xl transition-all bg-card/60 hover:bg-card/90 hover:border-white/[0.14]';
  const softBtn =
    'p-2 rounded-xl transition-all bg-white/[0.06] hover:bg-white/[0.12] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer';

  const addReminder = () => {
    const next: Reminder[] = [
      ...reminders,
      {
        id: crypto.randomUUID(),
        type: 'Notification',
        value: 5,
        unit: 'minutes',
      },
    ];
    setReminders(next);
    onUpdate?.(next);
  };

  const removeReminder = (id: string) => {
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    onUpdate?.(next);
  };

  const updateReminder = (id: string, updates: Partial<Reminder>) => {
    const next = reminders.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setReminders(next);
    onUpdate?.(next);
  };

  const toggleUnit = (id: string, current: TimeUnit) => {
    const units: TimeUnit[] = ['minutes', 'hours', 'days', 'weeks'];
    const next = units[(units.indexOf(current) + 1) % units.length];
    updateReminder(id, { unit: next });
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-2 antialiased', className)}>
      <motion.div
        layout
        transition={{
          type: 'spring',
          bounce: 0.2,
          duration: 0.5,
        }}
        className="w-full max-w-md rounded-3xl border border-white/[0.09] bg-card/70 backdrop-blur-2xl p-6 shadow-xl transition-colors"
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="leading-tight text-base font-bold text-foreground">
              {title}
            </h2>

            <AnimatePresence mode="wait">
              {isEditingDate ? (
                <motion.input
                  key="edit-date"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingDate(false)}
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-primary/40 bg-black/40 px-3 py-1.5 text-xs font-semibold text-foreground outline-none"
                />
              ) : (
                <motion.p
                  key="view-date"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-1 text-xs font-medium text-muted-foreground"
                >
                  {date}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsEditingDate(!isEditingDate)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-white/[0.08] cursor-pointer"
          >
            {isEditingDate ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        </div>

        {/* List */}
        <div className="border-t border-dashed border-white/[0.08] pt-2">
          <LayoutGroup>
            <AnimatePresence mode="popLayout">
              {reminders.map((reminder) => (
                <motion.div
                  key={reminder.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    type: 'spring',
                    bounce: 0.2,
                    duration: 0.5,
                  }}
                  className="space-y-2.5 border-b border-dashed border-white/[0.08] py-3"
                >
                  {/* Type */}
                  <motion.div
                    layout
                    onClick={() =>
                      updateReminder(reminder.id, {
                        type:
                          reminder.type === 'Notification'
                            ? 'Email'
                            : 'Notification',
                      })
                    }
                    className={`${basePill} flex cursor-pointer items-center justify-between px-3.5 py-2`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={reminder.type}
                          initial={{ y: 5, opacity: 0, filter: 'blur(4px)' }}
                          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                          exit={{ y: -5, opacity: 0, filter: 'blur(4px)' }}
                          transition={{
                            type: 'spring',
                            bounce: 0,
                            duration: 0.5,
                          }}
                        >
                          {reminder.type === 'Notification' ? (
                            <Bell className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Mail className="w-4 h-4 text-primary" />
                          )}
                        </motion.div>
                      </AnimatePresence>
                      <AnimatedWord word={reminder.type} />
                    </div>
                    <div className="flex flex-col -space-y-1 text-muted-foreground">
                      <ChevronUp size={13} strokeWidth={2.5} />
                      <ChevronDown size={13} strokeWidth={2.5} />
                    </div>
                  </motion.div>

                  {/* Value + Unit */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 relative">
                    <div
                      className={`${basePill} flex flex-1 min-w-[120px] items-center justify-between px-2 py-1`}
                    >
                      <button
                        onClick={() =>
                          updateReminder(reminder.id, {
                            value: Math.max(1, reminder.value - 1),
                          })
                        }
                        className={softBtn}
                      >
                        <Minus size={14} />
                      </button>

                      <NumberRoller value={reminder.value} />

                      <button
                        onClick={() =>
                          updateReminder(reminder.id, {
                            value: reminder.value + 1,
                          })
                        }
                        className={softBtn}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <motion.div
                      layout
                      onClick={() => toggleUnit(reminder.id, reminder.unit)}
                      className={`${basePill} flex flex-[1.4] min-w-[120px] cursor-pointer items-center justify-between px-3.5 py-2`}
                    >
                      <AnimatedWord word={reminder.unit} />
                      <div className="flex flex-col -space-y-1 text-muted-foreground">
                        <ChevronUp size={13} strokeWidth={2.5} />
                        <ChevronDown size={13} strokeWidth={2.5} />
                      </div>
                    </motion.div>

                    <button
                      onClick={() => removeReminder(reminder.id)}
                      className="shrink-0 rounded-xl border border-white/[0.08] p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 cursor-pointer"
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </LayoutGroup>
        </div>

        {/* Add Button */}
        <motion.button
          onClick={addReminder}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08] cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Reminder
        </motion.button>
      </motion.div>
    </div>
  );
};

