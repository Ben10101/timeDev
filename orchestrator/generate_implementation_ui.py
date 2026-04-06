import json
import os
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
    summary = payload.get("summary") or "Centralize a acao principal em uma experiencia mais clara, confiavel e pronta para uso."
    route = str(payload.get("frontendRoute") or "").strip().lower()
    product_mode = str(payload.get("productMode") or "").strip().lower()
    screen_template = str(payload.get("screenTemplate") or "").strip().lower()
    fields = payload.get("fields") or []
    field_labels = [str(field.get("label") or field.get("name") or "").strip() for field in fields]
    actor_label = str(payload.get("actorLabel") or "Usuario").strip()

    navigation_label = payload.get("navigationLabel")
    page_title = payload.get("pageTitle")
    page_description = payload.get("pageDescription") or summary
    hero_eyebrow = navigation_label
    form_card_title = "Concluir operacao"
    form_card_description = "Preencha as informacoes essenciais para concluir esta etapa com seguranca e contexto."
    records_title = "Atividade recente"
    records_empty_state = "Nenhuma movimentacao registrada ainda nesta area."
    layout_variant = infer_layout_variant(product_mode, screen_template, route)
    highlights = [
        "Fluxo desenhado para reduzir duvidas e acelerar a conclusao.",
        "Leitura clara do que precisa ser feito agora.",
        "Feedback visivel para acompanhar a operacao sem friccao.",
    ]

    if "notification" in route or "notifica" in route:
        navigation_label = navigation_label or "Notificacoes"
        page_title = page_title or "Configure notificacoes por e-mail"
        hero_eyebrow = hero_eyebrow or "Preferencias"
        form_card_title = "Preferencias de alerta"
        form_card_description = "Defina para qual email os avisos serao enviados e quais atualizacoes merecem sua atencao."
        records_title = "Estado atual das notificacoes"
        records_empty_state = "Ative suas preferencias para acompanhar atualizacoes importantes sem excesso de ruido."
        layout_variant = "summary-first"
        highlights = [
            "Escolha quais alertas realmente merecem sua atencao.",
            "Mantenha o email principal alinhado com a rotina do atendimento.",
            "Revise rapidamente se as preferencias atuais ainda fazem sentido.",
        ]

    elif "access-control" in route or "permiss" in route or "perfil" in route:
        navigation_label = navigation_label or "Perfis de acesso"
        page_title = page_title or "Configure perfis e permissoes"
        hero_eyebrow = hero_eyebrow or "Governanca"
        form_card_title = "Regras de acesso"
        form_card_description = "Organize perfis e niveis de acesso com leitura clara do impacto operacional."
        records_title = "Perfis configurados"
        records_empty_state = "Nenhum perfil configurado ainda. Comece definindo o primeiro conjunto de acessos."
        layout_variant = "checklist-settings"
        highlights = [
            "Visualize quem pode fazer o que sem ambiguidade.",
            "Mantenha a governanca de acesso mais facil de revisar.",
            "Ajuste permissoes sem perder clareza do impacto operacional.",
        ]

    elif "dashboard" in route or product_mode == "manager-cockpit" or screen_template == "dashboard":
        navigation_label = navigation_label or "Painel"
        page_title = page_title or "Acompanhe a operacao com clareza"
        hero_eyebrow = hero_eyebrow or "Leitura executiva"
        form_card_title = "Filtro da leitura"
        form_card_description = "Refine o recorte exibido para acompanhar desvios, prioridades e ritmo da operacao."
        records_title = "Recortes principais"
        records_empty_state = "Assim que a operacao gerar movimento, os principais sinais aparecerao aqui."
        layout_variant = "hero-metrics"
        highlights = [
            "Leitura executiva pronta para comparar desempenho e desvios.",
            "Recortes mais claros para decidir o proximo passo com menos atrito.",
            "Indicadores organizados para acompanhamento continuo da operacao.",
        ]

    elif product_mode == "self-service-settings" or screen_template == "settings":
        navigation_label = navigation_label or "Preferencias"
        page_title = page_title or "Ajuste sua configuracao com clareza"
        hero_eyebrow = hero_eyebrow or "Configuracao pessoal"
        form_card_title = "Ajustes principais"
        form_card_description = "Atualize suas preferencias e confirme o estado atual sem depender de suporte."
        records_title = "Resumo atual"
        records_empty_state = "Assim que voce salvar suas preferencias, o estado atual aparecera aqui."
        layout_variant = "calm-settings"
        highlights = [
            "Ajustes claros para reduzir atrito na rotina.",
            "Resumo rapido do estado atual da configuracao.",
            "Confirmacao visivel do que ficou ativo para seu uso.",
        ]

    if not page_title:
        primary_field = next((label for label in field_labels if label), None)
        if primary_field:
            page_title = f"Ajuste {primary_field.lower()} com clareza"
        else:
            page_title = "Conduza esta operacao com clareza"

    if not navigation_label:
        navigation_label = page_title.split(" ")[0:2]
        navigation_label = " ".join(navigation_label) if navigation_label else "Operacao"

    records_empty_state = personalize_records_empty_state(
        records_empty_state=records_empty_state,
        route=route,
        product_mode=product_mode,
        screen_template=screen_template,
        actor_label=actor_label,
    )

    return {
        "navigationLabel": navigation_label,
        "pageTitle": page_title,
        "pageDescription": page_description,
        "heroEyebrow": hero_eyebrow or navigation_label,
        "heroTitle": page_title,
        "heroDescription": page_description,
        "formCardTitle": form_card_title,
        "formCardDescription": form_card_description,
        "submitLabel": submit_label,
        "layoutVariant": layout_variant,
        "highlights": highlights,
        "recordsTitle": records_title,
        "recordsEmptyState": records_empty_state,
        "screenSpec": build_screen_spec(
            payload,
            navigation_label,
            page_title,
            layout_variant,
        ),
        "dataSpec": payload.get("generationIR", {}).get("frontend", {}).get("dataSpec", {}),
        "componentMap": build_component_map(
            payload,
            layout_variant,
        ),
    }


