import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock3,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  Siren,
  Workflow,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  getActiveAlerts,
  getAiOperationsOverview,
  getApiErrorMessage,
  getAuditTrail,
  getGovernanceOverview,
  getOperationalHealth,
  getOperationalHistory,
  getProductionReadiness,
} from '../services/api';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: 'easeOut' },
});

function formatCompactNumber(value) {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-[#102a72] border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ?<p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EventCard({ title, subtitle, tone = 'slate' }) {
  const toneClass =
    tone === 'rose'
      ?'border-rose-200 bg-rose-50 text-rose-800'
      : tone === 'amber'
        ?'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'emerald'
          ?'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ?<p className="mt-1 text-xs opacity-90">{subtitle}</p> : null}
    </div>
  );
}

function InsightCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ?<p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyPanel({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle ?<p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export default function GovernancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [operations, setOperations] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [history, setHistory] = useState(null);
  const [governance, setGovernance] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);

  useEffect(() => {
    let active = true;

    async function load({ silent = false } = {}) {
      try {
        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        setError('');

        const [healthData, operationsData, readinessData, historyData, governanceData, alertsData, auditData] =
          await Promise.all([
            getOperationalHealth(),
            getAiOperationsOverview(),
            getProductionReadiness(),
            getOperationalHistory({ days: 7 }),
            getGovernanceOverview(),
            getActiveAlerts(),
            getAuditTrail({ limit: 12 }),
          ]);

        if (!active) return;

        setHealth(healthData);
        setOperations(operationsData);
        setReadiness(readinessData);
        setHistory(historyData);
        setGovernance(governanceData);
        setAlerts(Array.isArray(alertsData) ?alertsData : []);
        setAuditTrail(Array.isArray(auditData) ?auditData : []);
      } catch (loadError) {
        if (!active) return;
        setError(getApiErrorMessage(loadError, 'Não foi poss?vel carregar a governança operacional.'));
      } finally {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const historyTail = useMemo(() => (history?.series || []).slice(-5), [history]);
  const readinessFailures = useMemo(
    () => (readiness?.checks || []).filter((check) => check.status === 'failed'),
    [readiness]
  );
  const readinessWarnings = useMemo(
    () => (readiness?.checks || []).filter((check) => check.status === 'warning'),
    [readiness]
  );
  const topFailingAgents = operations?.reliability?.topFailingAgents || [];
  const summary = operations?.summary || {};
  const actionItems = useMemo(() => {
    const items = [];

    if (alerts.length) {
      const topAlert = alerts[0];
      items.push({
        title: topAlert.message,
        subtitle: topAlert.recommendedAction,
        tone: topAlert.severity === 'high' ?'rose' : 'amber',
      });
    }

    if (summary.staleRunningRuns > 0) {
      items.push({
        title: `${summary.staleRunningRuns} run${summary.staleRunningRuns > 1 ?'s' : ''} travada${summary.staleRunningRuns > 1 ?'s' : ''}`,
        subtitle: 'Revise timeout, watchdog e recupera??o automatica antes da próxima rodada.',
        tone: 'rose',
      });
    }

    if (summary.overBudgetRuns > 0) {
      items.push({
        title: `${summary.overBudgetRuns} execução${summary.overBudgetRuns > 1 ?'es' : ''} acima do budget`,
        subtitle: 'Corte contexto, troque provider ou refine budgets por agente.',
        tone: 'amber',
      });
    }

    if (topFailingAgents.length) {
      const lead = topFailingAgents[0];
      items.push({
        title: `${lead.agentName} lidera falhas recentes`,
        subtitle: `${lead.failed} falhas em ${lead.runs} runs e taxa de falha de ${lead.failureRate}%.`,
        tone: 'rose',
      });
    }

    if (readinessFailures.length) {
      items.push({
        title: `${readinessFailures.length} check${readinessFailures.length > 1 ?'s' : ''} critico${readinessFailures.length > 1 ?'s' : ''}`,
        subtitle: 'Corrija os itens de readiness marcados como failed antes de ampliar a operaÃ§Ã£o.',
        tone: 'rose',
      });
    }

    if (!items.length) {
      items.push({
        title: 'Opera??o estavel neste momento',
        subtitle: 'Sem alertas cr?ticos ativos, sem runs travadas e com health consistente.',
        tone: 'emerald',
      });
    }

    return items.slice(0, 4);
  }, [alerts, summary.staleRunningRuns, summary.overBudgetRuns, topFailingAgents, readinessFailures.length]);

  return (
    <AppShell
      eyebrow="Governanca"
      title="Governanca Operacional"
      description="Acompanhe sa?de, alertas, custo, auditoria e estabilidade da operação de IA em um ?nico lugar."
    >
      <div className="space-y-8">
        {error ?(
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <motion.section {...fade(0.02)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Opera??o da plataforma</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Veja o que precisa de atenÃ§Ã£o agora sem misturar isso com o fluxo de produto.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Esta area concentra sa?de da API, estabilidade dos agentes, custos, trilha de auditoria e alertas ativos.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Recarregar p?gina
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setRefreshing(true);
                    try {
                      const [healthData, operationsData, readinessData, historyData, governanceData, alertsData, auditData] =
                        await Promise.all([
                          getOperationalHealth(),
                          getAiOperationsOverview(),
                          getProductionReadiness(),
                          getOperationalHistory({ days: 7 }),
                          getGovernanceOverview(),
                          getActiveAlerts(),
                          getAuditTrail({ limit: 12 }),
                        ]);
                      setHealth(healthData);
                      setOperations(operationsData);
                      setReadiness(readinessData);
                      setHistory(historyData);
                      setGovernance(governanceData);
                      setAlerts(Array.isArray(alertsData) ?alertsData : []);
                      setAuditTrail(Array.isArray(auditData) ?auditData : []);
                      setError('');
                    } catch (loadError) {
                      setError(getApiErrorMessage(loadError, 'Não foi poss?vel atualizar os dados de governança.'));
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  disabled={refreshing || loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#102a72] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d235f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ?'animate-spin' : ''}`} strokeWidth={2} />
                  {refreshing ?'Atualizando...' : 'Atualizar sinais'}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InsightCard
                label="Saude geral"
                value={readiness?.status || 'n/a'}
                hint={`${readinessFailures.length} cr?ticos e ${readinessWarnings.length} avisos no readiness.`}
              />
              <InsightCard
                label="Sucesso recente"
                value={`${summary.successRatePercent || 0}%`}
                hint={`${summary.failedRuns || 0} falhas em ${summary.totalRuns || 0} runs recentes.`}
              />
              <InsightCard
                label="Alertas ativos"
                value={alerts.length}
                hint={alerts.length ? 'Existe pelo menos um ponto de atenção exigindo ação.' : 'Nenhum alerta ativo agora.'}
              />
              <InsightCard
                label="P95 de execuÃ§Ã£o"
                value={`${summary.p95RunDurationSeconds || 0}s`}
                hint="Mostra a cauda lenta das execu??es recentes."
              />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Health API"
            value={health?.status || 'n/a'}
            hint={`Banco ${health?.database || 'n/a'} · ${health?.environment || 'n/a'}`}
            icon={ShieldCheck}
            tone={health?.status === 'ok' ?'emerald' : 'rose'}
          />
          <MetricCard
            label="Runs recentes"
            value={summary.totalRuns || 0}
            hint={`${summary.runningRuns || 0} em andamento · ${summary.staleRunningRuns || 0} travadas`}
            icon={Activity}
            tone="blue"
          />
          <MetricCard
            label="Custo estimado"
            value={formatCurrency(summary.totalCostUsd || 0)}
            hint={`${formatCompactNumber(summary.totalEstimatedTokens || 0)} tokens no recorte`}
            icon={DollarSign}
            tone={summary.overBudgetRuns > 0 ?'amber' : 'slate'}
          />
          <MetricCard
            label="Auditoria"
            value={governance?.summary?.totalEvents || 0}
            hint={`${governance?.summary?.failureEvents || 0} eventos com falha · ${governance?.summary?.uniqueActors || 0} atores`}
            icon={Workflow}
            tone="slate"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <motion.section {...fade(0.08)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Aten??o imediata</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">O que destravar agora</h2>
            </div>
            <div className="space-y-3 p-6">
              {actionItems.map((item) => (
                <EventCard key={`${item.title}-${item.subtitle}`} title={item.title} subtitle={item.subtitle} tone={item.tone} />
              ))}
            </div>
          </motion.section>

          <motion.section {...fade(0.12)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Opera??o IA</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Resumo executivo da esteira</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <EventCard
                title={`${summary.successRatePercent || 0}% de sucesso`}
                subtitle={`${summary.completedRuns || 0} runs conclu?das e ${summary.failedRuns || 0} falhas recentes.`}
                tone={summary.successRatePercent >= 80 ?'emerald' : summary.successRatePercent >= 60 ?'amber' : 'rose'}
              />
              <EventCard
                title={`${summary.overBudgetRuns || 0} acima do budget`}
                subtitle={`${summary.staleRunningRuns || 0} runs travadas e ${summary.runningRuns || 0} em andamento.`}
                tone={summary.overBudgetRuns > 0 || summary.staleRunningRuns > 0 ?'amber' : 'slate'}
              />
              <EventCard
                title={`${summary.p95RunDurationSeconds || 0}s de P95`}
                subtitle={`${summary.averageRunDurationSeconds || 0}s de m?dia nas runs conclu?das.`}
                tone="slate"
              />
              <EventCard
                title={formatCurrency(summary.totalCostUsd || 0)}
                subtitle={`${formatCompactNumber(summary.totalEstimatedTokens || 0)} tokens estimados no per?odo.`}
                tone="slate"
              />
            </div>
          </motion.section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.section {...fade(0.16)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Readiness</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Prontidao para operar</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <EventCard
                title={`v${readiness?.release?.version || 'n/a'} · ${readiness?.release?.channel || 'n/a'}`}
                subtitle="Release em operaÃ§Ã£o"
              />
              <EventCard
                title={readiness?.governance?.implementationRemoteOnly ?'Somente APIs remotas' : 'Fallback local permitido'}
                subtitle="Policy de execuÃ§Ã£o da IA"
                tone="amber"
              />
              <EventCard
                title={readiness?.security?.authSecretConfigured ?'Segredo de auth configurado' : 'Segredo de auth ausente'}
                subtitle="SeguranÃ§a de autenticaÃ§Ã£o"
                tone={readiness?.security?.authSecretConfigured ?'emerald' : 'rose'}
              />
              <EventCard
                title={`${Object.values(readiness?.providersConfigured || {}).filter(Boolean).length} providers com chave`}
                subtitle="Capacidade remota atual"
              />
            </div>
            <div className="space-y-3 px-6 pb-6">
              {(readiness?.checks || []).length ?(
                (readiness?.checks || []).map((check) => (
                  <EventCard
                    key={check.code}
                    title={check.label}
                    subtitle={`Status: ${check.status}`}
                    tone={check.status === 'failed' ?'rose' : check.status === 'warning' ?'amber' : 'emerald'}
                  />
                ))
              ) : (
                <EmptyPanel title="Sem checks de readiness" subtitle="Quando os checks estiverem disponiveis, eles aparecem aqui com status e risco." />
              )}
            </div>
          </motion.section>

          <motion.section {...fade(0.2)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Alertas e hotspots</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Onde a operaÃ§Ã£o mais sofre</h2>
            </div>
            <div className="space-y-3 p-6">
              {alerts.length ?(
                alerts.slice(0, 3).map((alert) => (
                  <EventCard
                    key={alert.code}
                    title={alert.message}
                    subtitle={alert.recommendedAction}
                    tone={alert.severity === 'high' ?'rose' : 'amber'}
                  />
                ))
              ) : (
                <EventCard title="Nenhum alerta ativo" subtitle="A governanÃ§a da plataforma estÃ¡ estÃ¡vel agora." tone="emerald" />
              )}
              {(governance?.failureHotspots || []).slice(0, 3).map((item) => (
                <EventCard
                  key={`failure-${item.actionType}`}
                  title={`${item.actionType} · ${item.failures} falhas`}
                  subtitle={`${item.failureRatePercent}% de falha`}
                  tone="rose"
                />
              ))}
              {(governance?.latencyHotspots || []).slice(0, 2).map((item) => (
                <EventCard
                  key={`latency-${item.actionType}`}
                  title={`${item.actionType} · ${item.averageDurationMs}ms`}
                  subtitle={`${item.total} eventos no recorte`}
                  tone="amber"
                />
              ))}
            </div>
          </motion.section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_1fr]">
          <motion.section {...fade(0.24)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">HistÃ³rico</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">?ltimos 7 dias</h2>
            </div>
            <div className="space-y-3 p-6">
              {historyTail.length ?(
                historyTail.map((day) => (
                  <EventCard
                    key={day.date}
                    title={`${day.date} · ${day.totalRuns} runs`}
                    subtitle={`${day.successRatePercent}% sucesso · ${formatCompactNumber(day.estimatedTokens)} tokens`}
                  />
                ))
              ) : (
                <EmptyPanel title="Sem historico recente" subtitle="As tend?ncias dos ultimos dias aparecem aqui assim que a operação gerar dados." />
              )}
            </div>
          </motion.section>

          <motion.section {...fade(0.28)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Agentes em risco</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Onde estabilizar primeiro</h2>
            </div>
            <div className="space-y-3 p-6">
              {topFailingAgents.length ?(
                topFailingAgents.slice(0, 5).map((agent) => (
                  <EventCard
                    key={agent.agentName}
                    title={`${agent.agentName} · ${agent.failed} falhas`}
                    subtitle={`${agent.failureRate}% de falha · ${agent.averageDurationSeconds}s de m?dia · ${agent.averageTokens} tokens`}
                    tone={agent.failureRate >= 40 ?'rose' : 'amber'}
                  />
                ))
              ) : (
                <EmptyPanel title="Sem agentes inst?veis no recorte" subtitle="Quando houver concentra??o de falhas por agente, ela aparece aqui." />
              )}
            </div>
          </motion.section>

          <motion.section {...fade(0.32)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Auditoria</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Acoes recentes</h2>
            </div>
            <div className="space-y-3 p-6">
              {auditTrail.length ?(
                auditTrail.slice(0, 8).map((entry) => (
                  <EventCard
                    key={`${entry.timestamp}-${entry.actionType}`}
                    title={`${entry.method} ${entry.path}`}
                    subtitle={`${entry.actionType} · ${entry.userEmail || 'Usu?rio desconhecido'} · ${entry.durationMs}ms`}
                    tone={entry.success ?'slate' : 'rose'}
                  />
                ))
              ) : (
                <EmptyPanel title="Sem eventos recentes" subtitle="A trilha de auditoria aparece aqui conforme a plataforma recebe acoes operacionais." />
              )}
            </div>
          </motion.section>
        </div>

        <motion.section {...fade(0.36)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 p-6 md:grid-cols-3">
            <EventCard
              title={health?.status === 'ok' ?'API respondendo' : 'API com degradação'}
              subtitle={`Status da API: ${health?.status || 'n/a'}`}
              tone={health?.status === 'ok' ?'emerald' : 'rose'}
            />
            <EventCard
              title={health?.database === 'ok' ?'Banco operacional' : 'Banco exige atenção'}
              subtitle={`Banco: ${health?.database || 'n/a'}`}
              tone={health?.database === 'ok' ?'emerald' : 'rose'}
            />
            <EventCard
              title={`${governance?.summary?.coveredActionTypes || 0} fluxos auditados`}
              subtitle="Mostra quantos tipos de aÃ§Ã£o entraram no recorte de governanÃ§a."
              tone="slate"
            />
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}
