function normalizeWhitespace(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clampText(value, maxLength = 280) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function toSentences(input) {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function titleCase(value = '') {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function detectActor(input) {
  const normalized = normalizeWhitespace(input);
  const explicitActor = normalized.match(/como\s+([^,.\n]+?)(?:,\s*eu|\s+quero|\s+preciso|[,.]|$)/i);
  if (explicitActor?.[1]) return explicitActor[1].trim();

  const actorByNeed = normalized.match(/(?:para|por)\s+([^,.\n]{3,80})(?:,|\.|\n|$)/i);
  if (actorByNeed?.[1]) return actorByNeed[1].trim();

  if (/\b(cliente|usuario|usuário|time|gestor|admin|administrador|operador|analista|financeiro)\b/i.test(normalized)) {
    const known = normalized.match(/\b(cliente|usuario|usuário|time|gestor|admin|administrador|operador|analista|financeiro)\b/i);
    return known?.[1] || '';
  }

  return '';
}

function detectOutcome(input) {
  const normalized = normalizeWhitespace(input);
  const outcomePatterns = [
    /para\s+([^.!?\n]{8,180})/i,
    /a fim de\s+([^.!?\n]{8,180})/i,
    /com o objetivo de\s+([^.!?\n]{8,180})/i,
    /de modo que\s+([^.!?\n]{8,180})/i,
  ];

  for (const pattern of outcomePatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function detectPrimaryAction(input) {
  const sentences = toSentences(input);
  if (!sentences.length) return '';

  const normalized = sentences[0]
    .replace(/^como\s+[^,]+,\s*/i, '')
    .replace(/^(eu\s+)?(quero|preciso|gostaria|desejo|quero que)\s+/i, '')
    .trim();

  if (normalized) return normalized;

  return sentences[0];
}

function extractExplicitBullets(input) {
  return normalizeWhitespace(input)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim());
}

function detectBusinessRules(input) {
  const rules = [];
  const sentences = toSentences(input);

  for (const sentence of sentences) {
    if (/\b(deve|somente|apenas|nao pode|não pode|obrigatorio|obrigatório|limite|prazo|permiss|perfil|papel|autoriz)\b/i.test(sentence)) {
      rules.push(clampText(sentence, 180));
    }
  }

  const numericConstraints = input.match(/\b\d+\s*(dias?|horas?|minutos?|itens?|campos?|usuarios?|usuários?)\b/gi) || [];
  if (numericConstraints.length) {
    rules.push(`Existem restricoes quantitativas mencionadas: ${uniqueList(numericConstraints).join(', ')}.`);
  }

  return uniqueList(rules).slice(0, 5);
}

function findAmbiguityAlerts(input) {
  const normalized = normalizeWhitespace(input);
  const alerts = [];

  const vagueTerms = [
    'rapido',
    'rápido',
    'simples',
    'intuitivo',
    'moderno',
    'robusto',
    'facil',
    'fácil',
    'melhor',
    'otimizado',
    'eficiente',
    'automatico',
    'automático',
    'dinamico',
    'dinâmico',
  ];

  const foundVagueTerms = vagueTerms.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(normalized));
  for (const term of uniqueList(foundVagueTerms)) {
    alerts.push({
      type: 'vague_term',
      severity: 'medium',
      term,
      message: `O termo "${term}" aparece sem um criterio objetivo.`,
      recommendation: 'Substitua termos vagos por regras verificaveis, limites ou exemplos concretos.',
    });
  }

  if (!detectActor(normalized)) {
    alerts.push({
      type: 'undefined_actor',
      severity: 'high',
      message: 'A entrada nao deixa claro quem inicia ou consome o fluxo.',
      recommendation: 'Informe o ator principal, por exemplo: cliente, gestor, analista ou usuario final.',
    });
  }

  if (!detectOutcome(normalized)) {
    alerts.push({
      type: 'missing_outcome',
      severity: 'high',
      message: 'O objetivo de negocio nao esta explicitado.',
      recommendation: 'Explique o resultado esperado ou o valor de negocio da funcionalidade.',
    });
  }

  if (!/\b(exceto|caso|quando falhar|erro|falha|invalido|inválido|nao permitido|não permitido|sem acesso)\b/i.test(normalized)) {
    alerts.push({
      type: 'missing_exception_flow',
      severity: 'medium',
      message: 'O fluxo nao descreve excecoes, falhas ou validacoes negativas.',
      recommendation: 'Adicione o que deve acontecer quando o usuario errar, nao tiver permissao ou enviar dados invalidos.',
    });
  }

  if (!/\b(deve|nao pode|não pode|somente|apenas|obrigatorio|obrigatório|limite|perfil|papel|permiss)\b/i.test(normalized)) {
    alerts.push({
      type: 'missing_business_rules',
      severity: 'medium',
      message: 'As regras de negocio ainda nao estao claras.',
      recommendation: 'Descreva limites, permissoes, obrigatoriedades e restricoes do fluxo.',
    });
  }

  if (normalized.length < 90) {
    alerts.push({
      type: 'insufficient_context',
      severity: 'high',
      message: 'A descricao esta curta demais para validar requisitos com confianca.',
      recommendation: 'Inclua ator, objetivo, regra principal e o que deve acontecer em sucesso e erro.',
    });
  }

  return alerts;
}

function buildAcceptanceCriteria({ actor, action, outcome, alerts }) {
  const normalizedActor = actor || 'usuario';
  const normalizedAction = action || 'executar a funcionalidade solicitada';
  const normalizedOutcome = outcome || 'atingir o objetivo descrito';

  const criteria = [
    `Dado ${normalizedActor}, quando ${normalizedAction.toLowerCase()}, entao o sistema deve ${normalizedOutcome.toLowerCase()}.`,
    `O fluxo deve apresentar validacoes claras para os dados necessarios antes de concluir a acao.`,
    `O sistema deve registrar um resultado observavel para confirmar que a solicitacao foi processada com sucesso.`,
  ];

  if (alerts.some((alert) => alert.type === 'missing_exception_flow')) {
    criteria.push('O comportamento em caso de erro, permissao insuficiente ou dados invalidos deve ser explicitado antes do desenvolvimento.');
  } else {
    criteria.push('Os cenarios de excecao devem retornar mensagens compreensiveis e proximos passos claros para o usuario.');
  }

  return uniqueList(criteria);
}

function buildTestScenarios({ actor, action, outcome, alerts }) {
  const normalizedActor = actor || 'usuario';
  const normalizedAction = action || 'executa a funcionalidade';
  const normalizedOutcome = outcome || 'o objetivo esperado';

  const scenarios = [
    `Cenario feliz: ${titleCase(normalizedActor)} ${normalizedAction.toLowerCase()} e obtém ${normalizedOutcome.toLowerCase()}.`,
    `Validacao: o sistema bloqueia dados obrigatorios ausentes e orienta a correcao antes de prosseguir.`,
  ];

  if (alerts.some((alert) => alert.type === 'undefined_actor')) {
    scenarios.push('Refino necessario: validar qual perfil de usuario pode iniciar o fluxo.');
  } else {
    scenarios.push(`Permissao: confirmar se ${normalizedActor.toLowerCase()} tem acesso ao fluxo e ao resultado esperado.`);
  }

  if (alerts.some((alert) => alert.type === 'missing_exception_flow')) {
    scenarios.push('Excecao: definir o comportamento quando a operacao falhar ou quando houver dados invalidos.');
  } else {
    scenarios.push('Excecao: validar o retorno do sistema quando ocorrer falha operacional ou regra de negocio nao atendida.');
  }

  return uniqueList(scenarios);
}

function buildUserStory({ actor, action, outcome }) {
  const normalizedActor = actor || 'time de produto';
  const normalizedAction = action || 'validar a necessidade descrita';
  const normalizedOutcome = outcome || 'reduzir ambiguidade antes do desenvolvimento';
  return `Como ${normalizedActor}, eu quero ${normalizedAction} para ${normalizedOutcome}.`;
}

function scoreDimension(baseScore, penalties = []) {
  const penalty = penalties.reduce((total, value) => total + value, 0);
  return Math.max(0, Math.min(100, baseScore - penalty));
}

function computeScores(input, alerts) {
  const normalized = normalizeWhitespace(input);
  const alertTypes = alerts.map((alert) => alert.type);

  const clarity = scoreDimension(92, [
    alertTypes.includes('vague_term') ? 18 : 0,
    alertTypes.includes('undefined_actor') ? 22 : 0,
    normalized.length < 140 ? 12 : 0,
  ]);

  const completeness = scoreDimension(90, [
    alertTypes.includes('missing_outcome') ? 24 : 0,
    alertTypes.includes('missing_business_rules') ? 18 : 0,
    alertTypes.includes('insufficient_context') ? 22 : 0,
  ]);

  const testability = scoreDimension(88, [
    alertTypes.includes('missing_exception_flow') ? 20 : 0,
    alertTypes.includes('missing_business_rules') ? 14 : 0,
    alertTypes.includes('vague_term') ? 10 : 0,
  ]);

  const ambiguity = Math.max(
    0,
    Math.min(
      100,
      alerts.reduce((total, alert) => total + (alert.severity === 'high' ? 22 : 12), 0)
    )
  );

  const overall = Math.round((clarity + completeness + testability + (100 - ambiguity)) / 4);

  return {
    overall,
    clarity,
    completeness,
    testability,
    ambiguity,
  };
}

export function analyzeAlignmentInput(rawInput = '') {
  const input = normalizeWhitespace(rawInput);

  if (!input) {
    throw new Error('A descricao da ideia ou da feature e obrigatoria.');
  }

  const actor = detectActor(input);
  const action = detectPrimaryAction(input);
  const outcome = detectOutcome(input);
  const explicitBullets = extractExplicitBullets(input);
  const ambiguityAlerts = findAmbiguityAlerts(input);
  const businessRules = uniqueList([
    ...detectBusinessRules(input),
    ...explicitBullets.filter((item) => /\b(deve|nao pode|não pode|somente|apenas|obrigatorio|obrigatório)\b/i.test(item)),
  ]).slice(0, 6);

  const acceptanceCriteria = uniqueList([
    ...explicitBullets.slice(0, 3),
    ...buildAcceptanceCriteria({ actor, action, outcome, alerts: ambiguityAlerts }),
  ]).slice(0, 6);

  const testScenarios = buildTestScenarios({ actor, action, outcome, alerts: ambiguityAlerts }).slice(0, 5);
  const clarityScore = computeScores(input, ambiguityAlerts);

  return {
    input_summary: clampText(input, 220),
    user_story: buildUserStory({ actor, action, outcome }),
    acceptance_criteria: acceptanceCriteria,
    business_rules: businessRules.length
      ? businessRules
      : ['Regras de negocio ainda nao foram explicitadas; valide limites, permissoes e obrigatoriedades antes de desenvolver.'],
    test_scenarios: testScenarios,
    clarity_score: clarityScore,
    ambiguity_alerts: ambiguityAlerts,
  };
}

export default {
  analyzeAlignmentInput,
};
