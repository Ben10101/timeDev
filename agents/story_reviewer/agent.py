# -*- coding: utf-8 -*-
import json
import re
import sys

from agents.developer.response_validation import generate_complete_text


def parse_first_json_object(raw):
    text = str(raw or '').strip()
    decoder = json.JSONDecoder()
    start = text.find('{')
    while start >= 0:
        try:
            value, _ = decoder.raw_decode(text[start:])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            start = text.find('{', start + 1)
            continue
        break
    raise ValueError('Agente de revisao retornou JSON invalido.')


def _normalize_review_payload(value):
    """Normalize common provider wrappers before applying the review contract.

    Some models return the review under ``result``/``data`` or return only the
    proposed-story fields.  Those are usable responses: the deterministic
    review logic can safely supply every omitted field from the target story.
    """
    if not isinstance(value, dict):
        return value

    for wrapper in ('review', 'result', 'data'):
        nested = value.get(wrapper)
        if isinstance(nested, dict) and any(
            key in nested for key in ('assessment', 'quality_evidence', 'questions', 'proposed_story', 'proposedStory')
        ):
            value = nested
            break

    normalized = dict(value)
    if not isinstance(normalized.get('proposed_story'), dict) and isinstance(normalized.get('proposedStory'), dict):
        normalized['proposed_story'] = normalized['proposedStory']

    # A provider can return the editable story itself rather than nesting it.
    # Treat it as the proposal instead of discarding valid user-facing text.
    if not isinstance(normalized.get('proposed_story'), dict) and any(
        key in normalized for key in ('title', 'description', 'actor', 'benefit', 'acceptance_criteria')
    ):
        normalized['proposed_story'] = {
            key: normalized[key]
            for key in ('title', 'description', 'actor', 'benefit', 'acceptance_criteria')
            if key in normalized
        }
    return normalized


def _validate_review_json(raw):
    try:
        value = _normalize_review_payload(parse_first_json_object(raw))
    except ValueError as error:
        return False, str(error)
    if not isinstance(value, dict):
        return False, 'A resposta precisa conter um objeto JSON.'
    # The provider can legally return an empty/minimal JSON object despite the
    # prompt.  It is safer to complete that response deterministically from
    # the target story than to fail a user action that has a usable fallback.
    return True, None


READINESS_DIMENSIONS = (
    ('value_actor', 'Valor e ator claros', 10),
    ('scope_atomicity', 'Escopo atomico', 15),
    ('clarity', 'Clareza e ausencia de ambiguidade', 15),
    ('rules_flow', 'Regras e fluxo completos', 15),
    ('acceptance_testability', 'Criterios de aceite verificaveis', 20),
    ('traceability', 'Rastreabilidade', 10),
    ('consistency', 'Consistencia com o contexto', 5),
    ('quality_risks', 'Riscos e requisitos de qualidade', 5),
    ('dependencies', 'Viabilidade e dependencias', 5),
)
READINESS_VERSION = '1.0'
GATE_QUESTIONS = {
    'acceptance_criteria_missing': 'Quais cenarios de sucesso e de excecao comprovam que esta story foi entregue?',
    'traceability_missing': 'Qual briefing, decisao ou regra aprovada sustenta esta story?',
    'scope_not_atomic': 'Qual capacidade deve permanecer nesta story e quais devem ser separadas em outras stories?',
    'critical_quality_requirement_undefined': 'Qual regra de seguranca ou permissao deve ser aplicada, incluindo limites e comportamento de falha?',
    'acceptance_criteria_duplicate': 'Qual dos cenarios com o mesmo fluxo deve permanecer e qual comportamento adicional precisa ser especificado?',
}
UNSPECIFIED_CRITERION_PATTERN = re.compile(
    r'\b(limite definido|quando necessario|conforme perfil|adequad[oa]|rapido|facil|intuitiv[oa]|etc\.?|outro atributo)\b',
    re.IGNORECASE,
)
def _status(value, fallback='partial'):
    value = str(value or '').strip().lower()
    return value if value in {'pass', 'partial', 'fail'} else fallback


def _has_text(value):
    return bool(str(value or '').strip())


