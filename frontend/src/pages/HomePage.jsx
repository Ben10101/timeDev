import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Plus,
  Zap,
  Cpu,
  Shield,
  Layout,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listAllTasks } from '../services/api';

/* ─── helpers ─── */
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: 'easeOut' },
});

/* ─── sub-components ─── */

function StatCard({ label, value, icon: Icon, color, bg, delay }) {
  return (
    <motion.div {...fade(delay)} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: bg, color }}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">+0%</span>
        </div>
      </div>
    </motion.div>
  );
}

const STATUS_CONFIG = {
  SUCCESS: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: 'Concluído', row: 'border-l-emerald-400' },
  ACTIVE:  { dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-50 text-blue-700', label: 'Ativo', row: 'border-l-blue-400' },
  ALERT:   { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', label: 'Alerta', row: 'border-l-amber-400' },
};

function AgentRow({ agent, task, time, type, icon: Icon, idx }) {
  const cfg = STATUS_CONFIG[type];
  return (
    <motion.div {...fade(0.3 + idx * 0.08)} className={`flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3.5 shadow-sm border-l-2 ${cfg.row}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
        type === 'ACTIVE'  ? 'bg-blue-50 text-[#102a72]' :
        'bg-amber-50 text-amber-600'
      }`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{agent}</span>
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{task}</p>
      </div>
      <span className="shrink-0 text-[11px] text-slate-400">{time}</span>
    </motion.div>
  );
}

function ToolButton({ label, icon: Icon, to, navigate, delay }) {
  return (
    <motion.button
      {...fade(delay)}
      onClick={() => navigate(to)}
      className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#102a72]/30 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-[#102a72]/10 group-hover:text-[#102a72] transition-all">
        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
      </div>
      <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
    </motion.button>
  );
}

/* ─── page ─── */

const AGENTS = [
  { agent: 'Architect v1', task: 'Atualização de Esquema do Banco',  time: '2m atrás',  type: 'SUCCESS', icon: Layout },
  { agent: 'DevBot',       task: 'Refatoração da lógica central',    time: '15m atrás', type: 'ACTIVE',  icon: Cpu },
  { agent: 'Security Sentinel', task: 'Scan de Vulnerabilidades',   time: '1h atrás',  type: 'ALERT',   icon: Shield },
];

const TOOLS = [
  { label: 'Backlog',    to: '/global-backlog', icon: Layout },
  { label: 'Fluxo',      to: '/pipeline',        icon: Zap },
  { label: 'Análises',   to: '/results',         icon: BarChart3 },
  { label: 'Equipe',     to: '/team',            icon: Shield },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, todo: 0, inProgress: 0, done: 0, urgent: 0 });

  useEffect(() => {
    listAllTasks()
      .then((tasks) =>
        setStats({
          total:      tasks.length,
          todo:       tasks.filter((t) => t.status === 'TODO').length,
          inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
          done:       tasks.filter((t) => t.status === 'DONE').length,
          urgent:     tasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT').length,
        })
      )
      .catch(console.error);
  }, []);

  const STAT_CARDS = [
    { label: 'Total de Tasks',  value: stats.total,      icon: BarChart3,    color: '#102a72', bg: '#102a7215', delay: 0 },
    { label: 'Em Progresso',    value: stats.inProgress, icon: Activity,     color: '#7c3aed', bg: '#7c3aed15', delay: 0.05 },
    { label: 'Concluídas',      value: stats.done,       icon: CheckCircle2, color: '#059669', bg: '#05966915', delay: 0.1 },
    { label: 'Urgentes',        value: stats.urgent,     icon: AlertCircle,  color: '#dc2626', bg: '#dc262615', delay: 0.15 },
  ];

  return (
    <AppShell
      eyebrow="Visão Geral"
      title="Dashboard"
      description="Acompanhe o status dos seus projetos e agentes em tempo real."
      actions={
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 rounded-xl bg-[#102a72] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0c205a] hover:shadow-md transition-all"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Novo Projeto
        </button>
      }
    >
      <div className="space-y-8">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STAT_CARDS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Agent feed — 2 cols */}
          <motion.div {...fade(0.25)} className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Fluxo de Agentes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Monitoramento em tempo real</p>
              </div>
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#102a72] hover:underline">
                <TrendingUp className="h-3.5 w-3.5" />
                Ver relatórios
              </button>
            </div>

            <div className="flex-1 space-y-2 p-4">
              {AGENTS.map((a, i) => (
                <AgentRow key={i} {...a} idx={i} />
              ))}
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-3">
              <button className="text-xs font-semibold text-[#102a72] hover:underline">
                Ver todo o histórico →
              </button>
            </div>
          </motion.div>

          {/* Right column — 1 col */}
          <div className="flex flex-col gap-4">

            {/* Tools */}
            <motion.div {...fade(0.3)} className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Ferramentas</h2>
                <p className="text-xs text-slate-500 mt-0.5">Acesso rápido aos módulos</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {TOOLS.map((t, i) => (
                  <ToolButton key={t.label} {...t} navigate={navigate} delay={0.35 + i * 0.05} />
                ))}
              </div>
            </motion.div>

            {/* System status */}
            <motion.div {...fade(0.5)} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Zap className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Sistema Operacional</p>
                <p className="text-xs text-emerald-600 mt-0.5">Todos os serviços ativos · 100%</p>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
