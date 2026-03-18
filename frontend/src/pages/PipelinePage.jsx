import { Navigate, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PipelineExecutor from '../components/PipelineExecutor';

export default function PipelinePage() {
  const location = useLocation();
  const idea = location.state?.idea;
  const answers = location.state?.answers;

  if (!idea) {
    return <Navigate to="/" />;
  }

  return (
    <AppShell
      eyebrow="Execution"
      title="Fluxo Operacional da Task"
      description="Acompanhe a passagem da iniciativa entre PM, requisitos e QA, revise as saídas e mantenha o contexto do trabalho centralizado."
      sidebar={
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Resumo da iniciativa</p>
            <p className="mt-4 text-sm leading-6 text-slate-700">{idea}</p>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#faf8f2] p-5 shadow-[0_20px_60px_rgba(23,50,43,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Agentes no fluxo</p>
            <div className="mt-4 space-y-3">
              {[
                ['PM', 'Converte ideia em backlog acionável'],
                ['REQ', 'Refina critérios, regras de negócio e clareza funcional'],
                ['QA', 'Define cenários, riscos, usabilidade e cobertura de teste'],
              ].map(([tag, text]) => (
                <div key={tag} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#17322b] text-xs font-bold text-white">
                      {tag}
                    </span>
                    <p className="text-sm text-slate-700">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {answers && (
            <section className="rounded-[28px] bg-[#17322b] p-5 text-emerald-50 shadow-[0_20px_60px_rgba(23,50,43,0.15)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/60">Briefing complementar</p>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                As respostas adicionais já estão anexadas ao fluxo para enriquecer backlog, requisitos e QA.
              </p>
            </section>
          )}
        </>
      }
    >
      <PipelineExecutor idea={idea} answers={answers} />
    </AppShell>
  );
}