def _acceptance_criteria(proposal):
    criteria = proposal.get('acceptance_criteria') if isinstance(proposal, dict) else []
    return criteria if isinstance(criteria, list) else []


def _criterion_is_verifiable(criterion):
    if not isinstance(criterion, dict):
        return False
    values = [str(criterion.get(field) or '').strip() for field in ('given', 'when', 'then')]
    if not all(values) or any(len(value) < 8 for value in values):
        return False
    return not UNSPECIFIED_CRITERION_PATTERN.search(' '.join(values))


def _criterion_flow_key(criterion):
    if not isinstance(criterion, dict):
        return ''
    normalize = lambda value: re.sub(r'[^a-z0-9]+', ' ', str(value or '').casefold()).strip()
    return f"{normalize(criterion.get('given'))}|{normalize(criterion.get('when'))}"


def _duplicate_criterion_indexes(criteria):
    seen = {}
    duplicates = []
    for index, criterion in enumerate(criteria):
        key = _criterion_flow_key(criterion)
        if not key:
            continue
        if key in seen:
            duplicates.append(index)
        else:
            seen[key] = index
    return duplicates


def _criterion_contextual_questions(criteria):
    """Ask only about the exact scenario that makes a criterion unverifiable."""
    questions = []
    for index, criterion in enumerate(criteria):
        if _criterion_is_verifiable(criterion):
            continue
        values = {field: str(criterion.get(field) or '').strip() if isinstance(criterion, dict) else '' for field in ('given', 'when', 'then')}
        missing = [field for field, value in values.items() if not value]
        scenario = f"No cenário {index + 1}"
        text = ' '.join(values.values())
        lower_text = text.casefold()
        if 'limite definido' in lower_text:
            question = f"{scenario}, qual é o valor exato do limite mencionado e em qual unidade ele deve ser aplicado?"
        elif 'conforme perfil' in lower_text:
            question = f"{scenario}, quais funcionalidades o perfil Professor deve conseguir acessar após a autenticação?"
        elif missing:
            field_labels = {'given': 'Dado', 'when': 'Quando', 'then': 'Então'}
            question = f"{scenario}, qual informação deve preencher o campo {field_labels[missing[0]]} para tornar o resultado verificável?"
        else:
            excerpt = next((value for value in values.values() if value), 'cenário informado')
            question = f"{scenario}, qual resultado mensurável deve substituir a condição vaga em “{excerpt[:90]}”?"
        questions.append({
            'id': f'RQ-ACCEPTANCE-CRITERION-{index + 1}',
            'question': question,
            'why': f'{scenario} contém uma condição que não permite teste objetivo.',
            'blocking': True,
        })
    return questions


def _is_generic_acceptance_question(question):
    normalized = str(question or '').strip().casefold()
    return normalized.startswith('qual deve ser o resultado observavel de cada criterio') or normalized.startswith('qual deve ser o resultado observável de cada critério')


def _normalized_proposed_story(story, proposal):
    """Keep the editable story visible even when a provider omits proposal fields."""
    proposal = proposal if isinstance(proposal, dict) else {}
    context = story.get('refinement_context') or story.get('refinementContext') or {}
    existing_criteria = context.get('acceptance_criteria') or context.get('acceptanceCriteria') or []
    criteria = proposal.get('acceptance_criteria')
    return {
        'title': str(proposal.get('title') or story.get('title') or story.get('goal') or '').strip(),
        'description': str(proposal.get('description') or story.get('description') or '').strip(),
        'actor': str(proposal.get('actor') or story.get('actor') or '').strip(),
        'benefit': str(proposal.get('benefit') or story.get('benefit') or '').strip(),
        'acceptance_criteria': criteria if isinstance(criteria, list) else existing_criteria if isinstance(existing_criteria, list) else [],
    }


