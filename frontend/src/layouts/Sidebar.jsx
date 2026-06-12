import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',          emoji: '📊', label: 'Dashboard'  },
  { to: '/segments',  emoji: '👥', label: 'Segments'   },
  { to: '/campaigns', emoji: '📢', label: 'Campaigns'  },
  { to: '/analytics', emoji: '📈', label: 'Analytics'  },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-indigo-950 text-white">

      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold">
          X
        </div>
        <span className="text-lg font-bold tracking-tight">Xeno CRM</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 scrollbar-hide">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">
          Main Menu
        </p>
        <ul className="space-y-0.5">
          {NAV.map(({ to, emoji, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="text-base">{emoji}</span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">Admin</p>
            <p className="truncate text-xs text-white/50">admin@xeno.in</p>
          </div>
        </div>
      </div>

    </aside>
  );
}
