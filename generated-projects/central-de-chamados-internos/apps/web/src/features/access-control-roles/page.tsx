import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { SettingsWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { type AccessControlRoleRequest, type AccessControlRoleResponse } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
import { accessControlRoleFormSchema, type AccessControlRoleFormValues } from './schema';
import { accessControlRolesQueryKey, createAccessControlRole, fetchAccessControlRoleItems } from './service';

const initialValues: AccessControlRoleFormValues = {
  roleName: 'solicitante',
  permissionMatrix: '',
  accessScope: 'team',
};

function humanizeScope(value: string) {
  const labels: Record<string, string> = {
    self_service: 'Acesso proprio',
    team: 'Equipe',
    global: 'Toda a operacao',
  };

  return labels[value] || value;
}

export function AccessControlRolesPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<AccessControlRoleResponse[]>({
    queryKey: accessControlRolesQueryKey,
    queryFn: fetchAccessControlRoleItems,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccessControlRoleFormValues>({
    resolver: zodResolver(accessControlRoleFormSchema),
    defaultValues: initialValues,
  });

  const mutation = useMutation({
    mutationFn: (input: AccessControlRoleRequest) => createAccessControlRole(input),
    onSuccess: (created) => {
      queryClient.setQueryData<AccessControlRoleResponse[]>(accessControlRolesQueryKey, (current = []) => [created, ...current]);
      reset(initialValues);
    },
  });

  return (
    <SettingsWorkbench
      accent="blue"
      productMode="governance-console"
      uiIntent="configure"
      layoutVariant="checklist-settings"
      pageArchetype="settings-console"
      fallbackPattern="stripe-settings"
      patternHints={['summary-before-secondary-actions']}
      sections={['hero', 'form', 'summary', 'activity']}
      componentMap={{ summary: 'settingsSnapshot', activity: 'activityTimeline' }}
      eyebrow="Controle de acesso"
      title="Defina quem faz o que"
      description="Crie e ajuste papeis para cada equipe com visao clara do que cada permissao libera."
      highlights={['Permissoes detalhadas por recurso', 'Escopo flexivel para equipe ou operacao inteira']}
      formTitle="Novo perfil"
      formDescription="Escolha o escopo e as permissoes para montar um papel seguro e agil."
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values))} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Perfil de acesso" hint="Selecione o papel que vai receber esse conjunto de capacidades.">
            <select {...register('roleName')} style={inputStyle()}>
              <option value="solicitante">Solicitante</option>
              <option value="analista">Analista</option>
              <option value="gestor">Gestor</option>
            </select>
            {errors.roleName ? <small style={{ color: '#b91c1c' }}>{errors.roleName.message}</small> : null}
          </FieldGroup>

          <FieldGroup label="Permissoes" hint="Liste as acoes que esse perfil pode executar sem precisar traduzir em jargao tecnico.">
            <textarea
              {...register('permissionMatrix')}
              placeholder="Ex.: acompanhar chamados, priorizar fila critica, aprovar escalonamento"
              style={inputStyle({ minHeight: 132, resize: 'vertical' })}
            />
            {errors.permissionMatrix ? <small style={{ color: '#b91c1c' }}>{errors.permissionMatrix.message}</small> : null}
          </FieldGroup>

          <FieldGroup label="Escopo" hint="Defina onde esse papel pode atuar para evitar excesso de acesso.">
            <select {...register('accessScope')} style={inputStyle()}>
              <option value="self_service">Somente o proprio acesso</option>
              <option value="team">Equipe</option>
              <option value="global">Toda a operacao</option>
            </select>
            {errors.accessScope ? <small style={{ color: '#b91c1c' }}>{errors.accessScope.message}</small> : null}
          </FieldGroup>

          <PrimaryButton type="submit" accent="blue">
            {isSubmitting || mutation.isPending ? 'Aplicando...' : 'Aplicar perfil'}
          </PrimaryButton>

          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Perfil aplicado com sucesso.</p> : null}
          {mutation.error ? (
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Falha ao salvar o perfil.'}
            </p>
          ) : null}
        </form>
      }
      summaryTitle="Perfis ativos"
      summaryDescription="Veja rapidamente como o acesso esta distribuido e qual perfil acabou de ser configurado."
      summaryMeta={isLoading ? 'Carregando perfis' : items.length ? `${items.length} perfil(is)` : 'Sem perfis'}
      summaryHighlights={['Monte perfis com as permissoes certas para cada funcao.', 'Veja o impacto antes de aplicar.']}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {isLoading ? (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Carregando perfis ativos...</p>
          </div>
        ) : items.length ? (
          items.slice(0, 3).map((item) => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{item.roleName}</strong>
              <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>
                Escopo atual: {humanizeScope(item.accessScope)}.
              </p>
            </div>
          ))
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Perfis ativos</strong>
            <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>Nenhum perfil criado ainda. Monte o primeiro acima.</p>
          </div>
        )}
      </div>
    </SettingsWorkbench>
  );
}
