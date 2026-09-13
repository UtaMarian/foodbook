import { useState } from 'react';
import { useNavigate } from 'react-router';
import { updateProfileSchema } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const updated = await api.updateProfile(parsed.data);
      setUser(updated);
      navigate(-1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Salvarea a eșuat');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && navigate(-1)}>
      <DialogContent className="bg-surface text-text">
        <DialogHeader>
          <DialogTitle className="text-xl text-text">Editează profilul</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label="Nume afișat"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            maxLength={60}
          />
          <Field
            label="Despre tine"
            multiline
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            error={errors.bio}
            hint={`${bio.length}/300`}
            placeholder="Gătesc de plăcere, mai ales deserturi."
            maxLength={300}
          />

          {formError ? <p className="text-center text-sm text-danger">{formError}</p> : null}

          <div className="flex flex-col gap-2">
            <Button label="Salvează" type="submit" loading={saving} />
            <Button label="Anulează" type="button" variant="ghost" onClick={() => navigate(-1)} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