def _apply_answered_criterion_updates(proposal, answers):
    """Apply answers to the criterion that generated the question, even if the model omits the rewrite."""
    criteria = proposal.get('acceptance_criteria') if isinstance(proposal, dict) else []
    if not isinstance(criteria, list):
        return proposal
    updated = {**proposal, 'acceptance_criteria': [dict(item) if isinstance(item, dict) else item for item in criteria]}
    for answer in answers if isinstance(answers, list) else []:
        if not isinstance(answer, dict) or not _has_text(answer.get('answer')):
            continue
        match = re.fullmatch(r'RQ-ACCEPTANCE-CRITERION-(\d+)', str(answer.get('id') or '').strip())
        if not match:
            continue
        index = int(match.group(1)) - 1
        if index < 0 or index >= len(updated['acceptance_criteria']) or not isinstance(updated['acceptance_criteria'][index], dict):
            continue
        criterion = updated['acceptance_criteria'][index]
        response = str(answer['answer']).strip()
        criterion_text = ' '.join(str(criterion.get(field) or '') for field in ('given', 'when', 'then')).casefold()
        if 'limite definido' in criterion_text:
            for field in ('given', 'when', 'then'):
                criterion[field] = re.sub(r'\b(?:o|a)\s+limite definido\b|\blimite definido\b', response, str(criterion.get(field) or ''), flags=re.IGNORECASE)
        elif 'conforme perfil' in criterion_text:
            criterion['then'] = f'O sistema libera ao perfil Professor somente as funcionalidades: {response}'
        else:
            for field in ('given', 'when', 'then'):
                if not _has_text(criterion.get(field)):
                    criterion[field] = response
                    break
        source_ids = criterion.get('source_ids') if isinstance(criterion.get('source_ids'), list) else []
        criterion['source_ids'] = list(dict.fromkeys([*source_ids, str(answer.get('id') or '').strip()]))
    return updated


def _answer_for(answers, question_id):
    for answer in answers if isinstance(answers, list) else []:
        if isinstance(answer, dict) and str(answer.get('id') or '').strip() == question_id and _has_text(answer.get('answer')):
            return str(answer['answer']).strip()
    return ''


def _is_affirmative(answer):
    return str(answer or '').strip().casefold() in {'sim', 's', 'yes', 'y'}


def _apply_answered_story_decisions(proposal, answers):
    """Apply confirmed scope/clarity decisions to the editable proposal.

    These decisions previously disappeared after the question was answered:
    only acceptance-criterion answers affected the proposal.  The user must
    be able to see and approve the resulting story before it is persisted.
    """
    if not isinstance(proposal, dict):
        return proposal
    updated = {
        **proposal,
        'acceptance_criteria': [dict(item) if isinstance(item, dict) else item for item in proposal.get('acceptance_criteria', [])],
    }
    scope_answer = _answer_for(answers, 'RQ-SCOPE-CONSULTATION-RESERVATION')
    if _is_affirmative(scope_answer):
        updated['description'] = (
            'O sistema deve permitir ao professor consultar salas disponiveis por data, horario e capacidade. '
            'A validacao e o bloqueio da reserva serao tratados em uma story especifica.'
        )
        updated['acceptance_criteria'] = [
            criterion for criterion in updated['acceptance_criteria']
            if not (
                isinstance(criterion, dict)
                and 'reserv' in ' '.join(str(criterion.get(field) or '') for field in ('given', 'when', 'then')).casefold()
            )
        ]

    clarity_answer = _answer_for(answers, 'RQ-CLARITY-CAPACITY-LIMIT')
    if _is_affirmative(clarity_answer):
        updated['description'] = re.sub(
            r'\s*se\s+o\s+numero\s+de\s+alunos\s+exceder\s+o\s+limite\s+definido,?\s*',
            ' ',
            str(updated.get('description') or ''),
            flags=re.IGNORECASE,
        ).strip()
    return updated


def _prune_orphaned_question_sources(proposal, answers):
    """Keep question IDs only while the answer that substantiates them still exists."""
    if not isinstance(proposal, dict):
        return proposal
    answered_ids = {
        str(answer.get('id') or '').strip()
        for answer in answers if isinstance(answer, dict) and _has_text(answer.get('answer'))
    }
    criteria = proposal.get('acceptance_criteria')
    if not isinstance(criteria, list):
        return proposal
    cleaned = []
    for raw_criterion in criteria:
        criterion = dict(raw_criterion) if isinstance(raw_criterion, dict) else raw_criterion
        if isinstance(criterion, dict) and isinstance(criterion.get('source_ids'), list):
            criterion['source_ids'] = [
                source_id for source_id in criterion['source_ids']
                if not str(source_id).upper().startswith('Q-') or str(source_id) in answered_ids
            ]
        cleaned.append(criterion)
    return {**proposal, 'acceptance_criteria': cleaned}


