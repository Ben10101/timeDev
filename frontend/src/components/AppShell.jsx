import { Link, useLocation } from 'react-router-dom';

const navigation = [
  { label: 'Home', to: '/', icon: 'H' },
  { label: 'Projects', to: '/projects', icon: 'J' },
  { label: 'Flow', to: '/pipeline', icon: 'F' },
  { label: 'Resultados', to: '/results/demo', icon: 'R' },
];

export default function AppShell({ title, eyebrow, description, actions, sidebar, children }) {
  const location = useLocation();
  const hasSidebar = Boolean(sidebar);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(26,94,74,0.12),_transparent_28%),linear-gradient(180deg,_#f4f1e8_0%,_#edf2ea_52%,_#e6ece5_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-200/70 bg-[#17322b] px-5 py-6 text-[#e9f2ea] lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7ff7d] text-sm font-black text-[#17322b]">
              AF
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/60">AI Ops Workspace</p>
              <h1 className="font-serif text-xl font-semibold">Factory OS</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const active =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to.replace('/demo', ''));

              return (
                <Link
                  key={item.label}
                  to={item.to === '/results/demo' ? '/' : item.to}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active ? 'bg-white text-[#17322b] shadow-sm' : 'text-emerald-50/72 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-current/10 text-xs font-bold">
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/55">Agentes</p>
            <div className="mt-4 space-y-3">
              {[
                ['PM', 'Descobre e organiza trabalho'],
                ['REQ', 'Refina escopo e critérios'],
                ['QA', 'Valida qualidade e riscos'],
              ].map(([tag, text]) => (
                <div key={tag} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#d7ff7d] text-[10px] font-bold text-[#17322b]">
                    {tag}
                  </span>
                  <p className="text-sm leading-5 text-emerald-50/76">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-3xl bg-[#11251f] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/50">Status</p>
            <p className="mt-3 text-sm text-emerald-50/80">
              Estruture ideias, refine tarefas e acompanhe backlog, requisitos e qualidade como um workspace operacional.
            </p>
          </div>
        </aside>

        <div className="flex-1">
          <div className="border-b border-slate-200/70 bg-[#17322b] px-4 py-3 text-[#e9f2ea] lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff7d] text-sm font-black text-[#17322b]">
                AF
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] uppercase tracking-[0.28em] text-emerald-100/60">AI Ops Workspace</p>
                <h1 className="truncate font-serif text-lg font-semibold">Factory OS</h1>
              </div>
            </div>

            <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
              {navigation.map((item) => {
                const active =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to.replace('/demo', ''));

                return (
                  <Link
                    key={item.label}
                    to={item.to === '/results/demo' ? '/' : item.to}
                    className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm transition ${
                      active ? 'bg-white text-[#17322b] shadow-sm' : 'bg-white/5 text-emerald-50/80'
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-current/10 text-[11px] font-bold">
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="min-w-0">
                {eyebrow && (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#2f6c58]">
                    {eyebrow}
                  </p>
                )}
                <h2 className="font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h2>
                {description && <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>}
              </div>

              {actions && <div className="flex flex-wrap items-center gap-3 lg:shrink-0">{actions}</div>}
            </div>
          </header>

          <main
            className={`mx-auto w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8 ${
              hasSidebar ? 'grid lg:grid-cols-[minmax(0,1fr)_320px]' : 'block'
            }`}
          >
            <div className="min-w-0">{children}</div>
            {hasSidebar && <div className="space-y-6">{sidebar}</div>}
          </main>
        </div>
      </div>
    </div>
  );
}
