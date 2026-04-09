function clampAutonomyLevel(value) {
  return Math.max(1, Math.min(5, value));
}

function resolveExperienceProfile(screenTemplate, intent, productMode) {
  const normalizedTemplate = String(screenTemplate || 'crud').toLowerCase();
  const normalizedIntent = String(intent || 'custom').toLowerCase();
  const normalizedProductMode = String(productMode || '').toLowerCase();

  if (normalizedTemplate === 'settings') {
    return {
      profileKey: 'calm-configurator',
      guidance: [
        'Preferir uma tela mais calma, com coluna unica ou split leve.',
        'Priorizar compreensao da regra antes de ornamentacao visual.',
        'Evitar cockpit, metricas ou cards excessivos.',
      ],
    };
  }

  if (normalizedIntent === 'review' || normalizedIntent === 'view') {
    return {
      profileKey: 'evidence-workbench',
      guidance: [
        'Priorizar consulta, filtros e leitura de historico.',
        'Dar mais destaque para tabela ou lista densa do que para formulario.',
        'Usar contexto curto e operacional, sem hero desnecessario.',
      ],
    };
  }

  if (normalizedIntent === 'attach') {
    return {
      profileKey: 'attachment-workbench',
      guidance: [
        'Equilibrar selecao do contexto principal com vinculacao do item secundario.',
        'Explicitar a relacao entre o item pai e o item anexado.',
        'Privilegiar acao direta e confirmacao clara de vinculo.',
      ],
    };
  }

  if (normalizedTemplate === 'workspace' && normalizedProductMode.includes('operations')) {
    return {
      profileKey: 'operations-tool',
      guidance: [
        'Preferir ferramenta seca e utilitaria a shell ornamental.',
        'Destacar acao principal e leitura rapida dos registros.',
        'Evitar excesso de metricas e narrativa de produto.',
      ],
    };
  }

  return {
    profileKey: 'structured-delivery',
    guidance: [
      'Manter composicao clara, com hierarquia objetiva.',
      'Usar o design system como base sem forcar um shell especifico.',
    ],
  };
}

export function resolveImplementationExecutionMode(task, technicalSpec, implementationManifest = null) {
  const screenTemplate =
    implementationManifest?.classification?.screenTemplate ||
    technicalSpec?.architecture?.screenTemplate ||
    technicalSpec?.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    implementationManifest?.classification?.productMode ||
    technicalSpec?.frontend?.productMode ||
    technicalSpec?.structured?.classification?.productMode ||
    null;
  const intent =
    implementationManifest?.classification?.intent ||
    technicalSpec?.structured?.classification?.intent ||
    'custom';
  let autonomyLevel = 3;
  const reasons = [];

  if (screenTemplate === 'workspace' || screenTemplate === 'dashboard') {
    autonomyLevel += 1;
    reasons.push(`A tela ${screenTemplate} pede composicao mais livre para um executor autonomo.`);
  }

  if (screenTemplate === 'settings') {
    autonomyLevel += 1;
    reasons.push('Configuracao tambem passa pelo agente autonomo para evitar moldes fixos demais.');
  }

  if (String(productMode || '').includes('operations') || String(productMode || '').includes('workbench')) {
    autonomyLevel += 1;
    reasons.push(`O modo de produto ${productMode} exige mais liberdade de composicao e integracao.`);
  }

  if (['custom', 'view', 'review', 'configure'].includes(String(intent || '').toLowerCase())) {
    autonomyLevel += 1;
    reasons.push(`A intencao ${intent} normalmente exige decisao de implementacao mais contextual.`);
  }

  return {
    mode: 'autonomous',
    autonomyLevel: clampAutonomyLevel(autonomyLevel),
    rationale: reasons.length
      ? reasons
      : ['A etapa de implementacao passa a ser executada sempre pelo agente autonomo.'],
    plannerRole: 'implementation_planner',
    executorRole: 'implementation_autonomous_agent',
    reviewerRole: 'implementation_reviewer',
  };
}

export function buildAutonomousImplementationContract(task, technicalSpec, implementationManifest = null) {
  const execution = resolveImplementationExecutionMode(task, technicalSpec, implementationManifest);
  const manifest = implementationManifest || {};
  const experienceProfile = resolveExperienceProfile(
    manifest?.classification?.screenTemplate || technicalSpec?.architecture?.screenTemplate,
    manifest?.classification?.intent || technicalSpec?.structured?.classification?.intent,
    manifest?.classification?.productMode || technicalSpec?.frontend?.productMode
  );

  return {
    version: 1,
    agentKey: execution.executorRole,
    mode: execution.mode,
    autonomyLevel: execution.autonomyLevel,
    frontendControlMode: execution.autonomyLevel >= 4 ? 'freeform' : 'guided',
    rationale: execution.rationale,
    experienceProfile,
    mission: {
      primaryGoal: manifest?.objective?.primaryGoal || technicalSpec?.implementationObjective?.primaryGoal || task?.title,
      userOutcome: manifest?.objective?.userOutcome || technicalSpec?.implementationObjective?.userOutcome || null,
      successDefinition:
        manifest?.objective?.successDefinition ||
        technicalSpec?.implementationObjective?.successDefinition ||
        [],
    },
    sourceContracts: {
      requirementSpec: Boolean(manifest?.upstreamContracts?.requirementSpec),
      testSpec: Boolean(manifest?.upstreamContracts?.testSpec),
      solutionBlueprint: Boolean(technicalSpec?.architecture?.sourceSummary),
      implementationManifest: true,
    },
    freedomWithinBounds: {
      canChooseShell: true,
      canSkipSharedShell: execution.autonomyLevel >= 4,
      canReshapeFrontendComposition: true,
      canRefineFileSplit: true,
      mustPreserveRoutes: true,
      mustPreserveContracts: true,
      mustPassValidation: true,
    },
    outputTargets: {
      shared: manifest?.contracts?.sharedContractPath || technicalSpec?.shared?.contractPath || null,
      frontend: manifest?.frontend?.featurePath || technicalSpec?.frontend?.featurePath || null,
      backend: manifest?.backend?.modulePath || technicalSpec?.backend?.modulePath || null,
      documentation: `docs/implementations/${manifest?.classification?.featureKey || technicalSpec?.featureKey}.md`,
    },
    reviewChecklist: [
      'Conferir aderencia ao Requirement Spec e ao Test Spec.',
      'Conferir coerencia com a shell do projeto e com a familia de UI da feature.',
      'Conferir se frontend, backend e shared foram materializados sem drift de dominio.',
      'Conferir se a feature convive com o projeto existente sem sobrescrever o que ja existe.',
    ],
  };
}
