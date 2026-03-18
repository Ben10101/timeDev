import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { generateProjectBacklog, getProject, listProjectTasks } from '../services/api';

function TextAreaField({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
      />
    </label>
  );
}

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { projectUuid } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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

  useEffect(() => {
    loadOverview();
  }, [projectUuid]);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const [projectData, taskList] = await Promise.all([
        getProject(projectUuid),
        listProjectTasks(projectUuid),
      ]);

      setProject(projectData);
      setTasks(taskList);
      setForm({
        idea: projectData?.intakeConfig?.idea || projectData?.description || '',
        objective: projectData?.intakeConfig?.objective || '',
        audience: projectData?.intakeConfig?.audience || '',
        mainFlows: projectData?.intakeConfig?.answers?.mainFlows || '',
        constraints: projectData?.intakeConfig?.answers?.constraints || '',
      });
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Não foi possível carregar o overview do projeto.');
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
      setSuccessMessage('Backlog gerado pelo PM Agent e enviado direto para o board.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Não foi possível gerar o backlog do projeto.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell
      eyebrow="Project Overview"
      title={project?.name || 'Projeto'}
      description="Descreva a iniciativa, gere o backlog com o PM Agent e depois entre no board já com as tasks persistidas."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate('/projects')}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Voltar para projetos
          </button>
          <button
            onClick={() => navigate(`/projects?project=${projectUuid}`)}
            className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] sm:w-auto"
          >
            Abrir board
          </button>
        </div>
      }
      sidebar={
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Saúde do projeto</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                [groupedStats.total, 'Tasks'],
                [groupedStats.backlog, 'Backlog'],
                [groupedStats.qa, 'Em QA'],
                [groupedStats.done, 'Concluídas'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-[#eef5ef] p-4">
                  <div className="text-2xl font-semibold text-slate-900">{value}</div>
                  <div className="mt-1 text-xs text-slate-600">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#17322b] p-5 text-emerald-50 shadow-[0_20px_60px_rgba(23,50,43,0.14)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/60">Próximos passos</p>
            <ol className="mt-4 space-y-4 text-sm text-emerald-50/82">
              <li>1. Estruture a ideia do projeto com contexto suficiente para o PM.</li>
              <li>2. Gere o backlog inicial e revise as histórias no board.</li>
              <li>3. Chame Requirements e QA por task, sem sair do contexto do projeto.</li>
            </ol>
          </section>
        </>
      }
    >
      <section className="space-y-6">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Resumo</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-[28px] bg-[#faf8f2] p-5">
              <h2 className="font-serif text-3xl font-semibold text-slate-900">
                {project?.name || 'Carregando projeto...'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {project?.description || 'Este projeto ainda não tem um briefing consolidado.'}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {project?.vision || 'Defina o objetivo do projeto e use o PM Agent para abrir o board com contexto.'}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configuração atual</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p><strong>Workspace:</strong> {project?.workspace?.name || '—'}</p>
                <p><strong>Status:</strong> {project?.status || '—'}</p>
                <p><strong>Modo:</strong> {project?.startMode || 'blank'}</p>
                <p><strong>Template:</strong> {project?.templateKey || 'Sem template'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)] sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Briefing do projeto</p>
              <h3 className="mt-2 font-serif text-3xl font-semibold text-slate-900">Converse com o projeto antes dos agentes</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Aqui o intake deixa de ser uma tela isolada. O briefing passa a morar dentro do projeto, e o PM Agent usa esse contexto para criar as tasks do board.
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleGenerateBacklog}>
            <div className="lg:col-span-2">
              <TextAreaField
                label="Ideia do projeto"
                value={form.idea}
                onChange={(event) => setForm((prev) => ({ ...prev, idea: event.target.value }))}
                placeholder="Descreva o produto, o problema que ele resolve e o resultado esperado."
                rows={5}
              />
            </div>
            <TextAreaField
              label="Objetivo"
              value={form.objective}
              onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
              placeholder="Qual transformação esse projeto deve entregar?"
              rows={3}
            />
            <TextAreaField
              label="Público ou operação atendida"
              value={form.audience}
              onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
              placeholder="Quem usa isso e em qual contexto?"
              rows={3}
            />
            <TextAreaField
              label="Fluxos principais"
              value={form.mainFlows}
              onChange={(event) => setForm((prev) => ({ ...prev, mainFlows: event.target.value }))}
              placeholder="Ex.: cadastrar cliente, consultar histórico, acompanhar dashboard."
              rows={3}
            />
            <TextAreaField
              label="Restrições ou riscos"
              value={form.constraints}
              onChange={(event) => setForm((prev) => ({ ...prev, constraints: event.target.value }))}
              placeholder="Regras, dependências, limitações técnicas ou operacionais."
              rows={3}
            />
            <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={loadOverview}
                disabled={loading || generating}
                className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                Recarregar projeto
              </button>
              <button
                disabled={generating || loading}
                className="w-full rounded-2xl bg-[#17322b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#214338] disabled:opacity-50 sm:w-auto"
              >
                {generating ? 'Gerando backlog...' : 'Gerar backlog com PM Agent'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Backlog inicial</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-slate-900">Tasks que vão aparecer no board</h3>
            </div>
            <span className="rounded-full bg-[#eef5ef] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6c58]">
              {tasks.length} tasks
            </span>
          </div>

          {loading ? (
            <div className="mt-6 rounded-[24px] bg-[#faf8f2] p-8 text-center text-slate-500">Carregando overview...</div>
          ) : tasks.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {tasks.slice(0, 8).map((task) => (
                <button
                  key={task.uuid}
                  onClick={() => navigate(`/projects?project=${projectUuid}`)}
                  className="rounded-[24px] border border-slate-200 bg-[#faf8f2] p-5 text-left transition hover:border-[#b8d58b] hover:bg-white"
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
            <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-[#faf8f2] p-8 text-center text-slate-500">
              Nenhuma task ainda. Gere o backlog com o PM Agent para popular o board.
            </div>
          )}
        </section>
      </section>
    </AppShell>
  );
}
