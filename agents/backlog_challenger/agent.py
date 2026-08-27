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
        proposals = []
        questions = []
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
            action_count = len(re.findall(r"\b(criar|configurar|definir|aprovar|rejeitar|executar|acompanhar|encerrar|analisar|editar|enviar)\b", text))
            if action_count >= 3:
                findings.append({
                    "story_id": story_id,
                    "code": "needs_split_or_scope",
                    "reason": "A historia combina varias acoes de produto e deve ser dividida em entregas atomicas.",
                    "severity": "medium",
                })
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
        campaign_domain = bool(re.search(r"\b(campanh|cobran|devedor|inadimpl|recuperac)\b", evidence_text))
        domain = "credit_collection_campaign" if campaign_domain else "generic"
        if campaign_domain:
            capability_rules = {
                "segmentacao": r"segment",
                "aprovacao": r"aprov|reprov|decis",
                "execucao": r"execut|dispar|envio",
                "resultado": r"resultado|pagamento|recuperac|metrica",
            }
            for capability, pattern in capability_rules.items():
                if not re.search(pattern, backlog_text):
                    proposals.append({
                        "type": "story",
                        "capability": capability,
                        "status": "proposed",
                        "reason": "Capacidade relevante do dominio nao esta coberta pelo backlog.",
                        "requires_confirmation": True,
                    })
                    questions.append({
                        "code": "missing_domain_decision",
                        "question": f"A campanha deve incluir explicitamente a capacidade de {capability}?",
                        "requires_confirmation": True,
                    })
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
        critical = sum(1 for item in findings if item.get("severity") == "critical")
        high = sum(1 for item in findings if item.get("severity") == "high")
        medium = sum(1 for item in findings if item.get("severity") == "medium")
        score = max(0, 100 - critical * 30 - high * 15 - medium * 8 - len(proposals) * 5)
        dimensions = {
            "domain_coverage": 25 if not proposals else max(0, 25 - len(proposals) * 6),
            "traceability": 20 if all(story.get("source_ids") for story in stories if isinstance(story, dict)) else 0,
            "absence_of_invention": 25 if not any(item.get("code") == "unconfirmed_context" for item in findings) else 0,
            "testability": 15 if all((story.get("refinement_context") or {}).get("acceptance_criteria") for story in stories if isinstance(story, dict)) else 0,
            "coherence": 15 if not any(item.get("code") in {"needs_split_or_scope", "release_dependency_conflict"} for item in findings) else 0,
        }
        decision = "BLOCK" if critical else ("REVISE" if findings or proposals or questions else "PASS")
        return {
            "decision": decision,
            "domain": domain,
            "findings": findings,
            "proposals": proposals,
            "questions": questions,
            "score": score,
            "threshold": 80,
            "dimensions": dimensions,
        }
