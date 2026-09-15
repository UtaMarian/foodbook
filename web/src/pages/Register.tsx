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
  const [pending, setPending] = useState(false);

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
      if (res.pending) {
        setPending(true);
      } else {
        await signIn(res.user, res.tokens);
      }
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

  if (pending) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-cover bg-center p-6"
        style={{ backgroundImage: "url('/food.png')" }}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-surface/95 p-8 text-center shadow-xl backdrop-blur-sm">
          <span className="text-5xl">⏳</span>
          <h1 className="text-2xl font-extrabold text-text">Cont creat</h1>
          <p className="text-[15px] leading-6 text-text-muted">
            Contul tău a fost creat și așteaptă aprobarea unui administrator. Vei putea intra în cont
            de îndată ce este aprobat.
          </p>
          <Link to="/login" className="font-bold text-primary">
            Înapoi la autentificare
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center p-6"
      style={{ backgroundImage: "url('/food.png')" }}
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-surface/95 p-8 shadow-xl backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-1">
          <img src="/icon.png" alt="" className="size-16" />
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
