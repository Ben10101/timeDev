import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Clock3,
  ShieldCheck,
  ShieldAlert,
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
      {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EventCard({ title, subtitle, tone = 'slate' }) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ? <p className="mt-1 text-xs opacity-90">{subtitle}</p> : null}
    </div>
  );
}

export default function GovernancePage() {
  const [loading, setLoading] = useState(true);
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

    async function load() {
      try {
        setLoading(true);
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
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        setAuditTrail(Array.isArray(auditData) ? auditData : []);
      } catch (loadError) {
        if (!active) return;
        setError(getApiErrorMessage(loadError, 'Não foi possível carregar a governança da plataforma.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const historyTail = useMemo(() => (history?.series || []).slice(-5), [history]);

  return (
    <AppShell
      eyebrow="Governança"
      title="Governança Operacional"
      description="Concentre readiness, alertas, auditoria, histórico e hotspots da plataforma em uma área dedicada."
    >
      <div className="space-y-8">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Readiness"
            value={readiness?.status || 'n/a'}
            hint={`${readiness?.checks?.length || 0} checks ativos`}
            icon={ShieldCheck}
            tone="blue"
          />
          <MetricCard
            label="Alertas"
            value={alerts.length}
            hint={`${operations?.summary?.failedRuns || 0} falhas recentes`}
            icon={Siren}
            tone={alerts.length ? 'rose' : 'emerald'}
          />
          <MetricCard
            label="Auditoria"
            value={readiness?.governance?.recentAuditEntries || 0}
            hint={`${readiness?.governance?.recentAuditFailures || 0} eventos com falha`}
            icon={Workflow}
            tone="amber"
          />
          <MetricCard
            label="Health"
            value={health?.status || 'n/a'}
            hint={`Banco ${health?.database || 'n/a'} · ${health?.environment || 'n/a'}`}
            icon={ShieldAlert}
            tone="slate"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <motion.section {...fade(0.1)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Readiness</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Prontidão de produção</h2>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <EventCard title={`v${readiness?.release?.version || 'n/a'} · ${readiness?.release?.channel || 'n/a'}`} subtitle="Release em operação" />
              <EventCard title={readiness?.governance?.implementationRemoteOnly ? 'Somente APIs remotas' : 'Fallback local permitido'} subtitle="Policy de execução de IA" tone="amber" />
              <EventCard title={readiness?.security?.authSecretConfigured ? 'Segredo de auth configurado' : 'Segredo ausente'} subtitle="Segurança de autenticação" tone={readiness?.security?.authSecretConfigured ? 'emerald' : 'rose'} />
              <EventCard title={`${Object.values(readiness?.providersConfigured || {}).filter(Boolean).length} providers com chave`} subtitle="Capacidade remota atual" />
            </div>
            <div className="space-y-3 px-6 pb-6">
              {(readiness?.checks || []).map((check) => (
                <EventCard
                  key={check.code}
                  title={check.label}
                  subtitle={`Status: ${check.status}`}
                  tone={check.status === 'failed' ? 'rose' : check.status === 'warning' ? 'amber' : 'emerald'}
                />
              ))}
            </div>
          </motion.section>

          <motion.section {...fade(0.14)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Alertas ativos</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Playbooks recomendados</h2>
            </div>
            <div className="space-y-3 p-6">
              {alerts.length ? (
                alerts.map((alert) => (
                  <EventCard
                    key={alert.code}
                    title={alert.message}
                    subtitle={alert.recommendedAction}
                    tone={alert.severity === 'high' ? 'rose' : 'amber'}
                  />
                ))
              ) : (
                <EventCard title="Nenhum alerta ativo" subtitle="A governança da plataforma está estável agora." tone="emerald" />
              )}
            </div>
          </motion.section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_1fr]">
          <motion.section {...fade(0.18)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Histórico</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Ultimos 7 dias</h2>
            </div>
            <div className="space-y-3 p-6">
              {historyTail.map((day) => (
                <EventCard
                  key={day.date}
                  title={`${day.date} · ${day.totalRuns} runs`}
                  subtitle={`${day.successRatePercent}% sucesso · ${day.estimatedTokens} tokens`}
                />
              ))}
            </div>
          </motion.section>

          <motion.section {...fade(0.22)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Hotspots</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Falhas e latência</h2>
            </div>
            <div className="space-y-3 p-6">
              {(governance?.failureHotspots || []).slice(0, 3).map((item) => (
                <EventCard
                  key={`failure-${item.actionType}`}
                  title={`${item.actionType} · ${item.failures} falhas`}
                  subtitle={`${item.failureRatePercent}% de falha`}
                  tone="rose"
                />
              ))}
              {(governance?.latencyHotspots || []).slice(0, 3).map((item) => (
                <EventCard
                  key={`latency-${item.actionType}`}
                  title={`${item.actionType} · ${item.averageDurationMs}ms`}
                  subtitle={`${item.total} eventos no recorte`}
                  tone="amber"
                />
              ))}
            </div>
          </motion.section>

          <motion.section {...fade(0.26)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Auditoria</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Ações recentes</h2>
            </div>
            <div className="space-y-3 p-6">
              {auditTrail.slice(0, 8).map((entry) => (
                <EventCard
                  key={`${entry.timestamp}-${entry.actionType}`}
                  title={`${entry.method} ${entry.path}`}
                  subtitle={`${entry.actionType} · ${entry.userEmail || 'Usuário desconhecido'} · ${entry.durationMs}ms`}
                  tone={entry.success ? 'slate' : 'rose'}
                />
              ))}
            </div>
          </motion.section>
        </div>

        <motion.section {...fade(0.3)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Governança da fábrica</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Acompanhe risco, policy e operação sem misturar isso com o fluxo de produto.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Readiness, auditoria, histórico, hotspots e alertas ficam concentrados aqui para facilitar leitura e tomada de decisão.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102a72]/10 text-[#102a72]">
                  <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{readiness?.status || 'n/a'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102a72]/10 text-[#102a72]">
                  <AlertCircle className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Alertas</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{alerts.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102a72]/10 text-[#102a72]">
                  <Clock3 className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">P95</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{operations?.summary?.p95RunDurationSeconds || 0}s</p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}