def personalize_records_empty_state(records_empty_state, route, product_mode, screen_template, actor_label):
    actor_label = (actor_label or "").strip().lower()
    actor_reference = f"do {actor_label}" if actor_label else "do usuario"

    if "notification" in route or "notifica" in route:
        return f"As preferencias {actor_reference} aparecerao aqui assim que voce salvar as primeiras escolhas de alerta."

    if "access-control" in route or "permiss" in route or "perfil" in route:
        return "Os perfis configurados aparecerao aqui para facilitar revisao e ajuste de acessos."

    if "dashboard" in route or product_mode == "manager-cockpit" or screen_template == "dashboard":
        return "Os principais sinais da operacao aparecerao aqui assim que houver dados suficientes para leitura."

    if product_mode == "self-service-settings" or screen_template == "settings":
        return f"O resumo atual {actor_reference} aparecera aqui assim que as preferencias forem salvas."

    return records_empty_state


def infer_layout_variant(product_mode, screen_template, route):
    route = str(route or "").strip().lower()
    product_mode = str(product_mode or "").strip().lower()
    screen_template = str(screen_template or "").strip().lower()

    if "notification" in route or "notifica" in route:
        return "summary-first"

    if "access-control" in route or "permiss" in route or "perfil" in route:
        return "checklist-settings"

    if "dashboard" in route or product_mode == "manager-cockpit" or screen_template == "dashboard":
        return "hero-metrics"

    if "attachments" in route or "anexo" in route or product_mode == "evidence-workbench":
        return "evidence-split"

    if product_mode == "review-workbench":
        return "queue-first"

    if screen_template == "wizard":
        return "guided-stack"

    if product_mode == "self-service-settings" or screen_template == "settings":
        return "calm-settings"

    return "balanced-split"


