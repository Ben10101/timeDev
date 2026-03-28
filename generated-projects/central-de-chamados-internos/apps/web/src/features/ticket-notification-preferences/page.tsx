import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { TicketNotificationPreferenceRequest, TicketNotificationPreferenceResponse } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createTicketNotificationPreference, fetchTicketNotificationPreferenceItems } from './service';
const initialForm: TicketNotificationPreferenceRequest = {
 notificationEmail: '',
 ticketUpdateAlerts: 'enabled',
};
export function TicketNotificationPreferencesPage() {
 const [items, setItems] = useState<TicketNotificationPreferenceResponse[]>([]);
 const [form, setForm] = useState<TicketNotificationPreferenceRequest>(initialForm);
 const [feedback, setFeedback] = useState('');
 const [errorMessage, setErrorMessage] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 useEffect(() => {
 fetchTicketNotificationPreferenceItems()
 .then(setItems)
 .catch(() => setItems([]))
 .finally(() => setIsLoading(false));
 }, []);
 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFeedback('');
 setErrorMessage('');
 setIsSubmitting(true);
 try {
 const created = await createTicketNotificationPreference({
 notificationEmail: form.notificationEmail,
 ticketUpdateAlerts: form.ticketUpdateAlerts,
 });
 setItems((current) => [created, ...current]);
 setForm(initialForm);
 setFeedback('Preferencias de notificacao atualizadas com sucesso.');
 } catch (error) {
 setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
 } finally {
 setIsSubmitting(false);
 }
 }
 return (
 <FeatureWorkbench
 accent="teal"
 productMode="self-service-settings"
 eyebrow="Autogestao"
 title="Mantenha-se informado sem sair do fluxo"
 description="Configure o recebimento de alertas por e-mail para acompanhar o progresso dos seus chamados em tempo real, sem precisar acessar o sistema constantemente."
 metrics={undefined}
 highlights={["Receba atualizacoes instantaneas no seu e-mail","Acompanhe o status sem interromper sua rotina"]}
 formTitle="Configuracao de Alertas"
 formDescription="Defina o e-mail de contato e ative as notificacoes para atualizacoes de status."
 form={
 <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="E-mail para notificacoes" hint="Use o e-mail que deve receber avisos sempre que houver atualizacao do chamado.">
 <input
 type="email"
 value={form.notificationEmail}
 onChange={(event) => setForm((current) => ({ ...current, notificationEmail: event.target.value }))}
 placeholder="nome@empresa.com"
 style={inputStyle()}
 />
 </FieldGroup>
 <FieldGroup label="Notificar atualizacoes do chamado" hint="Escolha se deseja receber avisos por e-mail sobre novidades no chamado.">
 <select
 value={form.ticketUpdateAlerts}
 onChange={(event) => setForm((current) => ({ ...current, ticketUpdateAlerts: event.target.value }))}
 style={inputStyle()}
 >
 <option value="enabled">Ativado</option>
 <option value="disabled">Desativado</option>
 </select>
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting ? 'Processando...' : 'Salvar Preferencias'}
 </PrimaryButton>
 {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
 {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
 </form>
 }
 listTitle="Rotina de acompanhamento"
 listDescription="As notificacoes precisam manter o colaborador informado quando o chamado for atualizado."
 listMeta={isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'}
 >
 <div style={{ display: 'grid', gap: 14 }}>
 <div style={{ padding: '16px 18px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Canal principal</strong>
 <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Configure o recebimento de alertas por e-mail para acompanhar o progresso dos seus chamados em tempo real, sem precisar acessar o sistema constantemente.</p>
 </div>
 <div style={{ display: 'grid', gap: 10 }}>
 {["Receba atualizacoes instantaneas no seu e-mail","Acompanhe o status sem interromper sua rotina"].map((item) => (
 <div key={item} style={{ padding: '12px 14px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', color: '#475569', lineHeight: 1.6 }}>
 {item}
 </div>
 ))}
 </div>
 <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eef5ef', border: '1px solid #d9e7de', color: '#21493d' }}>
 {isLoading ? 'Carregando informacoes...' : items.length ? 'Configuracao salva com sucesso.' : 'Nenhuma configuracao ativa. Ajuste as preferencias acima para comecar.' }
 </div>
 </div>
 </FeatureWorkbench>
 );
}