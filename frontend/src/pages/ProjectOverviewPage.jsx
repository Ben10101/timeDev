import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  approveProjectArchitecture,
  generateProjectArchitecture,
  generateProjectBacklog,
  getApiErrorMessage,
  getProject,
  getProjectArchitectureStatus,
  listProjectTasks,
  updateProjectBrief,
} from '../services/api';
import { exportProjectDocumentationPdf } from '../utils/projectDocumentationExport';

const STORY_SHORTCUT_EXAMPLES = [
  {
    label: 'SaaS operacional',
    idea: 'Plataforma para times operacionais registrarem solicitacoes, acompanharem status, anexarem evidencias e aprovarem excecoes com trilha de auditoria.',
    objective: 'Reduzir retrabalho operacional e dar visibilidade do fluxo ponta a ponta.',
    audience: 'Analistas de operacoes, lideres de equipe e gestores.',
    mainFlows: 'Abrir solicitacao, priorizar fila, aprovar excecao, acompanhar SLA e consultar historico.',
    constraints: 'Controle de acesso por perfil, historico imutavel e notificacoes de atraso.',
  },
  {
    label: 'Portal do cliente',
    idea: 'Portal para clientes acompanharem pedidos, documentos pendentes, mensagens e status de atendimento em uma timeline unica.',
    objective: 'Diminuir volume de suporte e aumentar autonomia do cliente.',
    audience: 'Clientes finais e equipe de atendimento.',
    mainFlows: 'Consultar pedido, enviar documentos, responder pendencias e acompanhar timeline.',
    constraints: 'Experiencia mobile, notificacoes e integracao com sistema interno.',
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
  const [approvingArchitecture, setApprovingArchitecture] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    idea: '',
    objective: '',
    audience: '',
    mainFlows: '',
    constraints: '',
  });
  const [roadmap, setRoadmap] = useState({
    milestone: '',
    phase1: '',
    phase2: '',
    phase3: '',
  });
  const [riskRegister, setRiskRegister] = useState({
    risk1: '',
    risk2: '',
    risk3: '',
    impediment1: '',
    impediment2: '',
  });
  const [timeline, setTimeline] = useState({
    startDate: '',
    targetDate: '',
    weeklyCapacity: '',
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
      setRoadmap({
        milestone: projectData?.intakeConfig?.roadmap?.milestone || '',
        phase1: projectData?.intakeConfig?.roadmap?.phases?.[0]?.title || '',
        phase2: projectData?.intakeConfig?.roadmap?.phases?.[1]?.title || '',
        phase3: projectData?.intakeConfig?.roadmap?.phases?.[2]?.title || '',
      });
      setRiskRegister({
        risk1: projectData?.intakeConfig?.riskRegister?.risks?.[0] || '',
        risk2: projectData?.intakeConfig?.riskRegister?.risks?.[1] || '',
        risk3: projectData?.intakeConfig?.riskRegister?.risks?.[2] || '',
        impediment1: projectData?.intakeConfig?.riskRegister?.impediments?.[0] || '',
        impediment2: projectData?.intakeConfig?.riskRegister?.impediments?.[1] || '',
      });
      setTimeline({
        startDate: projectData?.intakeConfig?.timeline?.startDate || '',
        targetDate: projectData?.intakeConfig?.timeline?.targetDate || '',
        weeklyCapacity: projectData?.intakeConfig?.timeline?.weeklyCapacity || '',
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

  async function handleSaveRoadmap(event) {
    event.preventDefault();
    setError(null);
    setSuccessMessage('');

    try {
      const nextIntakeConfig = {
        ...(project?.intakeConfig || {}),
        roadmap: {
          milestone: roadmap.milestone.trim(),
          phases: [
            { order: 1, title: roadmap.phase1.trim() },
            { order: 2, title: roadmap.phase2.trim() },
            { order: 3, title: roadmap.phase3.trim() },
          ].filter((phase) => phase.title),
        },
        riskRegister: {
          risks: [riskRegister.risk1.trim(), riskRegister.risk2.trim(), riskRegister.risk3.trim()].filter(Boolean),
          impediments: [riskRegister.impediment1.trim(), riskRegister.impediment2.trim()].filter(Boolean),
        },
        timeline: {
          startDate: timeline.startDate || null,
          targetDate: timeline.targetDate || null,
          weeklyCapacity: timeline.weeklyCapacity ? Number(timeline.weeklyCapacity) : null,
        },
      };

      const updatedProject = await updateProjectBrief(projectUuid, {
        intakeConfig: nextIntakeConfig,
      });

      setProject(updatedProject);
      setSuccessMessage('Roadmap do projeto salvo com sucesso.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Não foi possível salvar o roadmap do projeto.'));
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

  return (
    <AppShell
      eyebrow="Visão do Projeto"
      title={project?.name || 'Projeto'}
      description="Descreva a iniciativa, gere user stories com o PM Agent e depois entre no board com as tasks persistidas."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => navigate('/projects')} className="dashboard-button-secondary w-full sm:w-auto">
            Voltar para projetos
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={loading || exportingPdf || (architectureStatus?.hasArchitecture && !architectureStatus?.architectureNeedsRefresh && !architectureStatus?.architectureApproved)}
            className="dashboard-button-secondary w-full sm:w-auto"
            title={architectureStatus?.hasArchitecture && !architectureStatus?.architectureNeedsRefresh && !architectureStatus?.architectureApproved ? 'A exportação final depende da aprovação humana da arquitetura.' : undefined}
          >
            {exportingPdf ? 'Preparando PDF...' : 'Exportar PDF'}
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

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Proximos passos</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-700">
              <li>1. Estruture a ideia do projeto com contexto suficiente para o PM.</li>
              <li>2. Gere o backlog inicial e revise as histórias no board.</li>
              <li>3. Refine todas as histórias com Requisitos e QA.</li>
              <li>4. Gere a arquitetura do projeto para liberar implementação.</li>
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
            O briefing foi bloqueado porque o backlog deste projeto ja foi gerado. Depois dessa etapa, os campos ficam somente leitura para preservar o contexto original.
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
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Roadmap</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Milestones da evolução do projeto</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Use essa área para registrar o próximo marco do produto e dividir a evolução em fases curtas e compreensíveis.
            </p>
          </div>

          <form className="grid gap-4 p-6" onSubmit={handleSaveRoadmap}>
            <TextAreaField
              label="Marco principal"
              value={roadmap.milestone}
              onChange={(event) => setRoadmap((prev) => ({ ...prev, milestone: event.target.value }))}
              placeholder="Ex.: liberar o fluxo completo de reembolsos com aprovação e relatório"
              rows={3}
              disabled={false}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <TextAreaField
                label="Fase 1"
                value={roadmap.phase1}
                onChange={(event) => setRoadmap((prev) => ({ ...prev, phase1: event.target.value }))}
                placeholder="Base operacional e rastreabilidade"
                rows={4}
              />
              <TextAreaField
                label="Fase 2"
                value={roadmap.phase2}
                onChange={(event) => setRoadmap((prev) => ({ ...prev, phase2: event.target.value }))}
                placeholder="Colaboração, relatórios e visões gerenciais"
                rows={4}
              />
              <TextAreaField
                label="Fase 3"
                value={roadmap.phase3}
                onChange={(event) => setRoadmap((prev) => ({ ...prev, phase3: event.target.value }))}
                placeholder="Portfólio, integrações e governança avançada"
                rows={4}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Visualização rápida</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Marco</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{roadmap.milestone || 'Ainda não definido'}</p>
                </div>
                {[roadmap.phase1, roadmap.phase2, roadmap.phase3].map((phase, index) => (
                  <div key={`phase-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Fase {index + 1}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{phase || 'Ainda não definido'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="dashboard-button-primary w-full sm:w-auto">
                Salvar roadmap
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Riscos e impedimentos</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">O que pode atrasar a entrega</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Registre o que pode afetar prazo, qualidade ou disponibilidade para que o board tenha visão executiva do risco.
            </p>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <TextAreaField
                label="Risco 1"
                value={riskRegister.risk1}
                onChange={(event) => setRiskRegister((prev) => ({ ...prev, risk1: event.target.value }))}
                placeholder="Ex.: dependência de API externa sem SLA claro"
                rows={3}
              />
              <TextAreaField
                label="Risco 2"
                value={riskRegister.risk2}
                onChange={(event) => setRiskRegister((prev) => ({ ...prev, risk2: event.target.value }))}
                placeholder="Ex.: mudanças regulatórias no fluxo de aprovação"
                rows={3}
              />
              <TextAreaField
                label="Risco 3"
                value={riskRegister.risk3}
                onChange={(event) => setRiskRegister((prev) => ({ ...prev, risk3: event.target.value }))}
                placeholder="Ex.: baixa cobertura de QA nos cenários críticos"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <TextAreaField
                label="Impedimento 1"
                value={riskRegister.impediment1}
                onChange={(event) => setRiskRegister((prev) => ({ ...prev, impediment1: event.target.value }))}
                placeholder="Ex.: aguardando definição do financeiro"
                rows={3}
              />
              <TextAreaField
                label="Impedimento 2"
                value={riskRegister.impediment2}
                onChange={(event) => setRiskRegister((prev) => ({ ...prev, impediment2: event.target.value }))}
                placeholder="Ex.: falta de acesso ao ambiente de homologação"
                rows={3}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Resumo rápido</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Riscos</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {[riskRegister.risk1, riskRegister.risk2, riskRegister.risk3].filter(Boolean).length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Impedimentos</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {[riskRegister.impediment1, riskRegister.impediment2].filter(Boolean).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Timeline e capacidade</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Janela de entrega e ritmo do time</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Registre o início, a meta de entrega e a capacidade semanal para dar mais previsibilidade ao board.
            </p>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <TextAreaField
              label="Início do plano"
              value={timeline.startDate}
              onChange={(event) => setTimeline((prev) => ({ ...prev, startDate: event.target.value }))}
              placeholder="AAAA-MM-DD"
              rows={2}
            />
            <TextAreaField
              label="Meta de entrega"
              value={timeline.targetDate}
              onChange={(event) => setTimeline((prev) => ({ ...prev, targetDate: event.target.value }))}
              placeholder="AAAA-MM-DD"
              rows={2}
            />
            <TextAreaField
              label="Capacidade semanal"
              value={timeline.weeklyCapacity}
              onChange={(event) => setTimeline((prev) => ({ ...prev, weeklyCapacity: event.target.value }))}
              placeholder="Ex.: 8 tasks"
              rows={2}
            />
          </div>

          <div className="grid gap-4 px-6 pb-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Início</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{timeline.startDate || 'Não definido'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Meta</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{timeline.targetDate || 'Não definido'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Capacidade semanal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{timeline.weeklyCapacity || 'Não definido'}</p>
            </div>
          </div>

          <div className="flex justify-end px-6 pb-6">
            <button type="button" onClick={handleSaveRoadmap} className="dashboard-button-primary w-full sm:w-auto">
              Salvar planejamento
            </button>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Arquitetura</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Gate antes da implementação</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  A arquitetura do projeto só pode ser gerada quando todas as histórias tiverem requisitos refinados. A implementação e a exportação final ficam bloqueadas até essa etapa existir, estar atualizada e receber aprovação humana.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleApproveArchitecture}
                  disabled={loading || approvingArchitecture || !architectureStatus?.hasArchitecture || architectureStatus?.architectureNeedsRefresh || architectureStatus?.architectureApproved}
                  className="dashboard-button-secondary w-full sm:w-auto"
                  title={!architectureStatus?.hasArchitecture ? 'Gere a arquitetura antes de aprovar.' : architectureStatus?.architectureNeedsRefresh ? 'Regere a arquitetura antes de aprovar.' : architectureStatus?.architectureApproved ? 'A arquitetura atual já foi aprovada.' : undefined}
                >
                  {approvingArchitecture ? 'Aprovando...' : architectureStatus?.architectureApproved ? 'Arquitetura aprovada' : 'Aprovar arquitetura'}
                </button>
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
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
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
                  ? architectureStatus?.architectureNeedsRefresh
                    ? 'Desatualizada'
                    : architectureStatus?.architectureApproved
                      ? 'Aprovada'
                      : 'Pendente de aprovação'
                  : 'Pendente'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Implementação</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.canGenerateCode ? 'Liberada' : 'Bloqueada'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aprovação humana</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ? architectureStatus?.architectureNeedsRefresh
                    ? 'Arquitetura desatualizada'
                    : architectureStatus?.architectureApproved
                      ? 'Aprovada'
                      : 'Pendente de aprovação'
                  : 'Aguardando arquitetura'}
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
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Atalho para gerar user stories</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Em vez de montar tudo no board manualmente, descreva o produto com contexto suficiente e o PM Agent transforma isso em user stories acionaveis.
            </p>
          </div>

          <form className="grid gap-4 p-6 lg:grid-cols-2" onSubmit={handleGenerateBacklog}>
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Atalho rapido</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-900">Escreva como se estivesse pedindo o produto para um PM senior</h4>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Quanto melhor o contexto sobre usuario, objetivo, fluxo e restricoes, melhores ficam as historias criadas.
                  </p>
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
                  <p className="mt-2 text-sm font-semibold text-slate-900">{shortcutReady ? 'Boa para gerar stories' : 'Precisa de mais contexto'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tamanho da ideia</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{ideaLength} caracteres</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Saida esperada</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Stories prontas para refinamento</p>
                </div>
              </div>
            </div>
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
                placeholder="Regras, dependências e limitações técnicas ou operacionais."
              rows={3}
              disabled={isBriefingLocked}
            />
            <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={loadOverview} disabled={loading || generating} className="dashboard-button-secondary w-full sm:w-auto">
                Recarregar projeto
              </button>
              <button disabled={generating || loading || isBriefingLocked} className="dashboard-button-primary w-full sm:w-auto">
                {isBriefingLocked ? 'User stories ja geradas' : generating ? 'Gerando user stories...' : 'Gerar user stories agora'}
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">User stories geradas</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Stories que vao aparecer no board</h3>
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
                      {task.description || 'Story criada pelo PM Agent e pronta para refinamento.'}
                    </p>
                  </button>
                ))}
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
  );
}

