import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  generateProjectArchitecture,
  generateProjectBacklog,
  getProject,
  getProjectArchitectureStatus,
  listProjectTasks,
} from '../services/api';

function TextAreaField({ label, value, onChange, placeholder, rows = 4, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`dashboard-input min-h-[120px] resize-none ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
      />
    </label>
  );
}

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { projectUuid } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingArchitecture, setGeneratingArchitecture] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    idea: '',
    objective: '',
    audience: '',
    mainFlows: '',
    constraints: '',
  });

  const groupedStats = useMemo(
    () => ({
      total: tasks.length,
      backlog: tasks.filter((task) => task.status === 'backlog').length,
      qa: tasks.filter((task) => task.status === 'qa').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks]
  );
  const isBriefingLocked = tasks.length > 0;

  useEffect(() => {
    loadOverview();
  }, [projectUuid]);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const [projectData, taskList, nextArchitectureStatus] = await Promise.all([
        getProject(projectUuid),
        listProjectTasks(projectUuid),
        getProjectArchitectureStatus(projectUuid),
      ]);

      setProject(projectData);
      setTasks(taskList);
      setArchitectureStatus(nextArchitectureStatus);
      setForm({
        idea: projectData?.intakeConfig?.idea || projectData?.description || '',
        objective: projectData?.intakeConfig?.objective || '',
        audience: projectData?.intakeConfig?.audience || '',
        mainFlows: projectData?.intakeConfig?.answers?.mainFlows || '',
        constraints: projectData?.intakeConfig?.answers?.constraints || '',
      });
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Nao foi possivel carregar o overview do projeto.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateBacklog(event) {
    event.preventDefault();

    if (!form.idea.trim()) {
      setError('Descreva a ideia do projeto antes de acionar o PM Agent.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMessage('');

    try {
      const response = await generateProjectBacklog(projectUuid, {
        idea: form.idea,
        description: form.idea,
        vision: form.objective || project?.vision || '',
        answers: {
          objective: form.objective,
          audience: form.audience,
          mainFlows: form.mainFlows,
          constraints: form.constraints,
        },
      });

      setProject(response.project);
      setTasks(response.tasks || []);
      const nextArchitectureStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextArchitectureStatus);
      setSuccessMessage('Backlog gerado pelo PM Agent e enviado direto para o board.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Nao foi possivel gerar o backlog do projeto.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateArchitecture() {
    setGeneratingArchitecture(true);
    setError(null);
    setSuccessMessage('');

    try {
      await generateProjectArchitecture(projectUuid);
      const nextArchitectureStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextArchitectureStatus);
      setSuccessMessage('Arquitetura do projeto gerada e estrutura base preparada para a implementacao.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Nao foi possivel gerar a arquitetura do projeto.');
    } finally {
      setGeneratingArchitecture(false);
    }
  }

  return (
    <AppShell
      eyebrow="Visão do Projeto"
      title={project?.name || 'Projeto'}
      description="Descreva a iniciativa, gere o backlog com o PM Agent e depois entre no board já com as tasks persistidas."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => navigate('/projects')} className="dashboard-button-secondary w-full sm:w-auto">
            Voltar para projetos
          </button>
          <button onClick={() => navigate(`/projects?project=${projectUuid}`)} className="dashboard-button-primary w-full sm:w-auto">
            Abrir board
          </button>
        </div>
      }
      sidebar={
        <>
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Saúde do projeto</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                [groupedStats.total, 'Tasks'],
                [groupedStats.backlog, 'Backlog'],
                [groupedStats.qa, 'Em QA'],
                [groupedStats.done, 'Concluídas'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-semibold text-slate-900">{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Proximos passos</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-700">
              <li>1. Estruture a ideia do projeto com contexto suficiente para o PM.</li>
              <li>2. Gere o backlog inicial e revise as historias no board.</li>
              <li>3. Refine todas as historias com Requisitos e QA.</li>
              <li>4. Gere a arquitetura do projeto para liberar implementacao.</li>
            </ol>
          </section>
        </>
      }
    >
      <section className="space-y-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>}
        {isBriefingLocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            O briefing foi bloqueado porque o backlog deste projeto já foi gerado. Depois dessa etapa, os campos ficam somente leitura para preservar o contexto original.
          </div>
        )}

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Resumo</p>
          </div>
          <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">{project?.name || 'Carregando projeto...'}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {project?.description || 'Este projeto ainda não tem um briefing consolidado.'}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {project?.vision || 'Defina o objetivo do projeto e use o PM Agent para abrir o board com contexto.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configuração atual</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p><strong>Workspace:</strong> {project?.workspace?.name || '-'}</p>
                <p><strong>Status:</strong> {project?.status || '-'}</p>
                <p><strong>Modo:</strong> {project?.startMode || 'blank'}</p>
                <p><strong>Template:</strong> {project?.templateKey || 'Sem template'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Arquitetura</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Gate antes da implementacao</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  A arquitetura do projeto so pode ser gerada quando todas as historias tiverem requisitos refinados. A implementacao fica bloqueada ate essa etapa existir e estar atualizada.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateArchitecture}
                disabled={loading || generatingArchitecture || !architectureStatus?.canGenerateArchitecture}
                className="dashboard-button-primary w-full sm:w-auto"
                title={!architectureStatus?.canGenerateArchitecture ? architectureStatus?.blockers?.[0] : undefined}
              >
                {generatingArchitecture ? 'Gerando arquitetura...' : 'Gerar arquitetura do projeto'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historias refinadas</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquitetura</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ? architectureStatus?.architectureNeedsRefresh
                    ? 'Desatualizada'
                    : 'Pronta'
                  : 'Pendente'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Implementacao</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.canGenerateCode ? 'Liberada' : 'Bloqueada'}
              </p>
            </div>
          </div>

          {!!architectureStatus?.blockers?.length && (
            <div className="px-6 pb-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {architectureStatus.blockers[0]}
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Briefing do projeto</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Converse com o projeto antes dos agentes</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Aqui o intake deixa de ser uma tela isolada. O briefing passa a morar dentro do projeto, e o PM Agent usa esse contexto para criar as tasks do board.
            </p>
          </div>

          <form className="grid gap-4 p-6 lg:grid-cols-2" onSubmit={handleGenerateBacklog}>
            <div className="lg:col-span-2">
              <TextAreaField
                label="Ideia do projeto"
                value={form.idea}
                onChange={(event) => setForm((prev) => ({ ...prev, idea: event.target.value }))}
                placeholder="Descreva o produto, o problema que ele resolve e o resultado esperado."
                rows={5}
                disabled={isBriefingLocked}
              />
            </div>
            <TextAreaField
              label="Objetivo"
              value={form.objective}
              onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
                placeholder="Qual transformação esse projeto deve entregar?"
              rows={3}
              disabled={isBriefingLocked}
            />
            <TextAreaField
                label="Público ou operação atendida"
              value={form.audience}
              onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
                placeholder="Quem usa isso e em qual contexto?"
              rows={3}
              disabled={isBriefingLocked}
            />
            <TextAreaField
              label="Fluxos principais"
              value={form.mainFlows}
              onChange={(event) => setForm((prev) => ({ ...prev, mainFlows: event.target.value }))}
                placeholder="Ex.: cadastrar cliente, consultar histórico, acompanhar dashboard."
              rows={3}
              disabled={isBriefingLocked}
            />
            <TextAreaField
                label="Restrições ou riscos"
              value={form.constraints}
              onChange={(event) => setForm((prev) => ({ ...prev, constraints: event.target.value }))}
                placeholder="Regras, dependências, limitações técnicas ou operacionais."
              rows={3}
              disabled={isBriefingLocked}
            />
            <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={loadOverview} disabled={loading || generating} className="dashboard-button-secondary w-full sm:w-auto">
                Recarregar projeto
              </button>
              <button disabled={generating || loading || isBriefingLocked} className="dashboard-button-primary w-full sm:w-auto">
                {isBriefingLocked ? 'Backlog já gerado' : generating ? 'Gerando backlog...' : 'Gerar backlog com PM Agent'}
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Backlog inicial</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Tasks que vão aparecer no board</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {tasks.length} tasks
              </span>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando overview...</div>
            ) : tasks.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {tasks.slice(0, 8).map((task) => (
                  <button
                    key={task.uuid}
                    onClick={() => navigate(`/projects?project=${projectUuid}`)}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-[#102a72]/30 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-slate-900">{task.title}</h4>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {task.status}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                      {task.description || 'Task criada pelo PM Agent e pronta para refinamento.'}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                Nenhuma task ainda. Gere o backlog com o PM Agent para popular o board.
              </div>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
