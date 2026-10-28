import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

export function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: 'Home' },
    { to: '/assessment', label: 'Assessment' },
    { to: '/workshop', label: 'Workshop' },
    { to: '/register', label: 'Register' },
  ];
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'text-primary bg-pale' : 'text-ink hover:text-primary hover:bg-pale/60'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/admin" className="ml-2 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-primary">
              Admin
            </Link>
          </nav>
          <button className="md:hidden p-2 rounded-lg text-ink hover:bg-pale" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="md:hidden pb-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-pale">
                {l.label}
              </Link>
            ))}
            <Link to="/admin" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-muted hover:bg-pale">
              Admin
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
