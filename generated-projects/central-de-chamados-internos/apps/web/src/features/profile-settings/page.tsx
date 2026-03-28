import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createProfileSettings, fetchProfileSettingsItems } from './service';
const initialForm: ProfileSettingsRequest = {
 fullName: '',
 profilePhotoUrl: '',
 email: '',
};
export function ProfileSettingsPage() {
 const [items, setItems] = useState<ProfileSettingsResponse[]>([]);
 const [form, setForm] = useState<ProfileSettingsRequest>(initialForm);
 const [feedback, setFeedback] = useState('');
 const [errorMessage, setErrorMessage] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 useEffect(() => {
 fetchProfileSettingsItems()
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
 const created = await createProfileSettings({
 fullName: form.fullName,
 profilePhotoUrl: form.profilePhotoUrl,
 email: form.email,
 });
 setItems((current) => [created, ...current]);
 setForm(initialForm);
 setFeedback('Perfil atualizado com sucesso.');
 } catch (error) {
 setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
 } finally {
 setIsSubmitting(false);
 }
 }
 return (
 <FeatureWorkbench
 accent="teal"
 productMode="structured-workspace"
 eyebrow="Configuracoes"
 title="Informacoes de Perfil"
 description="Mantenha seus dados atualizados para acesso facilitado e suporte prioritario."
 metrics={undefined}
 highlights={["Nome completo para identificacao precisa.","Foto de perfil para reconhecimento visual."]}
 formTitle="Detalhes Pessoais"
 formDescription="Altere seu nome, foto e e-mail para refletir suas preferencias."
 form={
 <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Nome completo" hint="Informe o nome que sera exibido no seu perfil.">
 <input
 type="text"
 value={form.fullName}
 onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
 placeholder="Digite seu nome completo"
 style={inputStyle()}
 />
 </FieldGroup>
 <FieldGroup label="Foto do perfil" hint="Informe a URL da imagem do perfil. Considere JPG/PNG com limite de 2MB no ambiente real.">
 <input
 type="url"
 value={form.profilePhotoUrl}
 onChange={(event) => setForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))}
 placeholder="https://exemplo.com/minha-foto.png"
 style={inputStyle()}
 />
 </FieldGroup>
 <FieldGroup label="E-mail" hint="Use um e-mail valido para acessar a plataforma.">
 <input
 type="email"
 value={form.email}
 onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
 placeholder="Digite seu e-mail"
 style={inputStyle()}
 />
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting ? 'Processando...' : 'Salvar Alteracoes'}
 </PrimaryButton>
 {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
 {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
 </form>
 }
 listTitle="Boas praticas do perfil"
 listDescription="O aluno precisa manter dados atualizados, com nome obrigatorio e foto valida."
 listMeta={isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'}
 >
 <div style={{ display: 'grid', gap: 14 }}>
 <div style={{ padding: '16px 18px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Canal principal</strong>
 <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Mantenha seus dados atualizados para acesso facilitado e suporte prioritario.</p>
 </div>
 <div style={{ display: 'grid', gap: 10 }}>
 {["Nome completo para identificacao precisa.","Foto de perfil para reconhecimento visual."].map((item) => (
 <div key={item} style={{ padding: '12px 14px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', color: '#475569', lineHeight: 1.6 }}>
 {item}
 </div>
 ))}
 </div>
 <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eef5ef', border: '1px solid #d9e7de', color: '#21493d' }}>
 {isLoading ? 'Carregando informacoes...' : items.length ? 'Configuracao salva com sucesso.' : 'Nenhum registro encontrado. Adicione suas informacoes para comecar.' }
 </div>
 </div>
 </FeatureWorkbench>
 );
}