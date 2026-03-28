import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from agents.developer.llm_service import generate_text_from_llm
except Exception as exc:
    print(json.dumps({"success": False, "error": str(exc)}))
    raise SystemExit(1)


def extract_json_block(raw_text: str):
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("LLM retornou vazio.")

    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
      text = fenced.group(1)

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Nao foi encontrado JSON valido na resposta do LLM.")

    return json.loads(text[start:end + 1])


def fallback(payload):
    submit_label = payload.get("submitLabel") or "Salvar"
    navigation_label = payload.get("navigationLabel") or "Operacao"
    page_title = payload.get("pageTitle") or "Conduza esta operacao com clareza"
    page_description = payload.get("pageDescription") or payload.get("summary") or "Centralize a acao principal em uma experiencia mais clara, confiavel e pronta para uso."
    return {
        "navigationLabel": navigation_label,
        "pageTitle": page_title,
        "pageDescription": page_description,
        "heroEyebrow": navigation_label,
        "heroTitle": page_title,
        "heroDescription": page_description,
        "formCardTitle": "Concluir operacao",
        "formCardDescription": "Preencha as informacoes essenciais para concluir esta etapa com seguranca e contexto.",
        "submitLabel": submit_label,
        "highlights": [
            "Fluxo desenhado para reduzir duvidas e acelerar a conclusao.",
            "Leitura clara do que precisa ser feito agora.",
            "Feedback visivel para acompanhar a operacao sem friccao.",
        ],
        "recordsTitle": "Atividade recente",
        "recordsEmptyState": "Nenhuma movimentacao registrada ainda nesta area.",
    }


