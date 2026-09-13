import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/Button';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface text-text">
        <DialogHeader>
          <DialogTitle className="text-text">{title}</DialogTitle>
          {description ? <DialogDescription className="text-text-muted">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="!bg-surface">
          <Button label="Anulează" variant="ghost" onClick={() => onOpenChange(false)} />
          <Button label={confirmLabel} variant="danger" onClick={onConfirm} loading={confirming} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
