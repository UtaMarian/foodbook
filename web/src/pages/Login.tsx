import { useState } from 'react';
import { Link } from 'react-router';
import { loginSchema } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';

export default function Login() {
  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await api.login(parsed.data);
      await signIn(res.user, res.tokens);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Autentificare esuata');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-1">
          <img src="/icon.png" alt="" className="size-20" />
          <h1 className="text-3xl font-extrabold text-text">FoodBook</h1>
          <p className="text-center text-[15px] text-text-muted">Ce gătesc oamenii pe care îi urmărești</p>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            type="email"
            placeholder="maria@exemplu.ro"
          />
          <Field
            label="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {formError ? <p className="text-center text-sm text-danger">{formError}</p> : null}

          <Button label="Intră în cont" type="submit" loading={loading} />
        </div>

        <div className="flex justify-center gap-2 text-[15px]">
          <span className="text-text-muted">Nu ai cont?</span>
          <Link to="/register" className="font-bold text-primary">
            Creează cont
          </Link>
        </div>
      </form>
    </div>
  );
}