def main():
    payload = json.load(sys.stdin)
    has_repair_context = bool(payload.get("repairGoals"))
    bypass_cache = bool(payload.get("bypassCache"))
    output_budget = 280 if has_repair_context else 420

    prompt = f"""
Voce e um especialista em UX writing e product design para interfaces SaaS premium.
Sua tarefa e gerar apenas uma proposta curta de copy e estrutura visual para UMA tela de produto.
Voce esta trabalhando em um gerador de interfaces reais, nao em um mock conceitual.

Contexto da implementacao:
- Titulo da task: {payload.get('taskTitle')}
- Resumo: {payload.get('summary')}
- Valor para o usuario: {payload.get('userValue')}
- Rota frontend: {payload.get('frontendRoute')}
- Template de tela: {payload.get('screenTemplate')}
- Product mode: {payload.get('productMode')}
- Direcao funcional: {json.dumps(payload.get('productDirection', {}), ensure_ascii=False)}
- Papel da tela: {payload.get('uiRole')}
- Ator principal: {payload.get('actorLabel')}
- Acao principal: {payload.get('submitLabel')}
- Campos: {json.dumps(payload.get('fields', []), ensure_ascii=False)}
- Estados de UI: {json.dumps(payload.get('uiStates', {}), ensure_ascii=False)}
- Referencias de design: {json.dumps(payload.get('designReference', {}), ensure_ascii=False)}
- Objetivos de reparo: {json.dumps(payload.get('repairGoals', {}), ensure_ascii=False)}

Instrucoes:
- Trate esta tela como parte de um produto maduro, com clareza de hierarquia e sensacao de software pronto.
- Prefira linguagem e estrutura de sistema profissional enterprise, com cara de painel operacional.
- Nao replique requisitos longos, QA, criterios de aceite, documentacao, regras internas, passos tecnicos ou linguagem de governanca na tela.
- Escreva como uma interface real de produto, curta e objetiva.
- Mantenha linguagem em portugues do Brasil.
- Priorize titulos curtos, orientados a usuario final.
- Evite tom tecnico, burocratico ou academico.
- Proponha uma tela com cara de produto pronto, nao de prototipo.
- Defina um papel claro para a tela: operacao, configuracao, descoberta, acompanhamento ou cadastro orientado a valor.
- O `productMode` define que tipo de produto esta tela quer ser. Use esse modo como prioridade maior que o layout.
- A `Direcao funcional` descreve a sensacao que a tela deve transmitir. Ela deve influenciar hierarquia, ritmo, densidade e linguagem.
- Interprete alguns modos assim:
  - `governance-console`: controle, seguranca, matriz, governanca, decisao cuidadosa
  - `self-service-settings`: autonomia, ajustes pessoais, clareza, baixo atrito
  - `evidence-workbench`: triagem, comprovantes, contexto do caso, apoio ao atendimento
  - `manager-cockpit`: leitura executiva, indicadores, comparacao, foco em decisao
  - `review-workbench`: revisar, aprovar, ajustar, acompanhar itens em fila
  - `onboarding-flow`: progresso, preparo, proximo passo, orientacao
  - `structured-workspace`: mesa de trabalho, operacao guiada, visao clara do que fazer
  - `asset-library`: acervo, materiais, organizacao, reuso
  - `catalog-builder`: montagem de oferta, estrutura comercial, composicao
  - `curriculum-designer`: montagem de estrutura, sequencia, organizacao pedagógica
  - `commercial-settings`: configuracao comercial, impacto no negocio, controle de valor
  - `access-gateway`: entrada, autenticacao, seguranca e confianca
  - `immersive-workspace`: foco em execucao ou consumo principal, menos painel e mais fluxo central
- O titulo principal deve comunicar valor ou tarefa principal, nunca soar como placeholder.
- A descricao deve caber em uma leitura rapida e explicar o ganho para o usuario.
- O card de formulario deve parecer uma acao importante, nao apenas um formulario generico.
- O bloco lateral/lista deve parecer uma area viva do produto, com nome e estado vazio consistentes.
- Use a direcao funcional para escolher melhor a cara do produto:
  - `tone`: define a atmosfera principal da tela
  - `density`: indica se a tela deve ser mais enxuta ou mais operacional
  - `primarySurface`: qual bloco merece mais peso visual
  - `secondarySurface`: qual bloco complementa a experiencia
  - `listArchetype`: que tipo de area viva essa tela deve lembrar
- A direcao funcional tambem informa:
  - `spatialModel`: como a tela deve se organizar no espaco
  - `heroStyle`: o tipo de abertura visual mais coerente
  - `panelRelationship`: qual area lidera a leitura e qual area apoia
- Pense primeiro em composicao de produto e so depois em campos.
- Decida explicitamente:
  - qual bloco lidera a atencao
  - qual bloco e complementar
  - se a tela parece cockpit, bancada, biblioteca, portal, configuracao ou jornada
- O bloco vivo nao precisa ser sempre uma lista generica. Ele pode parecer fila, acervo, painel, carteira, mesa de caso ou trilha de proximos passos.
- Se o template for `settings`, use copy de configuracao/autogestao.
- Se o template for `settings`, nao proponha tabela, historico operacional, busca, contador de registros, nomes de secao como "historico" ou metricas tecnicas; prefira resumo do estado atual, orientacao e feedback da configuracao.
- Se o template for `wizard`, use copy de etapas, preparo, sequencia e proximo passo; evite historico, busca, grade de registros e linguagem de monitoramento.
- Se o template for `dashboard`, use copy orientada a visao geral, indicadores, acompanhamento e leitura executiva; evite formulario com cara de cadastro principal.
- Se o template for `workspace`, use copy de fila operacional, acompanhamento, decisao rapida e produtividade; prefira nomes como fila, itens ativos, carteira, visao operacional ou chamados em andamento.
- Se o template for `crud`, use copy de cadastro/listagem com valor percebido, sem parecer documentacao nem painel tecnico.
- Quando houver `listArchetype`, reflita isso na escolha dos nomes de secoes e estados vazios. Ex.: `policies`, `evidence`, `review-queue`, `library`, `curriculum`, `insights`.
- Quando a tela tiver lista, pense em termos de operacao: busca, monitoramento, historico, fila, registros, acompanhamento.
- Nao deixe o tipo de tela vazar para outra familia visual: settings nao pode parecer CRUD; dashboard nao pode parecer configuracao; wizard nao pode parecer historico; workspace nao pode parecer formulario generico.
- Nao deixe o `productMode` perder personalidade. Duas telas com layouts parecidos ainda devem parecer produtos diferentes se o modo funcional for diferente.
- Evite repetir a mesma estetica entre telas de product modes diferentes. Mude o peso visual, o nome das secoes, o tipo de metricas e a sensacao de uso.
- Prefira textos que transmitam clareza, confianca e valor percebido.
- Os highlights devem parecer beneficios reais da experiencia, nunca instrucoes internas do sistema.
- Se houver memoria do projeto, reaproveite os padroes bem avaliados e evite repetir achados recorrentes.
- Se houver referencias de design, prefira os padroes de mesmo dominio e template antes de inventar uma abordagem nova.
- Se houver objetivos de reparo, use-os apenas para evitar repetir problemas de copy ou hierarquia.
- Nao use na interface palavras como: criterio de aceite, requisito, regra de negocio, QA, validacao tecnica, arquitetura, rastreabilidade, permissao por perfil, passos da implementacao.
- Evite expor termos de modelo interno ou jargao tecnico ao usuario final, como: RBAC, auditavel, self_service, team, global, enabled, disabled, matriz de permissao, validacao fiscal imediata, prioridade alta fixa.
- Quando houver enums ou estados internos, traduza-os para linguagem de produto em portugues do Brasil.
- Prefira beneficios percebidos e instrucoes claras; evite frases que parecam politica interna, auditoria ou operacao de bastidor.
- Evite qualquer um destes sinais de interface fraca:
  - titulo generico como "Execute esta jornada" ou "Preencha os dados"
  - descricoes vagas sem valor percebido
  - highlights que so repetem validacao, sucesso ou erro
  - nomes de lista como "Ultimos registros" quando houver nome melhor para o dominio
  - estados vazios frios ou burocraticos
- Se o dominio for pouco especifico, ainda assim escolha uma linguagem mais forte e comercialmente madura.
- O mesmo layout base pode produzir produtos diferentes. Diferencie a tela pelo papel, pela hierarquia e pelo tom dos nomes de secao.
- Nao reutilize automaticamente hero, metricas e painel lateral padrao. Escolha uma composicao mais especifica para o product mode.
- Para `governance-console`, prefira matriz, politicas, controles e leitura de risco; evite aparência de CRUD comum.
- Para `self-service-settings`, prefira estado atual, ajustes claros, orientacao e confirmacao; evite grade operacional ou historico burocratico.
- Para `evidence-workbench`, prefira bancada de caso, acervo de comprovantes, dropzone conceitual e contexto do atendimento; evite formulario seco com lista generica.
- Para `manager-cockpit`, destaque indicadores, recortes, alertas e leitura executiva; evite painel lateral irrelevante ou formulario protagonista.
- Para `review-workbench`, pense em fila, decisão, prioridade e contexto do item; evite composição de cadastro/listagem tradicional.
- Se dois modos funcionais diferentes sairem com a mesma composicao base, reescreva a proposta até que a diferenca fique perceptivel.
- Retorne APENAS JSON valido, sem markdown.

Formato:
{{
  "navigationLabel": "string curta",
  "pageTitle": "titulo curto da tela",
  "pageDescription": "descricao curta",
  "heroEyebrow": "selo curto",
  "heroTitle": "titulo do bloco principal",
  "heroDescription": "texto curto explicativo",
  "formCardTitle": "titulo do card do formulario",
  "formCardDescription": "descricao curta do card",
  "submitLabel": "CTA principal",
  "highlights": ["bullet curto 1", "bullet curto 2"],
  "recordsTitle": "titulo da lista lateral",
  "recordsEmptyState": "mensagem curta de vazio"
}}
    """

    try:
        raw = generate_text_from_llm(
            prompt,
            options_override={
                "temperature": 0.2,
                "num_predict": output_budget,
            },
            use_cache=not bypass_cache,
        )
        data = extract_json_block(raw)
        print(json.dumps({"success": True, "data": data}, ensure_ascii=False))
    except Exception:
        print(json.dumps({"success": True, "data": fallback(payload)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
