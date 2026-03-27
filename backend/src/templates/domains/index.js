import { DOMAIN_TEMPLATE_CATALOG } from './catalog.js';

export function resolveDomainTemplate(domainKey, fallback = {}) {
  const template = DOMAIN_TEMPLATE_CATALOG[domainKey];

  if (template) {
    return { ...template };
  }

  return {
    templateKey: 'generic/form',
    screenTemplate: 'crud',
    heroEyebrow: fallback.frontend?.navigationLabel || fallback.entityName,
    heroTitle: fallback.frontend?.pageTitle || `Conduza ${fallback.frontend?.navigationLabel || fallback.entityName || 'a operacao'} com mais clareza`,
    heroDescription:
      fallback.frontend?.pageDescription ||
      fallback.summary ||
      'Organize a acao principal desta area em uma experiencia mais clara, confiavel e pronta para uso.',
    formCardTitle: 'Concluir operacao',
    formCardDescription: 'Preencha apenas o essencial para avancar com seguranca e contexto.',
    recordsTitle: 'Atividade recente',
    recordsEmptyState: 'Nenhuma movimentacao registrada ainda nesta area.',
    highlights: [
      'Fluxo desenhado para acelerar a operacao com menos friccao.',
      'Leitura clara do proximo passo e do contexto desta tela.',
      'Estado preparado para acompanhar evolucao e feedback do usuario.',
    ],
    profileSummaryTitle: 'Resumo da feature',
    profileSummaryDescription: fallback.summary,
  };
}

export { DOMAIN_TEMPLATE_CATALOG };
