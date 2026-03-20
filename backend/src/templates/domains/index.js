import { DOMAIN_TEMPLATE_CATALOG } from './catalog.js';

export function resolveDomainTemplate(domainKey, fallback = {}) {
  const template = DOMAIN_TEMPLATE_CATALOG[domainKey];

  if (template) {
    return { ...template };
  }

  return {
    templateKey: 'generic/form',
    heroEyebrow: fallback.frontend?.navigationLabel || fallback.entityName,
    heroTitle: fallback.frontend?.pageTitle || fallback.entityName,
    heroDescription: fallback.frontend?.pageDescription || fallback.summary,
    formCardTitle: 'Preencha os dados',
    formCardDescription: 'Informe os dados necessários para continuar.',
    recordsTitle: 'Últimos registros',
    recordsEmptyState: 'Nenhum registro processado ainda.',
    highlights: [
      'Validação básica aplicada aos campos principais.',
      'Feedback imediato em caso de sucesso ou erro.',
    ],
    profileSummaryTitle: 'Resumo da feature',
    profileSummaryDescription: fallback.summary,
  };
}

export { DOMAIN_TEMPLATE_CATALOG };