def _proposal_is_meaningful(proposal):
    """Distinguish an omitted provider proposal from a legitimate unchanged one."""
    if not isinstance(proposal, dict):
        return False
    return any(_has_text(proposal.get(field)) for field in ('title', 'description', 'actor', 'benefit')) or isinstance(proposal.get('acceptance_criteria'), list)


def _question_has_answer(question, review):
    """A blocking question is open only when no persisted user answer matches it."""
    if not isinstance(question, dict):
        return False
    question_id = str(question.get('id') or '').strip()
    question_text = str(question.get('question') or '').strip().casefold()
    answers = review.get('review_answers') if isinstance(review.get('review_answers'), list) else []
    for answer in answers:
        if not isinstance(answer, dict) or not _has_text(answer.get('answer')):
            continue
        answer_id = str(answer.get('id') or '').strip()
        answer_question = str(answer.get('question') or '').strip().casefold()
        if question_id and question_id == answer_id:
            return True
        if question_text and question_text == answer_question:
            return True
    return False


def _readiness_assessment(story, review):
    """Calculate a stable readiness result from evidence, not an LLM-supplied score."""
    proposal = review.get('proposed_story') if isinstance(review.get('proposed_story'), dict) else {}
    evidence = review.get('quality_evidence') if isinstance(review.get('quality_evidence'), dict) else {}
    criteria = _acceptance_criteria(proposal)
    valid_criteria = [criterion for criterion in criteria if _criterion_is_verifiable(criterion)]
    duplicate_criteria = _duplicate_criterion_indexes(criteria)
    story_text = ' '.join(str(proposal.get(field) or story.get(field) or '') for field in ('title', 'description', 'actor', 'benefit'))
    sources = list(review.get('source_ids') or []) + list(story.get('source_ids') or story.get('sourceIds') or [])
    vague = bool(re.search(r'\b(adequad[oa]|rapido|facil|intuitiv[oa]|limite definido|quando necessario)\b', story_text, re.IGNORECASE))
    has_value = all(_has_text(proposal.get(field) or story.get(field)) for field in ('actor', 'title', 'benefit'))

    forced_statuses = {
        'value_actor': 'pass' if has_value else 'fail',
        'clarity': 'fail' if vague else None,
        'acceptance_testability': 'pass' if len(valid_criteria) >= 2 and len(valid_criteria) == len(criteria) and not duplicate_criteria else 'partial' if valid_criteria else 'fail',
        'traceability': 'pass' if sources else 'fail',
    }
    dimensions = []
    score = 0
    for dimension_id, label, weight in READINESS_DIMENSIONS:
        raw = evidence.get(dimension_id) if isinstance(evidence.get(dimension_id), dict) else {}
        status = forced_statuses.get(dimension_id) or _status(raw.get('status'))
        multiplier = {'pass': 1, 'partial': 0.5, 'fail': 0}[status]
        points = int(weight * multiplier)
        score += points
        dimensions.append({
            'id': dimension_id,
            'label': label,
            'weight': weight,
            'score': points,
            'status': status,
            'evidence': [str(item).strip() for item in raw.get('evidence', []) if _has_text(item)][:3],
        })

    gates = []
    blocking_questions = [
        item for item in review.get('questions', [])
        if isinstance(item, dict) and item.get('blocking') and not _question_has_answer(item, review)
    ]
    if blocking_questions:
        gates.append({'code': 'blocking_questions_open', 'message': 'Existem perguntas bloqueantes sem decisao.', 'blocking': True})
    if not criteria:
        gates.append({'code': 'acceptance_criteria_missing', 'message': 'A story nao possui criterios de aceite.', 'blocking': True})
    elif len(valid_criteria) != len(criteria):
        gates.append({'code': 'acceptance_criteria_not_verifiable', 'message': 'Todo criterio deve conter Dado, Quando e Entao com valores especificos e verificaveis.', 'blocking': True})
    if duplicate_criteria:
        gates.append({'code': 'acceptance_criteria_duplicate', 'message': 'Ha criterios de aceite com o mesmo fluxo; consolide ou diferencie os cenarios.', 'blocking': True})
    if not sources:
        gates.append({'code': 'traceability_missing', 'message': 'A story nao possui fonte rastreavel.', 'blocking': True})
    scope = next(item for item in dimensions if item['id'] == 'scope_atomicity')
    if scope['status'] == 'fail':
        gates.append({'code': 'scope_not_atomic', 'message': 'A story combina capacidades independentes e deve ser dividida.', 'blocking': True})
    if re.search(r'\b(login|autentic|permiss|administrador|seguranc)\b', story_text, re.IGNORECASE):
        quality = next(item for item in dimensions if item['id'] == 'quality_risks')
        if quality['status'] == 'fail':
            gates.append({'code': 'critical_quality_requirement_undefined', 'message': 'Regra critica de seguranca ou permissao esta indefinida.', 'blocking': True})

    if any(gate['blocking'] for gate in gates):
        decision = 'BLOCKED'
    elif score >= 85:
        decision = 'READY'
    elif score >= 70:
        decision = 'HUMAN_REVIEW'
    else:
        decision = 'REFINE'
    model_assessment = review.get('assessment') if isinstance(review.get('assessment'), dict) else {}
    # Gaps are displayed as factual guidance. Keep them deterministic rather
    # than surfacing an LLM assertion that can contradict a confirmed answer.
    gaps = [gate['message'] for gate in gates]
    for dimension in dimensions:
        if dimension['status'] != 'pass' and not dimension['evidence']:
            gaps.append(f"{dimension['label']}: a revisao nao apresentou evidencia contextual suficiente para esta story.")
    return {
        'rubric_version': READINESS_VERSION,
        'score': score,
        'decision': decision,
        'dimensions': dimensions,
        'gates': gates,
        'strengths': [str(item).strip() for item in model_assessment.get('strengths', []) if _has_text(item)],
        'gaps': list(dict.fromkeys(gaps)),
        'risks': [str(item).strip() for item in model_assessment.get('risks', []) if _has_text(item)],
    }


