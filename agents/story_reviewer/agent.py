# -*- coding: utf-8 -*-
import json
import sys

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response


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
  "assessment": {{"score": 0, "strengths": [], "gaps": [], "risks": []}},
  "questions": [{{"id":"Q-01", "question":"...", "why":"...", "blocking":true}}],
  "proposed_story": {{"title":"...", "description":"...", "actor":"...", "benefit":"...", "acceptance_criteria": [{{"given":"...", "when":"...", "then":"...", "status":"proposed", "source_ids":[]}}]}},
  "source_ids": [],
  "requires_confirmation": true
}}
Use status proposed para qualquer texto sem evidencia. Perguntas devem ser especificas e respondiveis,
nao genericas. Se a story ja estiver completa, retorne questions vazio e preserve o texto.

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
        result = generate_text_from_llm(
            prompt,
            options_override={'temperature': 0.0, 'num_predict': 1600, 'json_mode': True, 'require_json_object': True},
            use_cache=False,
            task='requirements_analysis',
        )
        if not result or is_error_text_response(result):
            raise RuntimeError('Agente de revisao nao retornou uma resposta valida.')
        review = parse_first_json_object(result)
        if not isinstance(review, dict):
            raise ValueError('Agente de revisao retornou um objeto invalido.')

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
        review['questions'] = review.get('questions') if isinstance(review.get('questions'), list) else []
        review['requires_confirmation'] = True
        return review
