import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { SupportPerformanceDashboardRequest, SupportPerformanceDashboardResponse } from '../../../../../packages/shared/src/contracts/support-performance-dashboard.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { supportPerformanceDashboardFormSchema, type SupportPerformanceDashboardFormValues } from './schema';
import { createSupportPerformanceDashboard, fetchSupportPerformanceDashboardItems, supportPerformanceDashboardQueryKey } from './service';

const initialValues: SupportPerformanceDashboardFormValues = {
  categoryFilter: 'geral',
  statusFilter: 'aberto',
  timeRange: 'ultimos_7_dias',
};

function humanizeStatus(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  const directMap: Record<string, string> = {
    active: 'Ativo',
    enabled: 'Ativado',
    disabled: 'Desativado',
    draft: 'Em preparacao',
    pending: 'Pendente',
  };
  return directMap[normalized] || (value ? String(value) : 'Ativo');
}

function formatCreatedAt(value?: string) {
  if (!value) return 'Agora';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Agora';
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function SupportPerformanceDashboardPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<SupportPerformanceDashboardResponse[]>({
    queryKey: supportPerformanceDashboardQueryKey,
    queryFn: fetchSupportPerformanceDashboardItems,
  });
  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportPerformanceDashboardFormValues>({
    resolver: zodResolver(supportPerformanceDashboardFormSchema),
    defaultValues: initialValues,
  });
  const formValues = watch();

  const mutation = useMutation({
    mutationFn: (input: SupportPerformanceDashboardRequest) => createSupportPerformanceDashboard(input),
    onSuccess: (created) => {
      queryClient.setQueryData<SupportPerformanceDashboardResponse[]>(supportPerformanceDashboardQueryKey, (current = []) => [created, ...current]);
      reset(initialValues);
    },
  });

  return (
    <FeatureWorkbench
      accent="blue"
      productMode="manager-cockpit"
      uiIntent="monitor"
      layoutVariant="hero-metrics"
      pageArchetype="executive-dashboard"
      fallbackPattern="vercel-analytics"
      patternHints={['metrics-first', 'priority-visible']}
      sections={['hero', 'metrics', 'filters', 'records']}
      componentMap={{ recordsLead: 'insightStrip', highlights: 'insightCards' }}
      eyebrow="Visao executiva"
      title="Onde esta o gargalo hoje?"
      description="Compare volume, SLA e tempo de resposta para decidir onde alocar sua equipe agora."
      metrics={[
        { label: 'Painel', value: isLoading ? 'Atualizando' : 'Leitura pronta' },
        { label: 'Indicadores', value: isLoading ? '...' : String(items.length || 0) },
        { label: 'Recorte', value: String(formValues.timeRange || 'ultimos_7_dias').replace(/_/g, ' ') },
      ]}
      highlights={['Fila em risco de estourar SLA', 'Tempo medio de resposta acima da meta', 'Tickets acumulando sem dono']}
      formTitle="Filtros rapidos"
      formDescription="Ajuste o recorte e foque no que importa."
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values))} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Categoria" hint="Escolha o bloco do atendimento que merece leitura mais atenta agora.">
            <select {...register('categoryFilter')} style={inputStyle()}>
              <option value="geral">Geral</option>
              <option value="financeiro">Financeiro</option>
              <option value="acesso">Acesso</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="comercial">Comercial</option>
            </select>
            {errors.categoryFilter ? <small style={{ color: '#b91c1c' }}>{errors.categoryFilter.message}</small> : null}
          </FieldGroup>
          <FieldGroup label="Status" hint="Destaque o momento da fila que voce quer enxergar com mais clareza.">
            <select {...register('statusFilter')} style={inputStyle()}>
              <option value="aberto">Aberto</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aguardando">Aguardando</option>
              <option value="resolvido">Resolvido</option>
            </select>
            {errors.statusFilter ? <small style={{ color: '#b91c1c' }}>{errors.statusFilter.message}</small> : null}
          </FieldGroup>
          <FieldGroup label="Periodo" hint="Use um recorte rapido para comparar tendencia e urgencia operacional.">
            <select {...register('timeRange')} style={inputStyle()}>
              <option value="ultimos_7_dias">Ultimos 7 dias</option>
              <option value="mes_atual">Mes atual</option>
              <option value="ultimos_30_dias">Ultimos 30 dias</option>
              <option value="trimestre">Trimestre</option>
            </select>
            {errors.timeRange ? <small style={{ color: '#b91c1c' }}>{errors.timeRange.message}</small> : null}
          </FieldGroup>
          <PrimaryButton type="submit" accent="blue">
            {isSubmitting || mutation.isPending ? 'Atualizando...' : 'Atualizar leitura'}
          </PrimaryButton>
          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Painel atualizado com sucesso.</p> : null}
          {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
        </form>
      }
      listTitle="Leitura operacional ao vivo"
      listDescription="Veja os recortes que precisam de intervencao agora."
      listMeta={isLoading ? 'Atualizando painel' : `${items.length} insight(s)`}
    >
      {isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1].map((placeholder) => (
            <div key={placeholder} style={{ padding: '18px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 74 }} />
          ))}
        </div>
      ) : items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.9fr', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.categoryFilter || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.statusFilter || 'Status em foco para decisao')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'grid', placeItems: 'center', fontSize: 24 }}>O</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Nenhum indicador disponivel no momento.</p>
        </div>
      )}
    </FeatureWorkbench>
  );
}
