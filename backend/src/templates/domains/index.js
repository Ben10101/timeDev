import { DOMAIN_TEMPLATE_CATALOG } from './catalog.js';
import { resolveInterfaceExamples } from './interfaceExamples.js';

export function resolveDomainTemplate(domainKey, fallback = {}) {
  const template = DOMAIN_TEMPLATE_CATALOG[domainKey];
  const exampleData = resolveInterfaceExamples(
    domainKey,
    template?.productMode || fallback.frontend?.productMode || 'structured-workspace',
    template?.screenTemplate || fallback.frontend?.screenTemplate || 'crud'
  );

  if (template) {
    return { ...template, ...exampleData };
  }

  return {
    templateKey: 'generic/form',
    screenTemplate: 'crud',
    productMode: 'structured-workspace',
    heroEyebrow: fallback.frontend?.navigationLabel || fallback.entityName,
    heroTitle: fallback.frontend?.pageTitle || `Conduza ${fallback.frontend?.navigationLabel || fallback.entityName || 'a opera??o'} com mais clareza`,
    heroDescription:
      fallback.frontend?.pageDescription ||
      fallback.summary ||
      'Organize a acao principal desta area em uma experi?ncia mais clara, confiavel e pronta para uso.',
    formCardTitle: 'Concluir opera??o',
    formCardDescription: 'Preencha apenas o essencial para avan?ar com seguran?a e contexto.',
    recordsTitle: 'Atividade recente',
    recordsEmptyState: 'Nenhuma movimentacao registrada ainda nesta area.',
    highlights: [
      'Fluxo desenhado para acelerar a opera??o com menos fric??o.',
      'Leitura clara do pr?ximo passo e do contexto desta tela.',
      'Estado preparado para acompanhar evolucao e feedback do usuario.',
    ],
    profileSummaryTitle: 'Resumo da feature',
    profileSummaryDescription: fallback.summary,
    ...exampleData,
  };
}

export { DOMAIN_TEMPLATE_CATALOG };
