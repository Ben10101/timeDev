function escapeTemplate(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function humanizeSelectOptionLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const directMap = {
    self_service: 'Somente o proprio acesso',
    team: 'Equipe',
    global: 'Toda a empresa',
    enabled: 'Ativado',
    disabled: 'Desativado',
    active: 'Ativo',
    draft: 'Rascunho',
  };

  if (directMap[normalized]) return directMap[normalized];
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function camelCase(value, fallback = 'generatedField') {
  const parts = String(value || fallback)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (!parts.length) return fallback;
  const joined = parts
    .map((part, index) =>
      index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
  return joined || fallback;
}

function normalizeLayoutVariant(layoutVariant, productMode, screenTemplate, uiIntent) {
  if (layoutVariant) return layoutVariant;
  if (screenTemplate === 'dashboard') return 'hero-metrics';
  if (screenTemplate === 'workspace') return 'evidence-split';
  if (screenTemplate === 'settings') return productMode === 'governance-console' ? 'checklist-settings' : 'summary-first';
  if (uiIntent === 'attach') return 'evidence-split';
  return 'summary-first';
}

function resolveUiFamily(technicalSpec, screenTemplate, productMode, pageArchetype) {
  const explicitFamily =
    technicalSpec.implementationManifest?.classification?.uiFamily ||
    technicalSpec.classification?.uiFamily ||
    technicalSpec.frontend?.uiFamily ||
    technicalSpec.structured?.classification?.uiFamily;

  if (explicitFamily) return explicitFamily;
  if (screenTemplate === 'settings') return 'settings-console';
  if (screenTemplate === 'dashboard' || productMode === 'manager-cockpit' || pageArchetype === 'executive-dashboard') {
    return 'executive-cockpit';
  }
  if (screenTemplate === 'workspace' && (String(productMode || '').includes('planner') || pageArchetype === 'approval-flow')) {
    return 'planner-workbench';
  }
  return 'operations-workspace';
}

function buildSchemaField(field) {
  if (field.inputType === 'select' && Array.isArray(field.selectOptions) && field.selectOptions.length) {
    return `  ${field.name}: z.enum([${field.selectOptions.map((option) => `'${escapeTemplate(option)}'`).join(', ')}], { message: '${escapeTemplate(field.helperText || `Escolha um valor valido para ${field.label || field.name}.`)}' }),`;
  }

  const chain = ['z.string().trim()'];
  if (field.inputType === 'email') chain.push(`.email('${escapeTemplate(field.helperText || 'Use um e-mail valido.') }')`);
  if (field.inputType === 'url') chain.push(`.url('${escapeTemplate(field.helperText || 'Informe uma URL valida.') }')`);

  const minValidation = (field.validations || []).find((validation) => /^min:\d+/.test(validation));
  if (minValidation) {
    const minLength = Number(minValidation.split(':')[1] || '1');
    chain.push(`.min(${minLength}, '${escapeTemplate(field.helperText || `Preencha ${field.label || field.name}.`)}')`);
  } else if (field.required) {
    chain.push(`.min(1, '${escapeTemplate(field.helperText || `Preencha ${field.label || field.name}.`)}')`);
  }

  return `  ${field.name}: ${chain.join('')},`;
}

function buildFieldBlock(field) {
  let control = '';
  if (field.inputType === 'textarea') {
    control = `            <textarea
              {...register('${field.name}')}
              placeholder="${escapeTemplate(field.placeholder)}"
              style={inputStyle({ minHeight: 132, resize: 'vertical' })}
            />`;
  } else if (field.inputType === 'select' && Array.isArray(field.selectOptions) && field.selectOptions.length) {
    const options = field.selectOptions
      .map((option) => `              <option value="${escapeTemplate(option)}">${escapeTemplate(humanizeSelectOptionLabel(option))}</option>`)
      .join('\n');
    control = `            <select
              {...register('${field.name}')}
              style={inputStyle()}
            >
${options}
            </select>`;
  } else {
    control = `            <input
              {...register('${field.name}')}
              type="${field.inputType}"
              placeholder="${escapeTemplate(field.placeholder)}"
              style={inputStyle()}
            />`;
  }

  return `          <FieldGroup label="${escapeTemplate(field.label)}" hint="${escapeTemplate(field.helperText)}">
${control}
            {errors.${field.name} ? <small style={{ color: '#b91c1c' }}>{errors.${field.name}.message}</small> : null}
          </FieldGroup>`;
}

function buildLoadingState(componentMap = {}) {
  const recordsLead = componentMap.recordsLead || '';

  if (recordsLead === 'insightStrip') {
    return `        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {[0, 1, 2].map((placeholder) => (
            <div key={placeholder} style={{ padding: '18px 16px', borderRadius: 14, background: '#111827', border: '1px solid rgba(255,255,255,0.08)', minHeight: 88 }} />
          ))}
        </div>`;
  }

  if (recordsLead === 'queueRail') {
    return `        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2].map((placeholder) => (
            <div key={placeholder} style={{ padding: '18px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 74 }} />
          ))}
        </div>`;
  }

  if (recordsLead === 'approvalSteps') {
    return `        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2].map((placeholder) => (
            <div key={placeholder} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe' }} />
              <div style={{ minHeight: 44, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
            </div>
          ))}
        </div>`;
  }

  if (recordsLead === 'evidenceRail') {
    return `        <div style={{ padding: '18px 16px', borderRadius: 16, background: '#fffaf0', border: '1px dashed #f59e0b' }}>
          <p style={{ margin: 0, color: '#92400e', lineHeight: 1.7 }}>Preparando trilha de evidencias para consulta do caso...</p>
        </div>`;
  }

  return `        <div style={{ padding: '18px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Carregando dados da feature...</p>
        </div>`;
}

function buildRecordCard(componentMap = {}, previewFieldName = 'id', secondaryFieldName = 'status') {
  const recordsLead = componentMap.recordsLead || '';

  if (recordsLead === 'insightStrip') {
    return `            <article
              key={item.id}
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.35fr 0.8fr 0.85fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewFieldName} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryFieldName} || 'Recorte pronto para leitura executiva')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>`;
  }

  if (recordsLead === 'queueRail') {
    return `            <article
              key={item.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.8fr 0.8fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewFieldName} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryFieldName} || 'Item pronto para priorizacao')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'pending'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>`;
  }

  if (recordsLead === 'evidenceRail') {
    return `            <article
              key={item.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewFieldName} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryFieldName} || 'Evidencia pronta para consulta')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>`;
  }

  if (recordsLead === 'approvalSteps') {
    return `            <article
              key={item.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.15fr 0.9fr 0.85fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewFieldName} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryFieldName} || 'Etapa pronta para decisao')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'pending'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>`;
  }

  return `            <article
              key={item.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewFieldName} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryFieldName} || 'Configuracao registrada')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>`;
}

function buildEmptyState(componentMap = {}, recordsEmptyState = 'Nenhum registro disponivel ainda.') {
  const recordsLead = componentMap.recordsLead || '';

  if (recordsLead === 'insightStrip') {
    return `        <div style={{ padding: 28, borderRadius: 16, background: '#eff6ff', border: '1px dashed #93c5fd', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontSize: 24 }}>I</div>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>${JSON.stringify(recordsEmptyState)}</p>
        </div>`;
  }

  if (recordsLead === 'queueRail') {
    return `        <div style={{ padding: 28, borderRadius: 16, background: '#faf5ff', border: '1px dashed #d8b4fe', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'grid', placeItems: 'center', fontSize: 24 }}>!</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>${JSON.stringify(recordsEmptyState)}</p>
        </div>`;
  }

  if (recordsLead === 'evidenceRail') {
    return `        <div style={{ padding: 28, borderRadius: 16, background: '#fff7ed', border: '1px dashed #fdba74', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#ffedd5', color: '#c2410c', display: 'grid', placeItems: 'center', fontSize: 24 }}>+</div>
          <p style={{ margin: 0, color: '#7c2d12', lineHeight: 1.7 }}>${JSON.stringify(recordsEmptyState)}</p>
        </div>`;
  }

  if (recordsLead === 'approvalSteps') {
    return `        <div style={{ padding: 28, borderRadius: 16, background: '#eef2ff', border: '1px dashed #a5b4fc', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'grid', placeItems: 'center', fontSize: 24 }}>1</div>
          <p style={{ margin: 0, color: '#4c1d95', lineHeight: 1.7 }}>${JSON.stringify(recordsEmptyState)}</p>
        </div>`;
  }

  return `        <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'grid', placeItems: 'center', fontSize: 24 }}>O</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>${JSON.stringify(recordsEmptyState)}</p>
        </div>`;
}

export function buildModernFrontendFeatureFiles(task, technicalSpec, { sharedImportPath, uiImportPath, domainTemplate }) {
  const entityName = technicalSpec.entityName;
  const fields = technicalSpec.domain.fields || [];
  const layout = technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'split';
  const productMode = technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || 'structured-workspace';
  const uiIntent = technicalSpec.structured?.classification?.intent || 'custom';
  const screenSpec = technicalSpec.frontend?.screenSpec || technicalSpec.screenSpec || technicalSpec.generationIR?.frontend?.screenSpec || {};
  const pageArchetype = screenSpec.pageArchetype || technicalSpec.frontend?.pageArchetype || '';
  const fallbackPattern = screenSpec.fallbackPattern || technicalSpec.frontend?.fallbackPattern || '';
  const patternHints = Array.isArray(screenSpec.patternHints)
    ? screenSpec.patternHints
    : Array.isArray(technicalSpec.frontend?.patternHints)
      ? technicalSpec.frontend.patternHints
      : [];
  const sections = Array.isArray(screenSpec.sections)
    ? screenSpec.sections
    : Array.isArray(technicalSpec.frontend?.sections)
      ? technicalSpec.frontend.sections
      : [];
  const componentMap =
    screenSpec.componentMap && typeof screenSpec.componentMap === 'object'
      ? screenSpec.componentMap
      : technicalSpec.frontend?.componentMap && typeof technicalSpec.frontend.componentMap === 'object'
        ? technicalSpec.frontend.componentMap
        : {};
  const layoutVariant = normalizeLayoutVariant(technicalSpec.frontend?.layoutVariant, productMode, layout, uiIntent);
  const uiFamily = resolveUiFamily(technicalSpec, layout, productMode, pageArchetype);
  const shellComponentNameByFamily = {
    'operations-workspace': 'OperationsWorkspace',
    'executive-cockpit': 'ExecutiveCockpit',
    'settings-console': 'SettingsConsole',
    'planner-workbench': 'PlannerWorkbench',
  };
  const shellComponentName = shellComponentNameByFamily[uiFamily] || 'OperationsWorkspace';
  const isSettingsLayout = uiFamily === 'settings-console';
  const uiImports = `${shellComponentName}, FieldGroup, PrimaryButton, inputStyle`;
  const schemaName = `${camelCase(entityName, 'generatedEntity')}FormSchema`;
  const formValuesType = `${entityName}FormValues`;
  const queryKeyName = `${camelCase(entityName, 'generatedEntity')}QueryKey`;
  const initialStateEntries = fields
    .map((field) => `  ${field.name}: '${escapeTemplate(field.defaultValue || '')}',`)
    .join('\n');
  const payloadObject = fields.map((field) => `          ${field.name}: values.${field.name},`).join('\n');
  const schemaFields = fields.map(buildSchemaField).join('\n');
  const inputBlocks = fields.map(buildFieldBlock).join('\n');
  const previewField = fields.find((field) => field.name === 'email') || fields[0];
  const secondaryField = fields.find((field) => field.name !== previewField?.name && field.name !== 'password') || previewField;
  const highlights = JSON.stringify((technicalSpec.frontend.highlights || ['Experiencia preparada para uma operacao mais clara e confiavel.']).slice(0, 3));
  const loadingState = buildLoadingState(componentMap, technicalSpec.frontend.recordsEmptyState || domainTemplate?.recordsEmptyState || 'Nenhum registro disponivel ainda.');
  const recordCard = buildRecordCard(componentMap, previewField?.name || 'id', secondaryField?.name || 'status');
  const emptyState = buildEmptyState(componentMap, technicalSpec.frontend.recordsEmptyState || domainTemplate?.recordsEmptyState || 'Nenhum registro disponivel ainda.');
  const summaryMeta = isSettingsLayout
    ? "isLoading ? 'Atualizando' : items.length ? 'Configuracao salva' : 'Sem alteracoes'"
    : "isLoading ? 'Atualizando' : items.length ? `${items.length} registro(s)` : 'Nenhum registro'";

  const pageContent = `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';
import { ${uiImports} } from '${uiImportPath}';
import { ${schemaName}, type ${formValuesType} } from './schema';
import { ${queryKeyName}, create${entityName}, fetch${entityName}Items } from './service';

const initialForm: ${formValuesType} = {
${initialStateEntries}
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

export function ${technicalSpec.frontend.pageComponentName}() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<${technicalSpec.shared.responseContractName}[]>({
    queryKey: ${queryKeyName},
    queryFn: fetch${entityName}Items,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<${formValuesType}>({
    resolver: zodResolver(${schemaName}),
    defaultValues: initialForm,
  });

  const mutation = useMutation({
    mutationFn: (input: ${technicalSpec.shared.requestContractName}) => create${entityName}(input),
    onSuccess: (created) => {
      queryClient.setQueryData<${technicalSpec.shared.responseContractName}[]>(${queryKeyName}, (current = []) => [created, ...current]);
      reset(initialForm);
    },
  });

  return (
    <${shellComponentName}
      accent="${escapeTemplate((technicalSpec.frontend.accent || domainTemplate?.accent || 'teal'))}"
      productMode="${escapeTemplate(productMode)}"
      uiIntent="${escapeTemplate(uiIntent)}"
      layoutVariant="${escapeTemplate(layoutVariant)}"
      pageArchetype="${escapeTemplate(pageArchetype)}"
      fallbackPattern="${escapeTemplate(fallbackPattern)}"
      patternHints={${JSON.stringify(patternHints.slice(0, 6))}}
      sections={${JSON.stringify(sections.slice(0, 8))}}
      componentMap={${JSON.stringify(componentMap)}}
      eyebrow="${escapeTemplate(technicalSpec.frontend.heroEyebrow || technicalSpec.frontend.navigationLabel || technicalSpec.entityName)}"
      title="${escapeTemplate(technicalSpec.frontend.heroTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"
      description="${escapeTemplate(technicalSpec.frontend.heroDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"
      highlights={${highlights}}
      formTitle="${escapeTemplate(technicalSpec.frontend.formCardTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"
      formDescription="${escapeTemplate(technicalSpec.frontend.formCardDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
${payloadObject}
        }))} style={{ display: 'grid', gap: 18 }}>
${inputBlocks}
          <PrimaryButton type="submit" accent="${escapeTemplate((technicalSpec.frontend.accent || domainTemplate?.accent || 'teal'))}">
            {isSubmitting || mutation.isPending ? 'Processando...' : '${escapeTemplate(technicalSpec.domain.submitLabel)}'}
          </PrimaryButton>

          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>${JSON.stringify(technicalSpec.domain.successMessage)}</p> : null}
          {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
        </form>
      }
      ${isSettingsLayout ? 'summaryTitle' : 'listTitle'}="${escapeTemplate(technicalSpec.frontend.recordsTitle || domainTemplate?.recordsTitle || 'Registros ativos')}"
      ${isSettingsLayout ? 'summaryDescription' : 'listDescription'}="${escapeTemplate(technicalSpec.frontend.recordsEmptyState || domainTemplate?.recordsEmptyState || 'Acompanhe os registros desta area.')}"
      ${isSettingsLayout ? 'summaryMeta' : 'listMeta'}={${summaryMeta}}
      ${isSettingsLayout ? `summaryHighlights={${highlights}}` : ''}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {isLoading ? (
${loadingState}
        ) : items.length ? (
          items.map((item) => (
${recordCard}
          ))
        ) : (
${emptyState}
        )}
      </div>
    </${shellComponentName}>
  );
}
`;

  return [
    {
      relativePath: `${technicalSpec.frontend.featurePath}/schema.ts`,
      content: `import { z } from 'zod';\n\nexport const ${schemaName} = z.object({\n${schemaFields}\n});\n\nexport type ${formValuesType} = z.infer<typeof ${schemaName}>;\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/service.ts`,
      content: `import type { ${technicalSpec.shared.listContractName}, ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nexport const ${queryKeyName} = ['${escapeTemplate(technicalSpec.featureKey)}'];\n\nexport async function fetch${entityName}Items(): Promise<${technicalSpec.shared.responseContractName}[]> {\n  const response = await fetch('${technicalSpec.backend.routeBase}');\n  if (!response.ok) {\n    throw new Error('Falha ao carregar registros da feature.');\n  }\n  const data: ${technicalSpec.shared.listContractName} = await response.json();\n  return data.items || [];\n}\n\nexport async function create${entityName}(input: ${technicalSpec.shared.requestContractName}): Promise<${technicalSpec.shared.responseContractName}> {\n  const response = await fetch('${technicalSpec.backend.routeBase}', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(input),\n  });\n\n  if (!response.ok) {\n    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));\n    throw new Error(error.message || 'Falha ao criar registro.');\n  }\n\n  return response.json();\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      content: pageContent,
      fileType: 'tsx',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/index.ts`,
      content: `export { ${technicalSpec.frontend.pageComponentName} } from './page';\nexport { fetch${entityName}Items } from './service';\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/README.md`,
      content: `# ${task.title}\n\nFeature frontend incremental criada a partir da task refinada.\n`,
      fileType: 'md',
    },
  ];
}
