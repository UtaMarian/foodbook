import type { ReactNode } from 'react';
import { Button } from '@/components/Button';

export function EmptyState({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-1 p-8 text-center">
      <span className="mb-2 text-4xl">{emoji}</span>
      <p className="text-lg font-bold text-text">{title}</p>
      <p className="max-w-sm text-sm leading-5 text-text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      emoji="😕"
      title="Ceva n-a mers"
      message={message}
      action={onRetry ? <Button label="Încearcă din nou" onClick={onRetry} /> : undefined}
    />
  );
}