def build_screen_spec(payload, navigation_label, page_title, layout_variant):
    generation_ir = payload.get("generationIR", {}) or {}
    frontend_ir = generation_ir.get("frontend", {}) or {}
    existing_spec = frontend_ir.get("screenSpec", {}) or {}
    screen_template = str(payload.get("screenTemplate") or existing_spec.get("screenTemplate") or "crud").strip().lower()
    product_mode = str(payload.get("productMode") or existing_spec.get("productMode") or "structured-workspace").strip().lower()
    ui_intent = str(payload.get("uiIntent") or existing_spec.get("uiIntent") or "custom").strip().lower()
    fields = payload.get("fields") or existing_spec.get("fields") or []
    states = payload.get("uiStates") or {}

    default_sections = {
        "settings": ["hero", "form", "summary", "activity"],
        "dashboard": ["hero", "metrics", "filters", "records"],
        "workspace": ["hero", "queue", "form", "records"],
        "wizard": ["hero", "steps", "form", "summary"],
        "crud": ["hero", "filters", "list", "form"],
    }

    route = existing_spec.get("route") or payload.get("frontendRoute")
    return {
        "route": route,
        "navigationLabel": navigation_label,
        "pageTitle": page_title,
        "screenTemplate": screen_template,
        "productMode": product_mode,
        "uiIntent": ui_intent,
        "layoutVariant": layout_variant,
        "sections": existing_spec.get("sections") or default_sections.get(screen_template, default_sections["crud"]),
        "states": list(states.keys()) if isinstance(states, dict) and states else existing_spec.get("states") or ["loading", "empty", "error", "success"],
        "fields": [
            {
                "name": field.get("name"),
                "label": field.get("label") or field.get("name"),
                "inputType": field.get("inputType") or "text",
                "required": bool(field.get("required")),
            }
            for field in fields
        ],
        "componentMap": existing_spec.get("componentMap") or build_component_map(payload, layout_variant),
    }


def build_component_map(payload, layout_variant):
    generation_ir = payload.get("generationIR", {}) or {}
    existing_spec = (generation_ir.get("frontend", {}) or {}).get("screenSpec", {}) or {}
    existing_map = existing_spec.get("componentMap")
    if isinstance(existing_map, dict) and existing_map:
        return existing_map

    page_archetype = str(payload.get("pageArchetype") or existing_spec.get("pageArchetype") or "").strip().lower()
    screen_template = str(payload.get("screenTemplate") or existing_spec.get("screenTemplate") or "crud").strip().lower()
    sections = existing_spec.get("sections") or []

    component_map = {}

    if page_archetype == "executive-dashboard":
        component_map["recordsLead"] = "insightStrip"
        component_map["highlights"] = "insightCards"
    elif page_archetype in {"operations-queue", "review-queue"}:
        component_map["recordsLead"] = "queueRail"
    elif page_archetype == "approval-flow":
        component_map["recordsLead"] = "approvalSteps"
    elif page_archetype == "evidence-workbench":
        component_map["recordsLead"] = "evidenceRail"

    if "activity" in sections:
        component_map["activity"] = "activityTimeline"
    if page_archetype in {"settings-console", "intake-form"} or "summary" in sections:
        component_map["summary"] = "settingsSnapshot"

    if not component_map:
        if screen_template == "dashboard":
            component_map["recordsLead"] = "insightStrip"
        elif screen_template == "workspace":
            component_map["recordsLead"] = "queueRail"
        elif screen_template == "wizard":
            component_map["recordsLead"] = "approvalSteps"
        elif screen_template == "settings":
            component_map["summary"] = "settingsSnapshot"

    return component_map


def as_json(value):
    return json.dumps(value, ensure_ascii=False)


def build_context_block(payload):
    return f"""
## Contexto

- prompt_version: {payload.get('promptVersion') or 'v1'}
- task_title: {payload.get('taskTitle')}
- summary: {payload.get('summary')}
- user_value: {payload.get('userValue')}
- frontend_route: {payload.get('frontendRoute')}
- screen_template: {payload.get('screenTemplate')}
- product_mode: {payload.get('productMode')}
- ui_intent: {payload.get('uiIntent')}
- ui_role: {payload.get('uiRole')}
- actor_label: {payload.get('actorLabel')}
- submit_label: {payload.get('submitLabel')}

### Intent direction
{as_json(payload.get('intentDirection', {}))}

### Product direction
{as_json(payload.get('productDirection', {}))}

### Fields
{as_json(payload.get('fields', []))}

### UI states
{as_json(payload.get('uiStates', {}))}

### Design references
{as_json(payload.get('designReference', {}))}

### Repair goals
{as_json(payload.get('repairGoals', {}))}

### Generation IR
{as_json(payload.get('generationIR', {}))}

### Generation IR validation
{as_json(payload.get('generationIRValidation', {}))}

### Archetype
- page_archetype: {payload.get('pageArchetype')}
- fallback_pattern: {payload.get('fallbackPattern')}
- archetype_confidence: {payload.get('archetypeConfidence')}
- alternative_archetypes: {as_json(payload.get('alternativeArchetypes', []))}
- domain_signals: {as_json(payload.get('domainSignals', {}))}
""".strip()


