import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Briefcase,
  GitBranch,
  ListChecks,
  Search,
  Bell,
  ChevronRight,
  LogOut,
  Settings,
  User,
  Database,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Projetos', to: '/projects', icon: Briefcase },
  { label: 'Fluxo', to: '/pipeline', icon: GitBranch },
  { label: 'Backlog', to: '/global-backlog', icon: ListChecks },
];

function NavItem({ item }) {
  const location = useLocation();
  const active =
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-[#102a72] text-white shadow-sm shadow-[#102a72]/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          active ? 'text-blue-300' : 'text-slate-500 group-hover:text-slate-300'
        }`}
        strokeWidth={2}
      />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="h-3.5 w-3.5 text-blue-300/60" />}
    </Link>
  );
}

export default function AppShell({ title, eyebrow, description, actions, sidebar, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  async function handleLogout() {
    await logout();
    navigate('/auth');
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#0A1128] text-white">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#102a72] shadow-lg shadow-[#102a72]/40">
            <Database className="h-4 w-4 text-blue-300" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400/80 leading-none mb-0.5">
              Platform v2.0
            </p>
            <span className="text-sm font-bold text-white leading-none">Factory OS</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 pt-4 space-y-0.5">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
            Navegação
          </p>
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* Agents status */}
        <div className="mx-3 mb-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">
              Agentes
            </p>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </div>
          {[
            { tag: 'PM', label: 'Product Manager', color: 'bg-blue-500' },
            { tag: 'REQ', label: 'Requirements', color: 'bg-indigo-500' },
            { tag: 'QA', label: 'Quality Assurance', color: 'bg-violet-500' },
          ].map((a) => (
            <div key={a.tag} className="flex items-center gap-2.5 py-1">
              <div className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-black text-white ${a.color}`}>
                {a.tag[0]}
              </div>
              <span className="text-[11px] text-slate-400">{a.label}</span>
            </div>
          ))}
        </div>

        {/* User */}
        <div className="border-t border-white/[0.07] px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#102a72] border border-blue-500/30">
              <User className="h-3.5 w-3.5 text-blue-300" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white leading-none">{user?.name || 'Usuário'}</p>
              <p className="truncate text-[10px] text-slate-500 mt-0.5">{user?.email || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="rounded-md p-1.5 text-slate-600 hover:bg-white/5 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-h-screen flex-1 flex-col pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos, tarefas..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-[#102a72]/40 focus:bg-white focus:ring-2 focus:ring-[#102a72]/10"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="relative rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <Bell className="h-4 w-4" strokeWidth={2} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#102a72]" />
            </button>
            <button className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <Settings className="h-4 w-4" strokeWidth={2} />
            </button>
            <div className="ml-2 h-6 w-px bg-slate-200" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#102a72] shadow shadow-[#102a72]/30">
              <User className="h-4 w-4 text-blue-200" strokeWidth={2.5} />
            </div>
          </div>
        </header>

        {/* Page header */}
        {title && (
          <div className="border-b border-slate-200 bg-white px-8 py-5">
            {eyebrow && (
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">
                {eyebrow}
              </p>
            )}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                {description && (
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                )}
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <main
          className={`flex-1 p-8 ${
            sidebar ? 'grid gap-8 lg:grid-cols-[1fr_320px]' : ''
          }`}
        >
          <div className="min-w-0">{children}</div>
          {sidebar && <aside className="space-y-6">{sidebar}</aside>}
        </main>
      </div>
    </div>
  );
}
