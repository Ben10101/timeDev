import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Briefcase,
  Braces,
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
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Projetos', to: '/projects', icon: Briefcase },
  { label: 'Codigo', to: '/code-studio', icon: Braces },
  { label: 'Fluxo', to: '/pipeline', icon: GitBranch },
  { label: 'Backlog', to: '/global-backlog', icon: ListChecks },
  { label: 'IAs', to: '/settings/ai', icon: Settings },
];

function NavItem({ item }) {
  const location = useLocation();
  const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
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
    <div className="flex min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#0A1128] text-white">
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#102a72] shadow-lg shadow-[#102a72]/40">
            <Database className="h-4 w-4 text-blue-300" strokeWidth={2.5} />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400/80 leading-none">
              Platform v2.0
            </p>
            <span className="text-sm font-bold leading-none text-white">Factory OS</span>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-4">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">Navegacao</p>
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">Agentes</p>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </div>
          {[
            { tag: 'PM', label: 'Gerente de Produto', color: 'bg-blue-500' },
            { tag: 'REQ', label: 'Requisitos', color: 'bg-indigo-500' },
            { tag: 'QA', label: 'Qualidade', color: 'bg-violet-500' },
          ].map((agent) => (
            <div key={agent.tag} className="flex items-center gap-2.5 py-1">
              <div className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-black text-white ${agent.color}`}>
                {agent.tag[0]}
              </div>
              <span className="text-[11px] text-slate-400">{agent.label}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.07] px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-[#102a72]">
              <User className="h-3.5 w-3.5 text-blue-300" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-none text-white">{user?.name || 'Usuario'}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{user?.email || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white/5 hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-60">
        <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar projetos, tarefas..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#102a72]/40 focus:bg-white focus:ring-2 focus:ring-[#102a72]/10"
            />
          </div>

          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button className="relative rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <Bell className="h-4 w-4" strokeWidth={2} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#102a72]" />
            </button>
            <Link
              to="/settings/ai"
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
            </Link>
            <div className="ml-2 h-6 w-px bg-slate-200" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#102a72] shadow shadow-[#102a72]/30">
              <User className="h-4 w-4 text-blue-200" strokeWidth={2.5} />
            </div>
          </div>
        </header>

        {title && (
          <div className="min-w-0 border-b border-slate-200 bg-white px-8 py-5">
            {eyebrow && (
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">{eyebrow}</p>
            )}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
          </div>
        )}

        <main
          className={`min-w-0 flex-1 overflow-x-hidden p-8 ${
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
