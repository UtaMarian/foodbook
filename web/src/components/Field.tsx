import { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldBaseProps {
  label: string;
  error?: string;
  hint?: string;
}

const fieldClasses =
  'w-full rounded-md border bg-surface px-3 py-3 text-base text-text placeholder:text-text-faint outline-none focus:border-primary';

export function Field({
  label,
  error,
  hint,
  multiline,
  className,
  ...props
}: FieldBaseProps &
  (
    | ({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
    | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  )) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-text-muted">{label}</span>
      {multiline ? (
        <textarea
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          className={cn(fieldClasses, 'min-h-24 resize-y', error && 'border-danger', className)}
        />
      ) : (
        <input
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
          className={cn(fieldClasses, error && 'border-danger', className)}
        />
      )}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-faint">{hint}</span>
      ) : null}
    </label>
  );
}
