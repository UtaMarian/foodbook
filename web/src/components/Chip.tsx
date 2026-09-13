import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Chip({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'rounded-full bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function ChipButton({
  active,
  className,
  ...props
}: { active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
        active ? 'bg-primary text-primary-text' : 'bg-surface-alt text-text-muted',
        className,
      )}
      {...props}
    />
  );
}
