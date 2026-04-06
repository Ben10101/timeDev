import { buildPatternHints, resolveUiArchetype } from './uiArchetypeService.js';

function normalizeText(value, fallback = '') {
  return String(value || fallback).trim();
}

function uniqueList(items = []) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function normalizeField(field = {}) {
  return {
    name: normalizeText(field.name, 'title'),
    label: normalizeText(field.label || field.name, 'Title'),
    inputType: normalizeText(field.inputType || field.type || 'text', 'text'),
    required: Boolean(field.required),
    options: Array.isArray(field.selectOptions)
      ? field.selectOptions.filter(Boolean)
      : Array.isArray(field.options)
        ? field.options.filter(Boolean)
        : [],
  };
}

function deriveEntityName(technicalSpec = {}) {
  return (
    technicalSpec.entityName ||
    technicalSpec.primaryEntity ||
    technicalSpec.backend?.entityName ||
    technicalSpec.shared?.entityName ||
    'GeneratedItem'
  );
}

function buildFrontendComponentMap({ pageArchetype, sections = [] } = {}) {
  const sectionSet = new Set((sections || []).filter(Boolean));

  if (pageArchetype === 'executive-dashboard') {
    return {
      recordsLead: 'insightStrip',
      highlights: 'insightCards',
    };
  }

  if (pageArchetype === 'operations-queue' || pageArchetype === 'review-queue') {
    return {
      recordsLead: 'queueRail',
      activity: sectionSet.has('activity') ? 'activityTimeline' : null,
    };
  }

  if (pageArchetype === 'approval-flow') {
    return {
      recordsLead: 'approvalSteps',
      summary: sectionSet.has('summary') ? 'settingsSnapshot' : null,
      activity: sectionSet.has('activity') ? 'activityTimeline' : null,
    };
  }

  if (pageArchetype === 'evidence-workbench') {
    return {
      recordsLead: 'evidenceRail',
    };
  }

  if (pageArchetype === 'settings-console') {
    return {
      summary: 'settingsSnapshot',
      activity: sectionSet.has('activity') ? 'activityTimeline' : null,
    };
  }

  if (pageArchetype === 'intake-form') {
    return {
      summary: 'settingsSnapshot',
    };
  }

  return {
    recordsLead: sectionSet.has('queue') ? 'queueRail' : sectionSet.has('steps') ? 'approvalSteps' : null,
    activity: sectionSet.has('activity') ? 'activityTimeline' : null,
    summary: sectionSet.has('summary') ? 'settingsSnapshot' : null,
  };
}

function buildBackendOperationMap({ pageArchetype, domainSignals = {}, fields = [] } = {}) {
  const fieldNames = new Set(fields.map((field) => field.name));
  const hasStatusField = ['status', 'approvalStatus', 'slaStatus'].some((name) => fieldNames.has(name));
  const hasAttachmentField = ['attachmentUrl', 'attachmentName', 'fileUrl', 'fileName', 'evidenceUrl'].some((name) =>
    fieldNames.has(name)
  );
  const hasApprovalField = ['approver', 'approvalStatus', 'decision', 'reviewDecision'].some((name) =>
    fieldNames.has(name)
  );
  const hasPriorityField = ['priority', 'severity', 'slaStatus'].some((name) => fieldNames.has(name));
  const hasSettingsField = ['enabled', 'notificationChannel', 'digestFrequency', 'accessScope'].some((name) =>
    fieldNames.has(name)
  );

  const operationMap = {
    list: pageArchetype === 'operations-queue' || pageArchetype === 'review-queue' ? 'paginatedQueue' : 'collectionRead',
    detail: 'detailRead',
    create: pageArchetype === 'intake-form' ? 'intakeCreate' : 'recordCreate',
    update: pageArchetype === 'settings-console' || hasSettingsField ? 'settingsUpdate' : 'recordUpdate',
    delete: pageArchetype === 'settings-console' || hasSettingsField ? 'archiveDisable' : 'recordDelete',
  };

  if (pageArchetype === 'approval-flow' || domainSignals.hasApproval || hasApprovalField) {
    operationMap.review = 'decisionAction';
  }

  if (pageArchetype === 'evidence-workbench' || domainSignals.hasAttachment || hasAttachmentField) {
    operationMap.attach = 'evidenceIngest';
  }

  if (
    pageArchetype === 'executive-dashboard' ||
    pageArchetype === 'operations-queue' ||
    pageArchetype === 'review-queue' ||
    pageArchetype === 'settings-console' ||
    domainSignals.hasAuditTrail ||
    hasApprovalField ||
    hasAttachmentField
  ) {
    operationMap.audit = 'timelineRead';
  }

  if (
    pageArchetype === 'operations-queue' ||
    pageArchetype === 'review-queue' ||
    domainSignals.hasPriority ||
    hasPriorityField
  ) {
    operationMap.prioritize = 'prioritySort';
  }

  if (hasStatusField || domainSignals.hasApproval || hasApprovalField || hasPriorityField) {
    operationMap.status = 'statusTransition';
  }

  return operationMap;
}

