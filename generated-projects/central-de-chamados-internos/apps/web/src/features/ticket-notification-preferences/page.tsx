import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { TicketNotificationPreferenceRequest, TicketNotificationPreferenceResponse } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
import { SettingsWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { ticketNotificationPreferenceFormSchema, type TicketNotificationPreferenceFormValues } from './schema';
import { createTicketNotificationPreference, fetchTicketNotificationPreferenceItems, ticketNotificationPreferencesQueryKey } from './service';

const initialValues: TicketNotificationPreferenceFormValues = {
  notificationEmail: '',
  ticketUpdateAlerts: 'enabled',
};

export function TicketNotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<TicketNotificationPreferenceResponse[]>({
    queryKey: ticketNotificationPreferencesQueryKey,
    queryFn: fetchTicketNotificationPreferenceItems,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TicketNotificationPreferenceFormValues>({
    resolver: zodResolver(ticketNotificationPreferenceFormSchema),
    defaultValues: initialValues,
  });

  const mutation = useMutation({
    mutationFn: (input: TicketNotificationPreferenceRequest) => createTicketNotificationPreference(input),
    onSuccess: (created) => {
      queryClient.setQueryData<TicketNotificationPreferenceResponse[]>(ticketNotificationPreferencesQueryKey, (current = []) => [created, ...current]);
      reset(initialValues);
    },
  });

  return (
    <SettingsWorkbench
      accent="teal"
      productMode="self-service-settings"
      uiIntent="configure"
      layoutVariant="summary-first"
      pageArchetype="settings-console"
      fallbackPattern="stripe-settings"
      patternHints={['summary-before-secondary-actions']}
      sections={['hero', 'form', 'summary']}
      componentMap={{ summary: 'settingsSnapshot' }}
      eyebrow="Central de avisos"
      title="Fique por dentro sem sobrecarregar sua caixa"
      description="Escolha onde quer receber avisos e quais atualizacoes importam."
      highlights={['Mude quando quiser', 'Sem spam, so o que importa']}
      formTitle="Preferencias de aviso"
      formDescription="Ajuste em dois passos e pronto."
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values))} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="E-mail para notificacoes" hint="Use o e-mail que deve receber avisos sempre que houver atualizacao do chamado.">
            <input {...register('notificationEmail')} type="email" placeholder="nome@empresa.com" style={inputStyle()} />
            {errors.notificationEmail ? <small style={{ color: '#b91c1c' }}>{errors.notificationEmail.message}</small> : null}
          </FieldGroup>
          <FieldGroup label="Notificar atualizacoes do chamado" hint="Escolha se deseja receber avisos por e-mail sobre novidades no chamado.">
            <select {...register('ticketUpdateAlerts')} style={inputStyle()}>
              <option value="enabled">Ativado</option>
              <option value="disabled">Desativado</option>
            </select>
            {errors.ticketUpdateAlerts ? <small style={{ color: '#b91c1c' }}>{errors.ticketUpdateAlerts.message}</small> : null}
          </FieldGroup>
          <PrimaryButton type="submit" accent="teal">
            {isSubmitting || mutation.isPending ? 'Salvando...' : 'Salvar'}
          </PrimaryButton>
          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Preferencias de notificacao atualizadas com sucesso.</p> : null}
          {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
        </form>
      }
      summaryTitle="Historico de mudancas"
      summaryDescription="Confira rapidamente o ultimo estado salvo das suas preferencias."
      summaryMeta={isLoading ? 'Atualizando' : items.length ? 'Preferencias salvas' : 'Sem alteracoes'}
      summaryHighlights={['Defina seu email e selecione apenas os alertas que valem a pena.', 'Ajuste em dois passos e pronto.']}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {isLoading ? (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Historico de mudancas</strong>
            <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Carregando suas preferencias...</p>
          </div>
        ) : items.length ? (
          items.slice(0, 3).map((item) => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{item.notificationEmail || 'Email principal'}</strong>
              <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>
                Alertas de atualizacao: {item.ticketUpdateAlerts === 'enabled' ? 'ativos' : 'desativados'}.
              </p>
            </div>
          ))
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Historico de mudancas</strong>
            <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Voce ainda nao alterou suas preferencias.</p>
          </div>
        )}
      </div>
    </SettingsWorkbench>
  );
}
