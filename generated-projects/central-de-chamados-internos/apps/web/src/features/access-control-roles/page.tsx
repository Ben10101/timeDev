import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AccessControlRoleRequest, AccessControlRoleResponse } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createAccessControlRole, fetchAccessControlRoleItems } from './service';
const initialForm: AccessControlRoleRequest = {
 roleName: 'solicitante',
 permissionMatrix: '',
 accessScope: 'team',
};
export function AccessControlRolesPage() {
 const [items, setItems] = useState<AccessControlRoleResponse[]>([]);
 const [form, setForm] = useState<AccessControlRoleRequest>(initialForm);
 const [feedback, setFeedback] = useState('');
 const [errorMessage, setErrorMessage] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 useEffect(() => {
 fetchAccessControlRoleItems()
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
 const created = await createAccessControlRole({
 roleName: form.roleName,
 permissionMatrix: form.permissionMatrix,
 accessScope: form.accessScope,
 });
 setItems((current) => [created, ...current]);
 setForm(initialForm);
 setFeedback('Perfil de acesso atualizado com sucesso.');
 } catch (error) {
 setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
 } finally {
 setIsSubmitting(false);
 }
 }
 return (
 <FeatureWorkbench
 accent="blue"
 productMode="governance-console"
 eyebrow="Governanca"
 title="Matriz de Controle de Acesso"
 description="Configure perfis de acesso com permissoes granulares para cada funcao da organizacao."
 metrics={undefined}
 highlights={["Controle granular por funcao","Seguranca operacional garantida"]}
 formTitle="Configurar Perfil"
 formDescription="Selecione a funcao e defina o escopo de atuacao e as permissoes especificas."
 form={
 <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Perfil de acesso" hint="Selecione o perfil que recebera o conjunto de permissoes.">
 <select
 value={form.roleName}
 onChange={(event) => setForm((current) => ({ ...current, roleName: event.target.value }))}
 style={inputStyle()}
 >
 <option value="solicitante">Solicitante</option>
 <option value="analista">Analista</option>
 <option value="gestor">Gestor</option>
 </select>
 </FieldGroup>
 <FieldGroup label="Permissoes" hint="Descreva as permissoes liberadas para o perfil em formato claro e auditavel.">
 <textarea
 value={form.permissionMatrix}
 onChange={(event) => setForm((current) => ({ ...current, permissionMatrix: event.target.value }))}
 placeholder="Ex.: visualizar chamados, aprovar atendimento, gerenciar usuarios"
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 </FieldGroup>
 <FieldGroup label="Escopo" hint="Defina se o perfil atua apenas na propria fila ou em toda a operacao.">
 <select
 value={form.accessScope}
 onChange={(event) => setForm((current) => ({ ...current, accessScope: event.target.value }))}
 style={inputStyle()}
 >
 <option value="self_service">Self service</option>
 <option value="team">Team</option>
 <option value="global">Global</option>
 </select>
 </FieldGroup>
 <PrimaryButton type="submit" accent="blue">
 {isSubmitting ? 'Processando...' : 'Salvar Perfil'}
 </PrimaryButton>
 {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
 {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
 </form>
 }
 listTitle="Governanca minima"
 listDescription="Cada perfil deve explicitar permissoes, escopo de acesso e responsabilidade operacional."
 listMeta={isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'}
 >
 <div style={{ display: 'grid', gap: 14 }}>
 <div style={{ padding: '16px 18px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Canal principal</strong>
 <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Configure perfis de acesso com permissoes granulares para cada funcao da organizacao.</p>
 </div>
 <div style={{ display: 'grid', gap: 10 }}>
 {["Controle granular por funcao","Seguranca operacional garantida"].map((item) => (
 <div key={item} style={{ padding: '12px 14px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', color: '#475569', lineHeight: 1.6 }}>
 {item}
 </div>
 ))}
 </div>
 <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eef5ef', border: '1px solid #d9e7de', color: '#21493d' }}>
 {isLoading ? 'Sincronizando o estado atual...' : items.length ? 'Preferencia registrada e pronta para acompanhamento.' : 'Nenhuma politica configurada. Comece definindo um novo perfil.' }
 </div>
 </div>
 </FeatureWorkbench>
 );
}