export function buildProductSpec({ project = null, technicalSpec = {}, domainTemplate = null, task = null } = {}) {
  const fields = (technicalSpec.domain?.fields || []).map(normalizeField);
  const entityName = deriveEntityName(technicalSpec);
  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    domainTemplate?.productMode ||
    'structured-workspace';
  const uiIntent =
    technicalSpec.structured?.classification?.intent ||
    technicalSpec.uiIntent ||
    'custom';
  const archetype = resolveUiArchetype({ technicalSpec, task, screenTemplate, productMode, uiIntent });

  return {
    version: 1,
    projectTemplateKey:
      technicalSpec.projectTemplateKey ||
      project?.templateKey ||
      project?.intakeConfig?.projectTemplateKey ||
      null,
    productName: project?.name || technicalSpec.projectName || entityName,
    positioning: project?.vision || technicalSpec.summary || project?.description || '',
    domain: domainTemplate?.templateKey || technicalSpec.featureKey || 'custom-domain',
    personas: uniqueList([
      technicalSpec.ux?.permissions?.actor,
      technicalSpec.ux?.permissions?.owner,
      technicalSpec.ux?.permissions?.reviewer,
    ]),
    entities: [
      {
        name: entityName,
        fields,
      },
    ],
    capabilities: uniqueList([
      technicalSpec.featureKey,
      screenTemplate,
      uiIntent,
      archetype.pageArchetype,
      ...buildPatternHints(archetype),
    ]),
    archetype: {
      pageArchetype: archetype.pageArchetype,
      fallbackPattern: archetype.fallbackPattern,
      confidenceScore: archetype.confidenceScore,
      alternativeArchetypes: archetype.alternativeArchetypes,
      domainSignals: archetype.domainSignals,
    },
    journeys: [
      {
        taskTitle: task?.title || technicalSpec.featureName || entityName,
        route: technicalSpec.frontend?.suggestedRoute || null,
        screenTemplate,
        productMode,
        uiIntent,
        pageArchetype: archetype.pageArchetype,
        archetypeConfidence: archetype.confidenceScore,
      },
    ],
    permissions: technicalSpec.ux?.permissions || {},
    nonFunctionalRequirements: uniqueList([
      'typed-contracts',
      'schema-validation',
      'generated-tests',
      'runtime-observability',
    ]),
  };
}

export function buildFrontendScreenSpec({ technicalSpec = {}, task = null, domainTemplate = null } = {}) {
  const fields = (technicalSpec.domain?.fields || []).map(normalizeField);
  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    domainTemplate?.productMode ||
    'structured-workspace';
  const uiIntent =
    technicalSpec.structured?.classification?.intent ||
    technicalSpec.uiIntent ||
    'custom';
  const archetype = resolveUiArchetype({ technicalSpec, task, screenTemplate, productMode, uiIntent });

  const sectionsByTemplate = {
    settings: ['hero', 'form', 'summary', 'activity'],
    dashboard: ['hero', 'metrics', 'filters', 'records'],
    workspace: ['hero', 'queue', 'form', 'records'],
    wizard: ['hero', 'steps', 'form', 'summary'],
    crud: ['hero', 'filters', 'list', 'form'],
  };
  const sections = archetype.recommendedSections || sectionsByTemplate[screenTemplate] || sectionsByTemplate.crud;

  return {
    version: 1,
    route: technicalSpec.frontend?.suggestedRoute || null,
    navigationLabel: technicalSpec.frontend?.navigationLabel || task?.title || deriveEntityName(technicalSpec),
    pageTitle: technicalSpec.frontend?.pageTitle || task?.title || deriveEntityName(technicalSpec),
    screenTemplate,
    productMode,
    uiIntent,
    pageArchetype: archetype.pageArchetype,
    fallbackPattern: archetype.fallbackPattern,
    confidenceScore: archetype.confidenceScore,
    alternativeArchetypes: archetype.alternativeArchetypes,
    domainSignals: archetype.domainSignals,
    layoutVariant: technicalSpec.frontend?.layoutVariant || technicalSpec.structured?.classification?.layoutVariant || null,
    sections,
    componentMap: buildFrontendComponentMap({
      pageArchetype: archetype.pageArchetype,
      sections,
    }),
    dataSources: uniqueList([
      technicalSpec.backend?.routeBase,
      technicalSpec.shared?.listContractName,
      technicalSpec.shared?.responseContractName,
    ]),
    fields: fields.map((field) => ({
      name: field.name,
      label: field.label,
      inputType: field.inputType,
      required: field.required,
    })),
    states: uniqueList([
      'loading',
      'empty',
      'error',
      'success',
      ...(technicalSpec.ux?.states ? Object.keys(technicalSpec.ux.states) : []),
    ]),
    patternHints: buildPatternHints(archetype),
  };
}

