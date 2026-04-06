const GENERIC_SETTINGS_SUMMARY = [
  'Estado atual visivel sem depender de historico tecnico.',
  'Ajustes organizados para reduzir duvida e retrabalho.',
  'Confirmacao clara do que esta ativo nesta area.',
];

const GENERIC_WORKSPACE_SUMMARY = [
  'Fila viva com contexto suficiente para decidir rapido.',
  'Itens mais importantes sempre em destaque.',
  'Leitura pensada para triagem e acompanhamento.',
];

const GENERIC_INTERFACE_LIBRARY = {
  settings: {
    sectionLabels: ['Resumo atual', 'Boas praticas', 'Estado da configuracao'],
    ctaLabels: ['Salvar ajustes', 'Atualizar configuracao', 'Confirmar preferencias'],
    emptyStates: [
      'Nenhum ajuste registrado ainda.',
      'Defina a configuracao principal para ativar esta area.',
    ],
    reviewSignals: ['evitar tabela generica', 'destacar estado atual', 'copy de autosservico'],
  },
  workspace: {
    sectionLabels: ['Fila ativa', 'Contexto do caso', 'Proximas acoes'],
    ctaLabels: ['Registrar item', 'Salvar contexto', 'Adicionar ao caso'],
    emptyStates: [
      'Nenhum item ativo ainda.',
      'Assim que o primeiro registro entrar, ele aparecera aqui com contexto e proxima acao.',
    ],
    reviewSignals: ['contexto vivo do caso', 'lista com funcao clara', 'acao principal evidente'],
  },
  dashboard: {
    sectionLabels: ['Leitura executiva', 'Recortes principais', 'Alertas e desvios'],
    ctaLabels: ['Atualizar indicadores', 'Explorar recortes', 'Abrir painel'],
    emptyStates: [
      'Nenhum indicador consolidado ainda.',
      'Os primeiros dados desta area aparecerao aqui assim que a operacao ganhar volume.',
    ],
    reviewSignals: ['menos formulario, mais leitura', 'desvio em destaque', 'indicadores com hierarquia'],
  },
};

