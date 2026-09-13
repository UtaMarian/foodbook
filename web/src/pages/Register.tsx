import { useState } from 'react';
import { Link } from 'react-router';
import { registerSchema } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';

export default function Register() {
  const signIn = useAuth((s) => s.signIn);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse({
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await api.register(parsed.data);
      await signIn(res.user, res.tokens);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.message.includes('sername')) {
          setErrors({ username: err.message });
        } else if (err.status === 409) {
          setErrors({ email: err.message });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Inregistrare esuata');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">🍳</span>
          <h1 className="text-2xl font-extrabold text-text">Creează cont</h1>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label="Nume afișat"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            placeholder="Maria Popescu"
            autoComplete="name"
          />
          <Field
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            error={errors.username}
            hint="Litere mici, cifre și _ . Așa te găsesc ceilalți."
            placeholder="maria_gateste"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Field
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="maria@exemplu.ro"
            autoCapitalize="none"
            type="email"
            autoComplete="email"
          />
          <Field
            label="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint="Minim 8 caractere"
            type="password"
            autoComplete="new-password"
          />

          {formError ? <p className="text-center text-sm text-danger">{formError}</p> : null}

          <Button label="Creează cont" type="submit" loading={loading} />
        </div>

        <div className="flex justify-center gap-2 text-[15px]">
          <span className="text-text-muted">Ai deja cont?</span>
          <Link to="/login" className="font-bold text-primary">
            Intră în cont
          </Link>
        </div>
      </form>
    </div>
  );
}
