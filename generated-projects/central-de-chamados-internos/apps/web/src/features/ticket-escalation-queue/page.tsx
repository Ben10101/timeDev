import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type {
  TicketEscalationQueueRequest,
  TicketEscalationQueueResponse,
} from '../../../../../packages/shared/src/contracts/ticket-escalation-queue.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { ticketEscalationQueueFormSchema, type TicketEscalationQueueFormValues } from './schema';
import {
  createTicketEscalationQueueItem,
  fetchTicketEscalationQueueItems,
  ticketEscalationQueueQueryKey,
} from './service';

const initialValues: TicketEscalationQueueFormValues = {
  ticketId: '',
  escalationReason: '',
  targetTeam: 'infraestrutura',
  urgencyLevel: 'alta',
};

function humanizeUrgency(value?: string) {
  const labels: Record<string, string> = {
    moderada: 'Moderada',
    alta: 'Alta',
    critica: 'Critica',
  };

  return labels[String(value || '').trim().toLowerCase()] || String(value || 'Alta');
}

function formatCreatedAt(value?: string) {
  if (!value) return 'Agora';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Agora';
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function TicketEscalationQueuePage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<TicketEscalationQueueResponse[]>({
    queryKey: ticketEscalationQueueQueryKey,
    queryFn: fetchTicketEscalationQueueItems,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TicketEscalationQueueFormValues>({
    resolver: zodResolver(ticketEscalationQueueFormSchema),
    defaultValues: initialValues,
  });

  const mutation = useMutation({
    mutationFn: (input: TicketEscalationQueueRequest) => createTicketEscalationQueueItem(input),
    onSuccess: (created) => {
      queryClient.setQueryData<TicketEscalationQueueResponse[]>(ticketEscalationQueueQueryKey, (current = []) => [created, ...current]);
      reset(initialValues);
    },
  });

  return (
    <FeatureWorkbench
      accent="violet"
      productMode="review-workbench"
      uiIntent="review"
      layoutVariant="queue-priority"
      pageArchetype="operations-queue"
      fallbackPattern="linear-queue"
      patternHints={['priority-visible', 'workflow-guided']}
      sections={['hero', 'queue', 'filters', 'records', 'activity']}
      componentMap={{ recordsLead: 'queueRail', activity: 'activityTimeline' }}
      eyebrow="Fila critica"
      title="Escalone sem perder contexto do chamado"
      description="Encaminhe casos que exigem acao de outro time com urgencia, motivo e ownership claros."
      metrics={[
        { label: 'Fila ativa', value: isLoading ? '...' : String(items.length || 0) },
        { label: 'Criticos', value: isLoading ? 'Carregando' : String(items.filter((item) => item.urgencyLevel === 'critica').length) },
        { label: 'Status', value: 'Sob controle' },
      ]}
      highlights={[
        'Escopo claro para cada time que recebe o escalonamento',
        'Motivo registrado para reduzir retrabalho entre squads',
        'Fila viva para priorizar o que nao pode esperar',
      ]}
      formTitle="Novo escalonamento"
      formDescription="Defina o chamado, o motivo e o time responsavel antes de disparar o encaminhamento."
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values))} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Chamado" hint="Informe o codigo do chamado que precisa ser encaminhado agora.">
            <input {...register('ticketId')} type="text" placeholder="CH-2107" style={inputStyle()} />
            {errors.ticketId ? <small style={{ color: '#b91c1c' }}>{errors.ticketId.message}</small> : null}
          </FieldGroup>

          <FieldGroup label="Motivo do escalonamento" hint="Explique o bloqueio ou impacto para o proximo time entender o contexto.">
            <textarea
              {...register('escalationReason')}
              placeholder="Explique o que impede o atendimento de seguir na fila atual"
              style={inputStyle({ minHeight: 132, resize: 'vertical' })}
            />
            {errors.escalationReason ? <small style={{ color: '#b91c1c' }}>{errors.escalationReason.message}</small> : null}
          </FieldGroup>

          <FieldGroup label="Time destino" hint="Escolha quem deve assumir esse caso para destravar a operacao.">
            <select {...register('targetTeam')} style={inputStyle()}>
              <option value="financeiro">Financeiro</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="seguranca">Seguranca</option>
              <option value="plataforma">Plataforma</option>
            </select>
            {errors.targetTeam ? <small style={{ color: '#b91c1c' }}>{errors.targetTeam.message}</small> : null}
          </FieldGroup>

          <FieldGroup label="Urgencia" hint="Use o nivel certo para orientar a ordem de resposta do time destino.">
            <select {...register('urgencyLevel')} style={inputStyle()}>
              <option value="moderada">Moderada</option>
              <option value="alta">Alta</option>
              <option value="critica">Critica</option>
            </select>
            {errors.urgencyLevel ? <small style={{ color: '#b91c1c' }}>{errors.urgencyLevel.message}</small> : null}
          </FieldGroup>

          <PrimaryButton type="submit" accent="violet">
            {isSubmitting || mutation.isPending ? 'Escalando...' : 'Escalar chamado'}
          </PrimaryButton>

          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Escalonamento registrado com sucesso.</p> : null}
          {mutation.error ? (
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Falha ao abrir o escalonamento.'}
            </p>
          ) : null}
        </form>
      }
      listTitle="Fila priorizada"
      listDescription="Veja os encaminhamentos que ja estao em andamento e onde a fila exige resposta mais rapida."
      listMeta={isLoading ? 'Atualizando fila' : items.length ? `${items.length} escalonamento(s)` : 'Nenhum escalonamento'}
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
            <article key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{item.ticketId}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>
                  {item.targetTeam} · {item.escalationReason}
                </span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>
                {humanizeUrgency(item.urgencyLevel)}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(item.createdAt)}</span>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'grid', placeItems: 'center', fontSize: 24 }}>!</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Nenhum chamado escalado no momento.</p>
        </div>
      )}
    </FeatureWorkbench>
  );
}