export function resolveInterfaceExamples(domainKey, productMode = 'structured-workspace', screenTemplate = 'crud') {
  const byDomain = {
    'access-control-roles': {
      settingsSummaryItems: [
        'Perfis com escopo claro para cada papel da operacao.',
        'Permissoes agrupadas por funcao, nao por detalhe tecnico solto.',
        'Governanca visivel para facilitar revisao futura.',
      ],
      summaryStateTitle: 'Pronto para revisar',
      summaryStateEmpty: 'Nenhum perfil configurado. Comece pelo perfil que mais impacta a operacao.',
      summaryMetaIdle: 'Pronto para revisar',
      summaryMetaReady: 'Perfis ativos',
      seedRequests: [
        {
          roleName: 'solicitante',
          permissionMatrix: 'Abrir chamados; acompanhar status; anexar comprovantes',
          accessScope: 'self_service',
        },
        {
          roleName: 'analista',
          permissionMatrix: 'Atender chamados; comentar; reclassificar prioridade',
          accessScope: 'team',
        },
        {
          roleName: 'gestor',
          permissionMatrix: 'Acompanhar indicadores; revisar carga da equipe; reatribuir chamados',
          accessScope: 'global',
        },
      ],
      promptExamples: [
        'Painel de governanca com foco em perfis, cobertura e escopo.',
        'Resumo lateral com politicas ativas e proxima revisao sugerida.',
      ],
      sectionLabels: ['Resumo dos acessos', 'Perfis configurados', 'Politicas em vigor'],
      ctaLabels: ['Salvar perfil', 'Atualizar perfil', 'Aplicar acesso'],
      emptyStates: [
        'Nenhum perfil configurado. Comece pelo papel que mais impacta a operacao.',
        'Assim que um perfil for criado, ele aparecera com escopo e permissoes principais.',
      ],
      reviewSignals: ['evitar siglas internas', 'destacar alcance do perfil', 'foco em governanca de produto'],
    },
    'ticket-notification-preferences': {
      settingsSummaryItems: [
        'O colaborador entende rapidamente se esta sendo avisado ou nao.',
        'A configuracao destaca o e-mail principal e o estado dos alertas.',
        'A tela explica o beneficio do ajuste sem soar tecnica.',
      ],
      summaryStateTitle: 'Preferencias em foco',
      summaryStateEmpty: 'Nenhuma preferencia ativa. Defina o e-mail principal para receber avisos importantes.',
      summaryMetaIdle: 'Ajuste recomendado',
      summaryMetaReady: 'Preferencias ativas',
      seedRequests: [
        {
          notificationEmail: 'comercial@empresa.com',
          ticketUpdateAlerts: 'enabled',
        },
        {
          notificationEmail: 'lider.comercial@empresa.com',
          ticketUpdateAlerts: 'disabled',
        },
      ],
      promptExamples: [
        'Tela de autosservico com estado atual e confirmacao clara.',
        'Ajuste simples, sem tabela e sem linguagem operacional.',
      ],
      sectionLabels: ['Resumo atual', 'Preferencias ativas', 'Como funciona'],
      ctaLabels: ['Salvar preferencias', 'Atualizar alertas', 'Confirmar notificacoes'],
      emptyStates: [
        'Nenhuma preferencia ativa. Defina o e-mail principal para receber avisos importantes.',
        'Assim que os alertas forem ativados, o estado atual aparecera aqui.',
      ],
      reviewSignals: ['tom de autosservico', 'estado atual visivel', 'evitar jargao tecnico'],
    },
    'support-ticket-attachments': {
      settingsSummaryItems: [
        'Documentos relevantes aparecem com tipo, contexto e momento do envio.',
        'A triagem ganha velocidade quando o anexo ja nasce bem descrito.',
        'A lista deve parecer um acervo de comprovantes do caso, nao um CRUD generico.',
      ],
      summaryStateTitle: 'Envio pronto para triagem',
      summaryStateEmpty: 'Nenhum documento anexado ainda. Adicione o primeiro comprovante para acelerar a analise.',
      summaryMetaIdle: 'Aguardando primeiro envio',
      summaryMetaReady: 'Caso com anexos',
      seedRequests: [
        {
          documentType: 'nota_fiscal',
          documentDescription: 'Nota fiscal referente ao servico contratado para o chamado financeiro.',
          fileUrl: 'https://arquivos.empresa.com/documentos/nota-fiscal-4821.pdf',
        },
        {
          documentType: 'comprovante',
          documentDescription: 'Comprovante de pagamento usado para validar a solicitacao do colaborador.',
          fileUrl: 'https://arquivos.empresa.com/documentos/comprovante-pagamento-abril.pdf',
        },
        {
          documentType: 'contrato',
          documentDescription: 'Contrato enviado para contextualizar a origem da cobranca questionada.',
          fileUrl: 'https://arquivos.empresa.com/documentos/contrato-suporte.pdf',
        },
      ],
      promptExamples: [
        'Bancada de caso com foco em envio, contexto e acervo de comprovantes.',
        'Estado vazio ensina o que anexar e por que isso acelera o atendimento.',
      ],
      sectionLabels: ['Contexto do envio', 'Acervo do caso', 'Documentos recentes'],
      ctaLabels: ['Anexar documento', 'Registrar comprovante', 'Adicionar ao caso'],
      emptyStates: [
        'Nenhum documento anexado ainda. Adicione o primeiro comprovante para acelerar a analise.',
        'Os arquivos do caso aparecerao aqui com tipo e contexto para consulta rapida.',
      ],
      reviewSignals: ['acervo em vez de CRUD', 'contexto do caso', 'triagem mais clara'],
    },
    'support-performance-dashboard': {
      settingsSummaryItems: [
        'O gestor entende em poucos segundos onde a fila cresceu.',
        'Categoria e status aparecem como leitura de decisao, nao como tabela burocratica.',
        'O painel destaca onde agir primeiro para aliviar o atendimento.',
      ],
      summaryStateTitle: 'Leitura pronta para decisao',
      summaryStateEmpty: 'Nenhum indicador consolidado ainda. Ajuste os filtros para iniciar a leitura gerencial.',
      summaryMetaIdle: 'Aguardando dados',
      summaryMetaReady: 'Indicadores atualizados',
      seedRequests: [
        {
          categoryFilter: 'financeiro',
          statusFilter: 'aberto',
          timeRange: 'ultimos_7_dias',
        },
        {
          categoryFilter: 'acesso',
          statusFilter: 'em_atendimento',
          timeRange: 'mes_atual',
        },
        {
          categoryFilter: 'geral',
          statusFilter: 'resolvido',
          timeRange: 'ultimos_30_dias',
        },
      ],
      promptExamples: [
        'Cockpit de operacoes com foco em volume por categoria e status.',
        'Leitura executiva com recortes, desvios e prioridade de acao.',
      ],
      sectionLabels: ['Leitura executiva', 'Recortes principais', 'Alertas e desvios'],
      ctaLabels: ['Atualizar painel', 'Aplicar filtros', 'Comparar recortes'],
      emptyStates: [
        'Nenhum indicador consolidado ainda para os filtros atuais.',
        'Assim que houver volume suficiente, os principais recortes aparecerao aqui.',
      ],
      reviewSignals: ['menos formulario, mais leitura', 'decisao do gestor em destaque', 'recortes comparativos claros'],
    },
  };

  const genericByScreen = {
    settings: {
      settingsSummaryItems: GENERIC_SETTINGS_SUMMARY,
      summaryStateTitle: 'Configuracao em andamento',
      summaryStateEmpty: 'Nenhum ajuste registrado ainda.',
      summaryMetaIdle: 'Pronto para ajustar',
      summaryMetaReady: 'Ativo',
      seedRequests: [],
      promptExamples: ['Tela de configuracao clara, objetiva e sem cara de CRUD.'],
      ...GENERIC_INTERFACE_LIBRARY.settings,
    },
    workspace: {
      settingsSummaryItems: GENERIC_WORKSPACE_SUMMARY,
      summaryStateTitle: 'Fila pronta para uso',
      summaryStateEmpty: 'Nenhum item ativo ainda.',
      summaryMetaIdle: 'Aguardando movimentacao',
      summaryMetaReady: 'Em acompanhamento',
      seedRequests: [],
      promptExamples: ['Workspace com fila viva, contexto do caso e proxima acao visivel.'],
      ...GENERIC_INTERFACE_LIBRARY.workspace,
    },
    dashboard: {
      settingsSummaryItems: [
        'Indicadores priorizados para decisao, nao para exibicao burocratica.',
        'Recortes principais organizados para leitura rapida.',
        'Alertas e desvios com protagonismo visual.',
      ],
      summaryStateTitle: 'Leitura executiva',
      summaryStateEmpty: 'Nenhum indicador consolidado ainda.',
      summaryMetaIdle: 'Aguardando dados',
      summaryMetaReady: 'Indicadores atualizados',
      seedRequests: [],
      promptExamples: ['Cockpit gerencial com indicadores, comparacao e foco em decisao.'],
      ...GENERIC_INTERFACE_LIBRARY.dashboard,
    },
  };

  const genericByMode = {
    'self-service-settings': {
      ...genericByScreen.settings,
      promptExamples: [
        'Tela de autosservico enxuta, com foco em confirmar o estado atual antes de editar.',
        'Resumo lateral curto, sem parecer uma tela de administracao tecnica.',
      ],
    },
    'governance-console': {
      ...genericByScreen.settings,
      promptExamples: [
        'Console de governanca com linguagem de produto, sem vazar siglas ou modelos internos.',
        'Resumo orientado a cobertura, alcance e revisao dos perfis ativos.',
      ],
    },
    'evidence-workbench': {
      ...genericByScreen.workspace,
      promptExamples: [
        'Bancada de caso com protagonismo para o envio e para o acervo de documentos.',
        'A lateral deve parecer um contexto vivo do caso, nao uma tabela generica.',
      ],
    },
    'review-workbench': {
      ...genericByScreen.workspace,
      promptExamples: [
        'Mesa de revisao com itens pendentes, proxima acao e contexto decisorio.',
        'A interface deve apoiar triagem, comparacao e fechamento de pendencias.',
      ],
    },
    'manager-cockpit': {
      ...genericByScreen.dashboard,
      promptExamples: [
        'Cockpit executivo com poucos indicadores fortes e leituras comparativas claras.',
        'Destaque primeiro o desvio ou a tendencia que pede decisao do gestor.',
      ],
    },
    'immersive-workspace': {
      ...genericByScreen.workspace,
      promptExamples: [
        'Workspace continuo, com foco em manter contexto, progresso e proxima acao visiveis.',
        'Evite cara de CRUD; a tela deve parecer um ambiente de trabalho.',
      ],
    },
  };

  return {
    ...(genericByScreen[screenTemplate] || {}),
    ...(genericByMode[productMode] || {}),
    ...(byDomain[domainKey] || {}),
  };
}
