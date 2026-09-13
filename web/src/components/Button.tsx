import { type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary text-primary-text hover:opacity-90',
  secondary: 'bg-surface-alt text-text hover:opacity-90',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-alt',
  danger: 'bg-transparent text-danger hover:bg-surface-alt',
};

export function Button({
  label,
  loading,
  disabled,
  variant = 'primary',
  className,
  ...props
}: {
  label: string;
  loading?: boolean;
  variant?: Variant;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  const inert = disabled || loading;
  return (
    <button
      type="button"
      disabled={inert}
      aria-busy={loading}
      className={cn(
        'flex min-h-12 items-center justify-center rounded-md px-4 py-3 text-base font-semibold transition-opacity disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" /> : label}
    </button>
  );
}
