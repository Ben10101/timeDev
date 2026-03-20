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
      eyebrow="Execução"
      title="Fluxo Operacional da Task"
      description="Acompanhe backlog, requisitos e QA com o mesmo padrao visual do Dashboard: foco no status, contexto e proximos passos."
      sidebar={
        <>
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Resumo da iniciativa</p>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-slate-700">{idea}</p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Agentes no fluxo</p>
            </div>
            <div className="space-y-3 p-4">
              {[
                ['PM', 'Converte ideia em backlog acionavel'],
                ['REQ', 'Refina criterios, regras de negocio e clareza funcional'],
                ['QA', 'Define cenarios, riscos, usabilidade e cobertura de teste'],
              ].map(([tag, text]) => (
                <div key={tag} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#102a72] text-xs font-bold text-white">
                      {tag}
                    </span>
                    <p className="text-sm text-slate-700">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {answers && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Briefing complementar</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                As respostas adicionais ja estao anexadas ao fluxo para enriquecer backlog, requisitos e QA.
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
