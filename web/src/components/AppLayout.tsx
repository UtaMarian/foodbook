import { NavLink, Outlet } from 'react-router';
import { Home, Search, PlusCircle, Bookmark, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Acasă', icon: Home, end: true },
  { to: '/search', label: 'Caută', icon: Search, end: false },
  { to: '/create', label: 'Publică', icon: PlusCircle, end: false },
  { to: '/saved', label: 'Salvate', icon: Bookmark, end: false },
  { to: '/profile', label: 'Profil', icon: User, end: false },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-text md:flex">
      <nav className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <NavLink to="/" className="mb-6 px-2 text-2xl font-extrabold text-text">
          🍳 FoodBook
        </NavLink>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-semibold',
                isActive ? 'bg-surface-alt text-primary' : 'text-text-muted hover:bg-surface-alt',
              )
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 pb-16 md:flex md:justify-center md:pb-0">
        <main className="w-full max-w-2xl">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold',
                isActive ? 'text-primary' : 'text-text-faint',
              )
            }
          >
            <Icon size={to === '/create' ? 30 : 22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