export function buildFrontendDataSpec({ technicalSpec = {} } = {}) {
  const routeBase = technicalSpec.backend?.routeBase || '/api/v1/items';
  const entityName = deriveEntityName(technicalSpec);

  return {
    queryClient: 'tanstack-query',
    queries: [
      {
        key: [`${entityName.toLowerCase()}-list`],
        method: 'GET',
        path: routeBase,
        purpose: 'list',
      },
    ],
    mutations: [
      {
        key: `${entityName.toLowerCase()}-create`,
        method: 'POST',
        path: routeBase,
        purpose: 'create',
      },
    ],
    formLibrary: 'react-hook-form',
    schemaLibrary: 'zod',
  };
}

export function buildBackendModuleSpec({ technicalSpec = {}, task = null } = {}) {
  const entityName = deriveEntityName(technicalSpec);
  const routeBase = technicalSpec.backend?.routeBase || `/api/v1/${entityName.toLowerCase()}s`;
  const fields = (technicalSpec.domain?.fields || []).map(normalizeField);
  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    'structured-workspace';
  const uiIntent =
    technicalSpec.structured?.classification?.intent ||
    technicalSpec.uiIntent ||
    'custom';
  const archetype = resolveUiArchetype({ technicalSpec, task, screenTemplate, productMode, uiIntent });
  const operationMap = buildBackendOperationMap({
    pageArchetype: archetype.pageArchetype,
    domainSignals: archetype.domainSignals,
    fields,
  });

  return {
    version: 1,
    entityName,
    routeBase,
    moduleName: technicalSpec.featureKey || entityName.toLowerCase(),
    files: [
      'router.ts',
      'controller.ts',
      'service.ts',
      'repository.ts',
      'schema.ts',
      'mapper.ts',
      'seed.ts',
      `${entityName.toLowerCase()}.test.ts`,
    ],
    contracts: {
      request: technicalSpec.shared?.requestContractName || `${entityName}Request`,
      response: technicalSpec.shared?.responseContractName || `${entityName}Response`,
      list: technicalSpec.shared?.listContractName || `${entityName}ListResponse`,
    },
    pageArchetype: archetype.pageArchetype,
    domainSignals: archetype.domainSignals,
    validationLibrary: 'zod',
    testLibrary: 'vitest-supertest',
    logger: 'pino',
    operationMap,
    operations: uniqueList(['list', 'detail', 'create', 'update', 'delete', ...Object.keys(operationMap)]),
    fields: fields.map((field) => ({
      name: field.name,
      required: field.required,
      inputType: field.inputType,
    })),
    taskTitle: task?.title || null,
  };
}

export function createGenerationIR({ project = null, technicalSpec = {}, domainTemplate = null, task = null } = {}) {
  const productSpec = buildProductSpec({ project, technicalSpec, domainTemplate, task });
  const frontend = {
    screenSpec: buildFrontendScreenSpec({ technicalSpec, task, domainTemplate }),
    dataSpec: buildFrontendDataSpec({ technicalSpec }),
    componentPattern: 'react-typescript-vite',
  };
  const backend = {
    moduleSpec: buildBackendModuleSpec({ technicalSpec, task }),
    apiStyle: 'express-typescript-prisma',
  };

  return {
    version: 1,
    productSpec,
    frontend,
    backend,
  };
}

export function validateGenerationIR(generationIR = {}) {
  const issues = [];
  const screenSpec = generationIR?.frontend?.screenSpec || {};
  const moduleSpec = generationIR?.backend?.moduleSpec || {};

  if (!generationIR?.version) issues.push('generationIR sem version.');
  if (!generationIR?.productSpec?.productName) issues.push('productSpec sem productName.');
  if (!screenSpec.route) issues.push('frontend.screenSpec sem route.');
  if (!screenSpec.screenTemplate) issues.push('frontend.screenSpec sem screenTemplate.');
  if (!Array.isArray(screenSpec.sections) || !screenSpec.sections.length) {
    issues.push('frontend.screenSpec sem sections.');
  }
  if (!moduleSpec.routeBase) issues.push('backend.moduleSpec sem routeBase.');
  if (!Array.isArray(moduleSpec.files) || !moduleSpec.files.length) {
    issues.push('backend.moduleSpec sem files.');
  }
  if (!moduleSpec.operationMap || !Object.keys(moduleSpec.operationMap).length) {
    issues.push('backend.moduleSpec sem operationMap.');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
