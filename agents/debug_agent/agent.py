# -*- coding: utf-8 -*-
import json
import re
import sys

from agents.developer.llm_service import (
    extract_json_from_text,
    generate_text_from_llm,
    is_error_text_response,
)


def _truncate(value, limit=5000):
    return str(value or "").strip()[:limit]


def _normalize_whitespace(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _make_finding(code, message, file_path="", severity="critical", suggested_fix=""):
    return {
        "code": code,
        "severity": severity,
        "filePath": file_path or "",
        "message": message,
        "suggestedFix": suggested_fix or message,
    }


def _extract_validation_logs(payload):
    reports = []
    validation_summary = payload.get("validation_summary") or {}
    if isinstance(validation_summary, dict):
      reports = validation_summary.get("reports") or []

    chunks = []
    for report in reports:
        if not isinstance(report, dict):
            continue
        script_name = report.get("scriptName") or "unknown"
        status = report.get("status") or "unknown"
        stdout = _truncate(report.get("stdout"), 2500)
        stderr = _truncate(report.get("stderr") or report.get("errorMessage"), 2500)
        chunks.append(
            f"[{script_name}] status={status}\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        )

    if chunks:
        return "\n\n".join(chunks)

    return _truncate(payload.get("error_logs") or payload.get("logs") or "Nenhum log fornecido.", 6000)


def _deterministic_analysis(payload):
    logs = _extract_validation_logs(payload)
    lower_logs = logs.lower()
    findings = []

    if "o frontend nao registrou todas as rotas das features geradas" in lower_logs:
        findings.append(
            _make_finding(
                "missing_frontend_route_registration",
                "O smoke test detectou que o frontend nao registrou todas as rotas das features presentes no app gerado.",
                "apps/web/src/App.tsx",
                suggested_fix="Registre no App.tsx apenas as features realmente presentes no app gerado e remova slices obsoletos do frontend antes do teste.",
            )
        )

    if "a api nao registrou todas as rotas das features geradas" in lower_logs:
        findings.append(
            _make_finding(
                "missing_api_route_registration",
                "O smoke test detectou que a API nao registrou todas as rotas das features presentes no app gerado.",
                "apps/api/src/server.ts",
                suggested_fix="Garanta que o server.ts registre apenas os modulos atuais e remova modulos obsoletos antes da validacao.",
            )
        )

    shared_design_match = re.search(
        r"Feature\s+([a-z0-9-]+)\s+nao\s+esta\s+usando\s+o\s+design\s+system\s+compartilhado",
        logs,
        flags=re.IGNORECASE,
    )
    if shared_design_match:
        feature_key = shared_design_match.group(1)
        findings.append(
            _make_finding(
                "missing_shared_design_system_usage",
                f"O teste detectou que a feature {feature_key} nao esta usando o design system compartilhado.",
                f"apps/web/src/features/{feature_key}/page.tsx",
                suggested_fix="Reescreva a page.tsx usando as primitivas compartilhadas esperadas pelo projeto, como SurfaceCard, FieldGroup, PrimaryButton, tokens e inputStyle.",
            )
        )

    prisma_rename_lock = re.search(
        r"EPERM:\s+operation not permitted, rename .*?node_modules\\\\\.prisma\\\\client\\\\query_engine.*?\.tmp\d+.*?query_engine",
        logs,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if prisma_rename_lock:
        findings.append(
            _make_finding(
                "prisma_engine_file_lock",
                "O Prisma falhou ao substituir o query engine no node_modules/.prisma/client por bloqueio de arquivo no Windows.",
                "node_modules/.prisma/client/query_engine-windows.dll.node",
                suggested_fix="Feche processos que estejam segurando o Prisma Client, limpe node_modules/.prisma/client e rerode db:generate antes de continuar o repair.",
            )
        )

    ts_extension_match = re.search(
        r"An import path can only end with a '\\.ts' extension.*?\n.*?([A-Za-z]:[^\r\n]+|apps/[^\r\n:]+|packages/[^\r\n:]+)",
        logs,
        flags=re.IGNORECASE,
    )
    if "allowimportingtsextensions" in lower_logs or ".ts' extension" in lower_logs:
        findings.append(
            _make_finding(
                "typescript_import_extension",
                "TypeScript rejeitou import com extensao .ts em runtime de build.",
                ts_extension_match.group(1) if ts_extension_match else "",
                suggested_fix="Remova a extensao .ts dos imports TypeScript/React gerados que participam do build.",
            )
        )

    prisma_missing = re.search(r"Cannot find module ['\"]@prisma/client['\"]", logs, flags=re.IGNORECASE)
    if prisma_missing:
        findings.append(
            _make_finding(
                "missing_prisma_client_dependency",
                "O build nao encontrou @prisma/client no projeto gerado.",
                "package.json",
                suggested_fix="Adicione @prisma/client nas dependencias do monorepo ou do workspace correto e regenere o lockfile se necessario.",
            )
        )

    module_not_found = re.search(r"Cannot find module ['\"]([^'\"]+)['\"]", logs, flags=re.IGNORECASE)
    if module_not_found:
        missing_target = module_not_found.group(1)
        findings.append(
            _make_finding(
                "module_not_found",
                f"O build/teste nao encontrou o modulo {missing_target}.",
                "",
                suggested_fix=f"Corrija o import ou garanta que o arquivo/dependencia {missing_target} exista antes de rerodar a validacao.",
            )
        )

    syntax_error = re.search(r"(SyntaxError|Unexpected token|TS1005|TS1109|TS1128)", logs, flags=re.IGNORECASE)
    if syntax_error:
        findings.append(
            _make_finding(
                "syntax_or_parse_error",
                "O compilador encontrou erro de sintaxe ou parse em arquivo gerado.",
                "",
                suggested_fix="Corrija o trecho gerado com erro de sintaxe e preserve o restante da feature.",
            )
        )

    if not findings and ("build:web" in lower_logs or "build:api" in lower_logs or "npm run test" in lower_logs):
        findings.append(
            _make_finding(
                "validation_failure_unclassified",
                "A validacao falhou, mas a causa raiz nao foi classificada deterministicamente.",
                "",
                suggested_fix="Inspecione o stderr do script que falhou e traduza a falha em uma correcao local, evitando recompor a feature inteira.",
            )
        )

    return {
        "diagnostic": _normalize_whitespace(logs[:400]),
        "rootCause": findings[0]["code"] if findings else "unknown_validation_failure",
        "suggestedFix": findings[0]["suggestedFix"] if findings else "Investigar a validacao com foco local.",
        "affectedFiles": [item["filePath"] for item in findings if item.get("filePath")],
        "findings": findings,
        "source": "debug_agent_heuristic",
    }


class DebugAgent:
    def __init__(self, project_id=None):
        self.project_id = project_id

    def _build_prompt(self, payload):
        task_objective = payload.get("objective") or "Implementacao de feature."
        error_logs = _extract_validation_logs(payload)
        file_context = payload.get("file_context") or {}
        current_context = payload.get("current_implementation_context") or {}

        return f"""
Voce e o debug_agent do Aligna.
Sua missao e analisar uma falha real de build, teste ou validacao e transformar isso em diagnostico acionavel para repair automatico.

OBJETIVO
{_truncate(task_objective, 700)}

LOGS REAIS
{_truncate(error_logs, 7000)}

CONTEXTO DE ARQUIVOS
{json.dumps(file_context, ensure_ascii=False, indent=2)[:2500]}

CURRENT IMPLEMENTATION CONTEXT
{json.dumps(current_context, ensure_ascii=False, indent=2)[:2500]}

INSTRUCOES
- Identifique a causa raiz mais provavel.
- Priorize correcao local em vez de reconstruir a feature inteira.
- Quando possivel, aponte o arquivo mais provavel a ser corrigido.
- Se o erro vier de teste de consistencia do app gerado, identifique tambem a origem de materializacao que deveria ser corrigida.
- Responda APENAS com JSON valido.

FORMATO
{{
  "diagnostic": "descricao legivel",
  "rootCause": "dependency_error | import_error | syntax_error | prisma_error | route_registration_error | validation_error | other",
  "suggestedFix": "instrucao objetiva de correcao",
  "affectedFiles": ["caminho/opcional"],
  "findings": [
    {{
      "code": "string",
      "severity": "critical | high | medium | low",
      "filePath": "string",
      "message": "string",
      "suggestedFix": "string"
    }}
  ]
}}
""".strip()

    def process(self, payload):
        heuristic = _deterministic_analysis(payload)
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.1, "num_predict": 1200},
                use_cache=False,
            )
            if not raw or is_error_text_response(raw):
                return heuristic

            parsed = extract_json_from_text(raw)
            if not isinstance(parsed, dict):
                return heuristic

            findings = parsed.get("findings")
            if not isinstance(findings, list) or not findings:
                parsed["findings"] = heuristic.get("findings", [])

            if not parsed.get("diagnostic"):
                parsed["diagnostic"] = heuristic.get("diagnostic")
            if not parsed.get("rootCause"):
                parsed["rootCause"] = heuristic.get("rootCause")
            if not parsed.get("suggestedFix"):
                parsed["suggestedFix"] = heuristic.get("suggestedFix")
            if not isinstance(parsed.get("affectedFiles"), list) or not parsed.get("affectedFiles"):
                parsed["affectedFiles"] = heuristic.get("affectedFiles", [])

            parsed["source"] = "debug_agent_llm"
            return parsed
        except Exception as exc:
            print(f"[DebugAgent Error] {exc}", file=sys.stderr)
            return heuristic
