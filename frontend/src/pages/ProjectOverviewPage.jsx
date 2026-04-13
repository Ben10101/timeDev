import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  approveProjectArchitecture,
  generateProjectArchitecture,
  generateProjectBacklog,
  getApiErrorMessage,
  getProject,
  getProjectArchitectureStatus,
  listProjectTasks,
  updateProjectStatus,
} from '../services/api';
import { exportProjectDocumentationPdf } from '../utils/projectDocumentationExport';
import { getProjectStatusConfirmationMessage, getProjectStatusWorkflow } from '../utils/projectStatus';

const STORY_SHORTCUT_EXAMPLES = [
  {
    label: 'SaaS operacional',
    idea: 'Plataforma para times operacionais registrarem solicitacoes, acompanharem status, anexarem evidencias e aprovarem excecoes com trilha de auditoria.',
    objective: 'Reduzir retrabalho operacional e dar visibilidade do fluxo ponta a ponta.',
    audience: 'Analistas de operacoes, lideres de equipe e gestores.',
    mainFlows: 'Abrir solicitação, priorizar fila, aprovar exceção, acompanhar SLA e consultar histórico.',
    constraints: 'Controle de acesso por perfil, histórico imutável e notificações de atraso.',
  },
  {
    label: 'Portal do cliente',
    idea: 'Portal para clientes acompanharem pedidos, documentos pendentes, mensagens e status de atendimento em uma timeline unica.',
    objective: 'Diminuir volume de suporte e aumentar autonomia do cliente.',
    audience: 'Clientes finais e equipe de atendimento.',
    mainFlows: 'Consultar pedido, enviar documentos, responder pendencias e acompanhar timeline.',
    constraints: 'Experiência mobile, notificações e integração com sistema interno.',
  },
];

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
        className={`dashboard-input min-h-[120px] resize-none ${disabled ?'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
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
  const [approvingArchitecture, setApprovingArchitecture] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDialog, setStatusDialog] = useState({ open: false, nextStatus: null });
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
  const ideaLength = form.idea.trim().length;
  const shortcutReady = ideaLength >= 40;
  const riskCount = project?.intakeConfig?.riskRegister?.risks?.length || 0;
  const impedimentCount = project?.intakeConfig?.riskRegister?.impediments?.length || 0;
  const projectStatusMeta = useMemo(() => getProjectStatusWorkflow(project?.status || 'draft'), [project?.status]);
  const projectJourney = useMemo(() => {
    if (!tasks.length) {
      return {
        stage: 'Briefing',
        title: 'Consolidar briefing e gerar stories',
        message: 'Descreva o produto com contexto suficiente e deixe o PM Agent abrir o backlog inicial.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: 'Preencher briefing',
        ctaAction: () => document.getElementById('project-briefing-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        ctaDisabled: loading,
        ctaType: 'button',
      };
    }

    if (!architectureStatus?.hasArchitecture) {
      return {
        stage: 'Arquitetura',
        title: 'Gerar arquitetura do projeto',
        message: 'O backlog já existe. O próximo passo é materializar a arquitetura para liberar implementação.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: generatingArchitecture ?'Gerando arquitetura...' : 'Gerar arquitetura',
        ctaAction: handleGenerateArchitecture,
        ctaDisabled: loading || generatingArchitecture || !architectureStatus?.canGenerateArchitecture,
        ctaType: 'button',
      };
    }

    if (!architectureStatus?.architectureApproved) {
      return {
        stage: 'Aprovação',
        title: 'Fazer aprovação humana da arquitetura',
        message: 'A arquitetura já foi gerada, mas a implementação ainda depende dessa aprovação.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: approvingArchitecture ?'Aprovando...' : 'Aprovar arquitetura',
        ctaAction: handleApproveArchitecture,
        ctaDisabled: loading || approvingArchitecture || !architectureStatus?.hasArchitecture || architectureStatus?.architectureApproved,
        ctaType: 'button',
      };
    }

    return {
      stage: 'Execução',
      title: 'Seguir para board e planning',
      message: 'Briefing, backlog e arquitetura já estão resolvidos. Agora a jornada continua no board operacional.',
      tone: 'border-slate-200 bg-white text-slate-900',
      ctaLabel: 'Abrir board',
      ctaAction: () => navigate(`/projects?project=${projectUuid}`),
      ctaDisabled: false,
      ctaType: 'button',
    };
  }, [
    tasks.length,
    architectureStatus,
    isBriefingLocked,
    generating,
    loading,
    generatingArchitecture,
    approvingArchitecture,
    navigate,
    projectUuid,
  ]);

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
        objective: projectData?.intakeConfig?.objective || projectData?.intakeConfig?.answers?.objective || '',
        audience: projectData?.intakeConfig?.audience || projectData?.intakeConfig?.answers?.audience || '',
        mainFlows: projectData?.intakeConfig?.answers?.mainFlows || '',
        constraints: projectData?.intakeConfig?.answers?.constraints || '',
      });
    } catch (loadError) {
      if (loadError.response?.status === 404) {
        navigate('/projects', { replace: true });
        return;
      }
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar o overview do projeto.'));
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
      setForm({
        idea: response.project?.intakeConfig?.idea || form.idea,
        objective: response.project?.intakeConfig?.objective || response.project?.intakeConfig?.answers?.objective || form.objective,
        audience: response.project?.intakeConfig?.audience || response.project?.intakeConfig?.answers?.audience || form.audience,
        mainFlows: response.project?.intakeConfig?.answers?.mainFlows || form.mainFlows,
        constraints: response.project?.intakeConfig?.answers?.constraints || form.constraints,
      });
      setSuccessMessage('User stories geradas e enviadas direto para o board.');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar o backlog do projeto.'));
    } finally {
      setGenerating(false);
    }
  }

  function applyShortcutExample(example) {
    setForm({
      idea: example.idea,
      objective: example.objective,
      audience: example.audience,
      mainFlows: example.mainFlows,
      constraints: example.constraints,
    });
    setError(null);
    setSuccessMessage('');
  }

  async function handleGenerateArchitecture() {
    setGeneratingArchitecture(true);
    setError(null);
    setSuccessMessage('');

    try {
      await generateProjectArchitecture(projectUuid);
      const nextArchitectureStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextArchitectureStatus);
      setSuccessMessage('Arquitetura do projeto gerada e estrutura base preparada para a implementação.');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar a arquitetura do projeto.'));
    } finally {
      setGeneratingArchitecture(false);
    }
  }

  async function handleApproveArchitecture() {
    setApprovingArchitecture(true);
    setError(null);
    setSuccessMessage('');

    try {
      const response = await approveProjectArchitecture(projectUuid);
      setArchitectureStatus(response.architectureStatus);
      setSuccessMessage('Arquitetura aprovada com sucesso. A implementação e a exportação final foram liberadas.');
    } catch (approveError) {
      setError(getApiErrorMessage(approveError, 'Não foi possível aprovar a arquitetura atual.'));
    } finally {
      setApprovingArchitecture(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setError(null);

    try {
      await exportProjectDocumentationPdf(projectUuid);
    } catch (exportError) {
      setError(getApiErrorMessage(exportError, 'Não foi possível exportar a documentação em PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleProjectStatusChange(nextStatus) {
    if (!project?.uuid) return;

    setUpdatingStatus(true);
    setError(null);
    setSuccessMessage('');

    try {
      const updatedProject = await updateProjectStatus(project.uuid, nextStatus);
      setProject(updatedProject);
      setSuccessMessage(
        nextStatus === 'archived'
          ? 'Projeto arquivado com sucesso.'
          : nextStatus === 'on_hold'
            ? 'Projeto colocado em pausa.'
            : 'Projeto reativado com sucesso.'
      );
    } catch (statusError) {
      setError(getApiErrorMessage(statusError, 'Não foi possível atualizar o status do projeto.'));
    } finally {
      setUpdatingStatus(false);
    }
  }

  function requestProjectStatusChange(nextStatus) {
    setStatusDialog({ open: true, nextStatus });
  }

  return (
    <>
      <AppShell
        eyebrow="Visão do Projeto"
        title={project?.name || 'Projeto'}
        description="Descreva a iniciativa, gere user stories com o PM Agent e siga para o board com as tasks prontas."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate('/projects')} className="dashboard-button-secondary w-full sm:w-auto">
              Voltar para projetos
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf || (architectureStatus?.hasArchitecture && !architectureStatus?.architectureApproved)}
              className="dashboard-button-secondary w-full sm:w-auto"
              title={
                architectureStatus?.hasArchitecture && !architectureStatus?.architectureApproved
                  ? 'A exportação final depende da aprovação humana da arquitetura.'
                  : undefined
              }
            >
              {exportingPdf ? 'Preparando PDF...' : 'Exportar PDF'}
            </button>
            <button
              type={projectJourney.ctaType}
              onClick={projectJourney.ctaType === 'button' ? projectJourney.ctaAction : undefined}
              disabled={projectJourney.ctaDisabled}
              className="dashboard-button-primary w-full sm:w-auto"
            >
              {projectJourney.ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => requestProjectStatusChange(projectStatusMeta.primaryTarget)}
              disabled={loading || updatingStatus}
              className="dashboard-button-secondary w-full sm:w-auto"
            >
              {updatingStatus ? 'Atualizando...' : projectStatusMeta.primaryAction}
            </button>
          </div>
        }
        sidebar={
          <>
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Saude do projeto</p>
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

            <section className={`rounded-2xl border p-5 shadow-sm ${projectJourney.tone}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Próxima ação</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{projectJourney.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{projectJourney.message}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Etapa atual: {projectJourney.stage}
              </p>
              <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${projectStatusMeta.tone}`}>
                Status do projeto: {projectStatusMeta.label}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type={projectJourney.ctaType}
                  onClick={projectJourney.ctaType === 'button' ? projectJourney.ctaAction : undefined}
                  disabled={projectJourney.ctaDisabled}
                  className="dashboard-button-secondary w-full bg-white/80"
                >
                  {projectJourney.ctaLabel}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectUuid}/planning`)}
                  className="dashboard-button-secondary w-full bg-white/70"
                >
                  Abrir planejamento
                </button>
                <button
                  type="button"
                  onClick={() => requestProjectStatusChange(projectStatusMeta.primaryTarget)}
                  disabled={loading || updatingStatus}
                  className="dashboard-button-secondary w-full bg-white/70"
                >
                  {updatingStatus ? 'Atualizando...' : projectStatusMeta.primaryAction}
                </button>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {riskCount} riscos · {impedimentCount} impedimentos
              </p>
            </section>
          </>
        }
      >
      <section className="space-y-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>}
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Fluxo do projeto</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{projectJourney.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{projectJourney.message}</p>
            </div>
            <div className={`rounded-2xl border px-5 py-4 ${projectJourney.tone}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Etapa atual</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{projectJourney.stage}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {tasks.length} tasks · {groupedStats.done} concluídas · {architectureStatus?.hasArchitecture ?'arquitetura gerada' : 'arquitetura pendente'}
              </p>
              <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${projectStatusMeta.tone}`}>
                Status do projeto: {projectStatusMeta.label}
              </div>
            </div>
          </div>
        </section>
        <section className="dashboard-panel" id="project-briefing-form">
          <div className="dashboard-panel-header">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Contexto inicial</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leitura rápida</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Onde estamos</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{projectJourney.stage}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Próxima entrega</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{projectJourney.title}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p><strong>Workspace:</strong> {project?.workspace?.name || '-'}</p>
                  <p><strong>Status:</strong> {project?.status || '-'}</p>
                  <p><strong>Template:</strong> {project?.templateKey || 'Sem template'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Etapa 2</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Arquitetura e aprovação</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Gere a arquitetura só quando o backlog estiver maduro. Depois, faça a aprovação humana para liberar implementação e exportação final.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleApproveArchitecture}
                  disabled={loading || approvingArchitecture || !architectureStatus?.hasArchitecture || architectureStatus?.architectureApproved}
                  className="dashboard-button-secondary w-full sm:w-auto"
                  title={!architectureStatus?.hasArchitecture ?'Gere a arquitetura antes de aprovar.' : architectureStatus?.architectureApproved ?'A arquitetura atual já foi aprovada.' : undefined}
                >
                  {approvingArchitecture ?'Aprovando...' : architectureStatus?.architectureApproved ?'Arquitetura aprovada' : 'Aprovar arquitetura'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateArchitecture}
                  disabled={loading || generatingArchitecture || !architectureStatus?.canGenerateArchitecture}
                  className="dashboard-button-primary w-full sm:w-auto"
                  title={!architectureStatus?.canGenerateArchitecture ?architectureStatus?.blockers?.[0] : undefined}
                >
                  {generatingArchitecture ?'Gerando arquitetura...' : 'Gerar arquitetura do projeto'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Histórias refinadas</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquitetura</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ?architectureStatus?.architectureApproved
                    ?'Aprovada'
                    : 'Pendente de aprovação'
                  : 'Pendente'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Implementação</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.canGenerateCode ?'Liberada' : 'Bloqueada'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aprovação humana</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ?architectureStatus?.architectureApproved
                    ?'Aprovada'
                    : 'Pendente'
                  : 'Aguardando'}
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
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Etapa 1 · Gerar user stories</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Descreva o produto com contexto suficiente e o PM Agent transforma isso em user stories acionáveis para o board.
            </p>
          </div>

          <form className="grid gap-4 p-6 lg:grid-cols-2" onSubmit={handleGenerateBacklog}>
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Antes de gerar</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-900">Dê contexto suficiente para nascer um backlog bom</h4>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    O PM Agent responde melhor quando entende usuário, objetivo, fluxos e restrições logo nesta primeira etapa.
                  </p>
                  {isBriefingLocked && (
                    <p className="mt-3 text-sm leading-6 text-amber-700">
                      Briefing bloqueado: o backlog já foi gerado e os campos ficam em modo leitura para preservar o contexto original.
                    </p>
                  )}
                </div>
                {!isBriefingLocked && (
                  <div className="flex flex-wrap gap-2">
                    {STORY_SHORTCUT_EXAMPLES.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        onClick={() => applyShortcutExample(example)}
                        className="dashboard-button-secondary px-3 py-2 text-xs"
                      >
                        Usar exemplo {example.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Entrada</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{shortcutReady ?'Boa para gerar' : 'Precisa de mais contexto'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tamanho da ideia</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{ideaLength} caracteres</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Saída</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Stories prontas para o board</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <TextAreaField
                label="Problema que resolve"
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
              label="Quem usa"
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
                placeholder="Regras, dependências e limitações técnicas ou operacionais."
              rows={3}
              disabled={isBriefingLocked}
            />
            <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={loadOverview} disabled={loading || generating} className="dashboard-button-secondary w-full sm:w-auto">
                Recarregar projeto
              </button>
              <button disabled={generating || loading || isBriefingLocked} className="dashboard-button-primary w-full sm:w-auto">
                {isBriefingLocked ?'User stories já geradas' : generating ?'Gerando user stories...' : 'Gerar user stories agora'}
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Etapa 3</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Stories que seguem para o board</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Aqui você valida rapidamente o tipo de histórias que nasceram antes de seguir para refinamento e execução.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {tasks.length} tasks
              </span>
            </div>
          </div>

          <div className="p-6">
            {loading ?(
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando overview...</div>
            ) : tasks.length ?(
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Backlog</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{groupedStats.backlog}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Em QA</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{groupedStats.qa}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Concluídas</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{groupedStats.done}</p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {tasks.slice(0, 8).map((task) => (
                    <button
                      key={task.uuid}
                      onClick={() => navigate(`/projects?project=${projectUuid}`)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-[#102a72]/30 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold text-slate-900">{task.title}</h4>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          task.status === 'done'
                            ?'bg-emerald-50 text-emerald-700'
                            : task.status === 'qa'
                              ?'bg-amber-50 text-amber-700'
                              : 'bg-white text-slate-500'
                        }`}>
                          {task.status === 'done' ?'pronta' : task.status}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {task.description || 'Story criada pelo PM Agent e pronta para refinamento.'}
                      </p>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {task.status === 'backlog'
                          ?'Vai entrar no board para refinamento'
                          : task.status === 'qa'
                            ?'Já avançou para validação'
                            : 'Já entrou no fluxo técnico'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                Nenhuma story ainda. Use o atalho acima para gerar user stories com o PM Agent.
              </div>
            )}
          </div>
        </section>
      </section>
      </AppShell>
      <ConfirmDialog
        open={statusDialog.open}
        title="Confirmar alteração de status"
        description={
          statusDialog.nextStatus
            ? getProjectStatusConfirmationMessage(project?.name || 'projeto', statusDialog.nextStatus)
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        intent={statusDialog.nextStatus === 'archived' ? 'warning' : 'primary'}
        loading={updatingStatus}
        onConfirm={() => {
          const nextStatus = statusDialog.nextStatus;
          setStatusDialog({ open: false, nextStatus: null });
          if (nextStatus) {
            handleProjectStatusChange(nextStatus);
          }
        }}
        onClose={() => setStatusDialog({ open: false, nextStatus: null })}
      />
    </>
  );
}