def build_workflow_block():
    return """
## Workflow

Siga estas etapas mentais antes de responder:

1. Determine o trabalho principal do usuario nesta tela.
2. Decida qual bloco lidera a experiencia e qual bloco so apoia.
3. Escolha a familia da tela com base no `product_mode` e no `ui_intent`.
4. Nomeie a tela e os blocos com linguagem de produto real, nao com linguagem de requisito.
5. Faça uma segunda passada de polish para remover termos genericos, burocraticos ou tecnicos.
""".strip()


def build_design_rules_block():
    return """
## Design Rules

- Esta tela faz parte de um produto SaaS maduro. Nao descreva um mock conceitual.
- Mantenha o texto em portugues do Brasil.
- Escreva copy curta, orientada ao usuario final, com hierarquia clara.
- Nao replique requisitos, QA, documentacao, governanca ou jargao tecnico na interface.
- Nao use placeholders fracos como "Execute esta jornada", "Preencha os dados" ou "Ultimos registros" quando houver nome melhor.
- O `product_mode` tem prioridade sobre o layout base.
- O `ui_intent` decide o protagonismo da tela antes do template.
- O `page_archetype` deve orientar a composicao para casos desconhecidos.
- O `fallback_pattern` deve ser usado quando o dominio for novo ou pouco claro.
- O `screen_template` ajusta a composicao, mas nao deve apagar a personalidade do produto.
- Sempre escolha tambem um `layoutVariant` coerente com o tipo de experiencia.
- Sugira um `componentMap` enxuto por slot para orientar a materializacao dos blocos principais.
- Prefira componentes reutilizaveis como `insightStrip`, `queueRail`, `approvalSteps`, `evidenceRail`, `settingsSnapshot` e `activityTimeline`.

### Variantes de layout

- `balanced-split`: formulario e area viva equilibrados
- `hero-metrics`: dashboard com hero forte, metricas e leitura executiva
- `queue-first`: fila ou area viva lidera, acao secundaria vem depois
- `evidence-split`: contexto e registros primeiro, captura depois
- `calm-settings`: ajustes com resumo lateral tranquilo
- `summary-first`: settings com estado atual liderando a tela
- `checklist-settings`: configuracao com checklist e governanca mais forte
- `guided-stack`: fluxo em pilha com senso de proximo passo

### Leituras por modo

- `governance-console`: controle, risco, matriz, politica, decisao cuidadosa
- `self-service-settings`: autonomia, configuracao, estado atual, baixo atrito
- `evidence-workbench`: bancada de caso, comprovantes, contexto vivo
- `manager-cockpit`: leitura executiva, indicadores, comparacao, desvios
- `review-workbench`: fila, aprovacao, triagem, contexto do item
- `onboarding-flow`: sequencia, preparo, progresso, proximo passo
- `structured-workspace`: operacao guiada, mesa de trabalho, foco no que fazer agora
- `asset-library`: acervo, materiais, organizacao, reuso
- `catalog-builder`: composicao de oferta, estrutura comercial
- `curriculum-designer`: sequencia, organizacao pedagogica, estrutura
- `commercial-settings`: configuracao comercial, impacto no negocio
- `access-gateway`: entrada, autenticacao, confianca
- `immersive-workspace`: foco central na execucao ou no consumo principal

### Leituras por template

- `settings`: estado atual, configuracao, orientacao e confirmacao
- `wizard`: etapas, sequencia, preparo, proximo passo
- `dashboard`: visao geral, indicadores, leitura executiva
- `workspace`: fila operacional, decisao, acompanhamento
- `crud`: cadastro e listagem com valor percebido

### Archetypes para casos desconhecidos

- `executive-dashboard`: leitura de indicadores, comparacao e decisao
- `operations-queue`: fila priorizada com ownership e urgencia visiveis
- `review-queue`: contexto para revisar e decidir
- `settings-console`: ajuste principal com resumo atual forte
- `approval-flow`: estado, decisao e historico curto
- `evidence-workbench`: contexto de caso, anexos e trilha viva
- `intake-form`: captura orientada com proximo passo claro
- `record-management`: fallback para cadastro/listagem quando nada mais dominar

### O que evitar

- palavras como requisito, criterio de aceite, QA, validacao tecnica, arquitetura, rastreabilidade
- exposicao de enums ou termos internos como RBAC, enabled, disabled, self_service
- estado vazio frio, burocratico ou sem orientacao
- lista lateral com nome generico se o dominio pedir algo mais especifico
""".strip()


