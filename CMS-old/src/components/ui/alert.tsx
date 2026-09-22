import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        variant === 'destructive'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-slate-200 bg-slate-50 text-slate-800',
        className,
      )}
      {...props}
    />
  );
}
