import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/auth';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const restoring = useAuth((s) => s.restoring);
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return children;
}

export function RequireAuth() {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireGuest() {
  const user = useAuth((s) => s.user);
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const user = useAuth((s) => s.user);
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