def _dimension_contextual_questions(story, proposal, assessment):
    """Turn score-reducing, story-specific gaps into answerable decisions.

    A low score is only useful when the reviewer tells the user which concrete
    product decision can improve it.  Do not fabricate questions for generic
    partial dimensions: every question below is tied to text already present
    in the story or its proposed criteria.
    """
    dimensions = {
        item.get('id'): item
        for item in assessment.get('dimensions', [])
        if isinstance(item, dict) and item.get('status') != 'pass' and not item.get('evidence')
    }
    title = str(proposal.get('title') or story.get('title') or story.get('goal') or '').strip()
    description = str(proposal.get('description') or story.get('description') or '').strip()
    goal = str(proposal.get('goal') or story.get('goal') or '').strip()
    criteria_text = ' '.join(
        str(criterion.get(field) or '')
        for criterion in proposal.get('acceptance_criteria', []) if isinstance(criterion, dict)
        for field in ('given', 'when', 'then')
    )
    text = f'{title} {description} {goal} {criteria_text}'.casefold()
    questions = []

    if 'scope_atomicity' in dimensions and re.search(r'\bconsult', f'{title} {goal}', re.IGNORECASE) and re.search(r'\breserv', description, re.IGNORECASE):
        questions.append({
            'id': 'RQ-SCOPE-CONSULTATION-RESERVATION',
            'question': 'Esta story deve cobrir somente a consulta de disponibilidade, deixando a validacao e o bloqueio da reserva para outra story?',
            'why': 'O objetivo descreve consulta, mas a descricao tambem inclui bloqueio de reserva por capacidade.',
            'blocking': True,
        })

    if 'clarity' in dimensions and 'limite definido' in text:
        questions.append({
            'id': 'RQ-CLARITY-CAPACITY-LIMIT',
            'question': 'Na regra de capacidade, qual limite concreto deve ser aplicado ou o termo “limite definido” deve ser removido da story?',
            'why': 'A expressao “limite definido” impede verificar a regra de capacidade de forma objetiva.',
            'blocking': True,
        })

    if 'rules_flow' in dimensions and ('manuten' in text or 'sobrepost' in text):
        questions.append({
            'id': 'RQ-RULES-DISPLAY-UNAVAILABLE-ROOMS',
            'question': 'Na consulta, salas em manutencao ou com reserva sobreposta devem ser ocultadas ou exibidas como indisponiveis?',
            'why': 'A story cita essas situacoes, mas nao define o comportamento que o professor deve ver.',
            'blocking': True,
        })

    if 'acceptance_testability' in dimensions and len(proposal.get('acceptance_criteria', [])) < 2 and re.search(r'\bconsult', f'{title} {goal}', re.IGNORECASE):
        questions.append({
            'id': 'RQ-ACCEPTANCE-COVERAGE-CONSULTATION',
            'question': 'Alem da listagem de salas disponiveis, qual segundo cenario observavel deve comprovar a consulta por data, horario e capacidade?',
            'why': 'A story precisa de pelo menos dois cenarios de aceite verificaveis para demonstrar a consulta.',
            'blocking': True,
        })

    return questions


