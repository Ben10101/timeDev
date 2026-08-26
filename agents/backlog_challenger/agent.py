# -*- coding: utf-8 -*-
"""Deterministic, read-only quality review for generated backlog contracts."""
import re
import unicodedata


class BacklogChallenger:
    """Reports concrete backlog defects without generating replacement stories."""

    @staticmethod
    def _normalize(value):
        text = unicodedata.normalize("NFKD", str(value or ""))
        return "".join(char for char in text if not unicodedata.combining(char)).lower()

    def process(self, contract, evidence_contract=None):
        stories = contract.get("stories", []) if isinstance(contract, dict) else []
        findings = []
        known_ids = {str(story.get("id") or "").upper() for story in stories if isinstance(story, dict)}

        for story in stories:
            if not isinstance(story, dict):
                continue
            story_id = str(story.get("id") or "").upper()
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            question_collections = (story.get("open_questions") or [], context.get("open_questions") or [])
            has_duplicates = any(
                len(normalized) != len(set(normalized))
                for questions in question_collections
                for normalized in [[self._normalize(question) for question in questions if str(question).strip()]]
            )
            # The same questions are intentionally mirrored in both fields by
            # the contract. Only duplicates *within* one collection are a
            # repairable defect.
            if has_duplicates:
                findings.append({
                    "story_id": story_id,
                    "code": "duplicate_open_questions",
                    "reason": "A historia repete perguntas de refinamento equivalentes.",
                    "severity": "low",
                })
            for dependency in context.get("dependencies", []) if isinstance(context.get("dependencies"), list) else []:
                if str(dependency).upper() not in known_ids:
                    findings.append({
                        "story_id": story_id,
                        "code": "unknown_dependency",
                        "reason": f"Depende de {dependency}, que nao existe no contrato.",
                        "severity": "high",
                    })
            text = self._normalize(f"{story.get('goal', '')} {story.get('description', '')}")
            if re.search(r"\b(monitorar|acompanhar)\b.{0,100}\b(operacao|geral)\b", text) and not re.search(r"\b(indicador|metrica|fila|relatorio|decisao)\b", text):
                findings.append({
                    "story_id": story_id,
                    "code": "unobservable_management_scope",
                    "reason": "A historia de gestao nao declara indicador, decisao ou controle observavel.",
                    "severity": "medium",
                })

        evidence_text = " ".join(
            self._normalize(fact.get("text"))
            for fact in (evidence_contract or {}).get("facts", [])
            if isinstance(fact, dict)
        )
        backlog_text = " ".join(
            self._normalize(f"{story.get('goal', '')} {story.get('description', '')}")
            for story in stories if isinstance(story, dict)
        )
        complement_pattern = r"\bsolicit\w*\s+complement\w*\b"
        if re.search(complement_pattern, evidence_text) and not re.search(complement_pattern, backlog_text):
            decision_story = next((story for story in stories if "decis" in self._normalize(story.get("goal"))), stories[-1] if stories else {})
            findings.append({
                "story_id": str(decision_story.get("id") or "").upper(),
                "code": "missing_confirmed_flow",
                "reason": "O fluxo confirmado de solicitar complementos nao esta coberto por uma historia.",
                "severity": "high",
            })
        if re.search(r"\b(bureau|score|integrac)\w*\b", evidence_text) and not re.search(r"\b(bureau|score|integrac)\w*\b", backlog_text):
            governance_story = next(
                (story for story in stories if self._normalize(story.get("lane")) == "governance"),
                stories[-1] if stories else {},
            )
            findings.append({
                "story_id": str(governance_story.get("id") or "").upper(),
                "code": "unplanned_confirmed_integration",
                "reason": "A integracao externa confirmada no briefing nao possui historia ou lacuna planejada no backlog.",
                "severity": "medium",
            })
        return {"findings": findings}
