'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FieldHeaderProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FieldHeader({
  icon: Icon,
  label,
  badge,
  action,
  className,
  htmlFor,
}: FieldHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between select-none py-0.5',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <div className="flex items-center justify-center p-1 rounded-lg bg-white/[0.04] text-muted-foreground transition-colors shrink-0">
            <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
          </div>
        )}
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors truncate"
        >
          {label}
        </label>
        {badge}
      </div>
      {action && <div className="flex items-center gap-1.5 shrink-0">{action}</div>}
    </div>
  );
}

