import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ResultTabs from '../components/ResultTabs';
import BacklogKanban from './BacklogKanban';

export default function ResultsPage() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (location.state?.data) {
      setData(location.state.data);

      const backlogLines = (location.state.data.backlog || '').split('\n').length;
      const requirementsLines = (location.state.data.requirements || '').split('\n').length;
      const testsLines = (location.state.data.tests || '').split('\n').length;

      setStats({
        backlogLines,
        requirementsLines,
        testsLines,
        totalLines: backlogLines + requirementsLines + testsLines,
        timestamp: location.state.data.timestamp,
      });
      return;
    }

    navigate('/');
  }, [location, navigate]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2ea]">
        <div className="rounded-3xl bg-white px-6 py-4 text-slate-600 shadow-sm">Carregando resultado do projeto...</div>
      </div>
    );
  }

  return (
    <AppShell
      eyebrow="Results Hub"
      title="Central de Artefatos do Projeto"
      description={`Projeto ${projectId} consolidado com backlog, requisitos e QA na mesma visão operacional.`}
      actions={
        <>
          <button
            onClick={() => navigate('/')}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Voltar ao workspace
          </button>
          <button
            onClick={() => navigate('/pipeline', { state: { idea: data.backlog } })}
            className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] sm:w-auto"
          >
            Reabrir fluxo
          </button>
        </>
      }
      sidebar={
        <>
          {stats && (
            <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Métricas do projeto</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [stats.backlogLines, 'Backlog'],
                  [stats.requirementsLines, 'Requisitos'],
                  [stats.testsLines, 'Testes'],
                  [stats.totalLines, 'Total'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-[#eef5ef] p-4">
                    <div className="text-2xl font-semibold text-slate-900">{value}</div>
                    <div className="mt-1 text-xs text-slate-600">{label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[28px] border border-slate-200 bg-[#faf8f2] p-5 shadow-[0_20px_60px_rgba(23,50,43,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Operação</p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>Os artefatos já estão organizados por etapa e prontos para versionamento.</p>
              <p>O próximo passo natural é ligar backlog, comentários e status ao board persistido.</p>
              <p>Você pode usar esse resultado como documentação viva da task.</p>
            </div>
          </section>
        </>
      }
    >
      <section className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white/88 p-4 shadow-[0_20px_60px_rgba(23,50,43,0.08)] sm:p-6">
          <ResultTabs data={data} />
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white/88 p-4 shadow-[0_20px_60px_rgba(23,50,43,0.08)] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Board de apoio</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-slate-900">Visão operacional do backlog</h3>
            </div>
            <span className="w-fit rounded-full bg-[#eef5ef] px-4 py-2 text-xs font-semibold text-[#2f6c58]">
              Projeto {projectId}
            </span>
          </div>
          <BacklogKanban backlogMarkdown={data.backlog} projectId={projectId} stageName="results" />
        </div>

        <div className="rounded-[28px] bg-[#17322b] p-5 text-center text-emerald-50 shadow-[0_20px_60px_rgba(23,50,43,0.18)]">
          <p className="text-sm">
            Projeto gerado em {stats?.timestamp ? new Date(stats.timestamp).toLocaleString('pt-BR') : 'data desconhecida'}
          </p>
          <p className="mt-2 text-xs text-emerald-100/70">
            Este painel já se comporta como uma base de documentação para o workspace de tarefas.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