def build_output_contract_block():
    return """
## Output Contract

Retorne APENAS JSON valido, sem markdown e sem texto extra.

Use exatamente este formato:
{
  "navigationLabel": "string curta",
  "pageTitle": "titulo curto da tela",
  "pageDescription": "descricao curta",
  "heroEyebrow": "selo curto",
  "heroTitle": "titulo do bloco principal",
  "heroDescription": "texto curto explicativo",
  "formCardTitle": "titulo do card do formulario",
  "formCardDescription": "descricao curta do card",
  "submitLabel": "CTA principal",
  "layoutVariant": "balanced-split | hero-metrics | queue-first | evidence-split | calm-settings | summary-first | checklist-settings | guided-stack",
  "highlights": ["bullet curto 1", "bullet curto 2"],
  "recordsTitle": "titulo da area viva",
  "recordsEmptyState": "mensagem curta de vazio",
  "screenSpec": {
    "route": "string",
    "navigationLabel": "string",
    "pageTitle": "string",
    "screenTemplate": "settings | dashboard | workspace | wizard | crud",
    "productMode": "string",
    "uiIntent": "string",
    "layoutVariant": "string",
    "sections": ["hero", "form"],
    "componentMap": {
      "recordsLead": "queueRail | insightStrip | approvalSteps | evidenceRail | null",
      "activity": "activityTimeline | null",
      "summary": "settingsSnapshot | null",
      "highlights": "insightCards | null"
    },
    "states": ["loading", "empty", "error", "success"],
    "fields": [{"name": "string", "label": "string", "inputType": "text", "required": true}]
  },
  "dataSpec": {
    "queryClient": "tanstack-query",
    "queries": [],
    "mutations": [],
    "formLibrary": "react-hook-form",
    "schemaLibrary": "zod"
  },
  "componentMap": {
    "recordsLead": "queueRail | insightStrip | approvalSteps | evidenceRail | null",
    "activity": "activityTimeline | null",
    "summary": "settingsSnapshot | null",
    "highlights": "insightCards | null"
  }
}
""".strip()


def build_prompt(payload):
    return f"""
Voce e um especialista em product design para geracao de interfaces reais de software.
Sua tarefa e propor copy e estrutura visual para UMA tela real do produto.

Nao responda com explicacao. Nao responda com markdown. Nao descreva sua linha de raciocinio.

{build_context_block(payload)}

{build_workflow_block()}

{build_design_rules_block()}

{build_output_contract_block()}
""".strip()


def main():
    payload = json.load(sys.stdin)
    has_repair_context = bool(payload.get("repairGoals"))
    bypass_cache = bool(payload.get("bypassCache"))
    output_budget = 280 if has_repair_context else 420
    prompt = build_prompt(payload)
    provider_order = str(os.getenv("AI_PROVIDER_ORDER") or os.getenv("LLM_PROVIDER") or "auto").strip()

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
        print(json.dumps({
            "success": True,
            "data": data,
            "meta": {
                "source": "llm",
                "providerHint": provider_order,
            },
        }, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({
            "success": True,
            "data": fallback(payload),
            "meta": {
                "source": "fallback",
                "providerHint": provider_order,
                "reason": str(exc),
            },
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