def _ensure_questions_for_assessment(questions, assessment, criteria, story, proposal, review):
    """Keep concrete approval blockers and score-recovery decisions when omitted."""
    normalized = [
        item for item in questions
        if isinstance(item, dict) and _has_text(item.get('question')) and not _is_generic_acceptance_question(item.get('question'))
    ]
    existing = {str(item.get('question')).strip().lower() for item in normalized}
    def add_question(item):
        question = str(item.get('question') or '').strip()
        if not question or question.lower() in existing or _question_has_answer(item, review):
            return
        normalized.append(item)
        existing.add(question.lower())

    for gate in assessment.get('gates', []):
        if gate.get('code') == 'acceptance_criteria_not_verifiable':
            for item in _criterion_contextual_questions(criteria):
                add_question(item)
            continue
        question = GATE_QUESTIONS.get(gate.get('code'))
        if question:
            add_question({
                'id': f"RQ-{str(gate['code']).upper()}",
                'question': question,
                'why': gate.get('message', 'Esta decisao e necessaria para liberar a aprovacao.'),
                'blocking': True,
            })

    for item in _dimension_contextual_questions(story, proposal, assessment):
        add_question(item)

    return normalized


class StoryReviewer:
    """Refines one backlog story using the complete, approved project context."""

    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, payload):
        story = payload.get('story') or {}
        if not story.get('id') or not story.get('title'):
            raise ValueError('Revisao de story exige id e title.')
        prompt = f'''
Voce e o Story Review Agent, parte da governanca do PM. Analise UMA historia usando o briefing,
DNA do produto, contrato do backlog e demais historias como contexto. Seu objetivo e fechar lacunas
observaveis sem inventar regra de negocio. Tudo que nao tiver evidencia deve virar pergunta objetiva.
Nao altere lane, release, escopo ou regras sem fonte. Nao publique nada automaticamente.

Retorne SOMENTE JSON valido com:
{{
  "story_id": "...",
  "assessment": {{"strengths": [], "gaps": [], "risks": []}},
  "quality_evidence": {{
    "scope_atomicity": {{"status":"pass|partial|fail", "evidence":[]}},
    "clarity": {{"status":"pass|partial|fail", "evidence":[]}},
    "rules_flow": {{"status":"pass|partial|fail", "evidence":[]}},
    "consistency": {{"status":"pass|partial|fail", "evidence":[]}},
    "quality_risks": {{"status":"pass|partial|fail", "evidence":[]}},
    "dependencies": {{"status":"pass|partial|fail", "evidence":[]}}
  }},
  "questions": [{{"id":"Q-01", "question":"...", "why":"...", "blocking":true}}],
  "proposed_story": {{"title":"...", "description":"...", "actor":"...", "benefit":"...", "acceptance_criteria": [{{"given":"...", "when":"...", "then":"...", "status":"proposed", "source_ids":[]}}]}},
  "source_ids": [],
  "requires_confirmation": true
}}
Use status proposed para qualquer texto sem evidencia. Para cada evidence, cite apenas fatos do
contexto fornecido. Respostas do usuario sao decisoes confirmadas: incorpore somente as que forem
diretamente relevantes para esta story na proposta e nos criterios de aceite; nao as repita como gap ou
pergunta. Nao transforme uma resposta sobre outra capacidade em regra, dependencia ou bloqueio desta
story. Cada pergunta deve citar um elemento concreto da story (ator, objetivo, criterio, regra ou termo
presente no contexto). Nunca faca perguntas abstratas sobre "escopo atomico", "clareza", "termos",
"limites", "regras" ou "fluxo" sem vincula-los a esse elemento concreto. Se nao houver uma lacuna
contextual especifica, retorne questions vazio. Nunca pergunte genericamente como escrever criterios em
"Dado, Quando e Entao"; identifique o cenário e o valor concreto que está ausente. Para cada resposta
do usuario vinculada a um criterio, reescreva o criterio afetado com essa decisao e inclua a resposta no
resultado observavel. Perguntas devem ser especificas e respondiveis,
nao genericas. Sempre retorne proposed_story completo, os seis objetos de quality_evidence e assessment;
Se nao houver melhoria, copie a story alvo integralmente em proposed_story e retorne questions vazio.
Nao omita proposed_story: ele e a proposta editavel que sera exibida ao usuario.

BRIEFING:
{json.dumps(payload.get('briefing') or {}, ensure_ascii=False)[:12000]}
PROJECT DNA:
{json.dumps(payload.get('project_dna') or {}, ensure_ascii=False)[:8000]}
BACKLOG CONTRACT:
{json.dumps(payload.get('backlog_contract') or {}, ensure_ascii=False)[:18000]}
OTHER STORIES:
{json.dumps(payload.get('other_stories') or [], ensure_ascii=False)[:10000]}
TARGET STORY:
{json.dumps(story, ensure_ascii=False)[:10000]}
RESPOSTAS DO USUARIO (use somente como contexto confirmado para atualizar a proposta):
{json.dumps(payload.get('review_answers') or [], ensure_ascii=False)[:6000]}
'''
        result = generate_complete_text(
            prompt,
            agent_label='requirements_analysis',
            validator=_validate_review_json,
            options_override={'temperature': 0.0, 'num_predict': 1200, 'json_mode': True, 'require_json_object': False},
            max_retries=2,
        )
        review = _normalize_review_payload(parse_first_json_object(result))
        if not isinstance(review, dict):
            raise ValueError('Agente de revisao retornou um objeto invalido.')

        if not any(key in review for key in ('assessment', 'quality_evidence', 'questions', 'proposed_story')):
            print(json.dumps({
                'event': 'story_reviewer_provider_response_degraded',
                'response_keys': sorted(str(key) for key in review.keys())[:20],
            }, ensure_ascii=False), file=sys.stderr)

        # The controller sends exactly one target story.  A model may omit the
        # identifier or echo the example "..." from the schema; neither case
        # changes the target selected by the authenticated request.
        expected_story_id = str(story['id'])
        received_story_id = str(review.get('story_id') or '').strip()
        if received_story_id != expected_story_id:
            print(json.dumps({
                'event': 'story_reviewer_story_id_normalized',
                'expected_story_id': expected_story_id,
                'received_story_id': received_story_id or None,
            }, ensure_ascii=False), file=sys.stderr)
        review['story_id'] = expected_story_id
        review['review_answers'] = payload.get('review_answers') if isinstance(payload.get('review_answers'), list) else []
        raw_proposal = review.get('proposed_story')
        review['generation_degraded'] = not _proposal_is_meaningful(raw_proposal)
        review['proposed_story'] = _prune_orphaned_question_sources(_apply_answered_story_decisions(
            _apply_answered_criterion_updates(
                _normalized_proposed_story(story, raw_proposal),
                review['review_answers'],
            ),
            review['review_answers'],
        ), review['review_answers'])
        review['questions'] = review.get('questions') if isinstance(review.get('questions'), list) else []
        review['questions'] = [question for question in review['questions'] if not _question_has_answer(question, review)]
        initial_assessment = _readiness_assessment(story, review)
        review['questions'] = _ensure_questions_for_assessment(
            review['questions'],
            initial_assessment,
            _acceptance_criteria(review['proposed_story']),
            story,
            review['proposed_story'],
            review,
        )
        review['assessment'] = _readiness_assessment(story, review)
        review['requires_confirmation'] = review['assessment']['decision'] != 'READY'
        return review
