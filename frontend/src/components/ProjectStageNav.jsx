import { Check, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  ['briefing', 'Briefing', ''],
  ['requirements', 'Requisitos', ''],
  ['backlog', 'Backlog', ''],
  ['review', 'Revisão humana', '/backlog-review'],
  ['tasks', 'Tasks', ''],
  ['qa', 'QA', ''],
  ['architecture', 'Arquitetura', ''],
  ['board', 'Board', ''],
];

export default function ProjectStageNav({ projectUuid, active = 'review', completed = [] }) {
  const navigate = useNavigate();
  return <nav aria-label="Etapas do projeto" className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
    <ol className="flex min-w-max items-center gap-2">
      {STEPS.map(([id, label, suffix], index) => {
        const isDone = completed.includes(id);
        const isActive = active === id;
        const canNavigate = Boolean(suffix);
        return <li key={id} className="flex items-center gap-2">
          <button type="button" disabled={!canNavigate} onClick={() => navigate(`/projects/${projectUuid}${suffix}`)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${isActive ? 'bg-[#102a72] text-white' : isDone ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'} ${!canNavigate ? 'cursor-default' : 'hover:bg-slate-100'}`}>
            {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            <span>{index + 1}. {label}</span>
          </button>
          {index < STEPS.length - 1 && <span className="text-slate-300">→</span>}
        </li>;
      })}
    </ol>
  </nav>;
}
