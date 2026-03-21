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
    return {
        "navigationLabel": payload.get("navigationLabel") or "Feature",
        "pageTitle": payload.get("pageTitle") or "Execute esta jornada",
        "pageDescription": payload.get("pageDescription") or payload.get("summary") or "",
        "heroEyebrow": payload.get("navigationLabel") or "Feature",
        "heroTitle": payload.get("pageTitle") or "Execute esta jornada",
        "heroDescription": payload.get("pageDescription") or payload.get("summary") or "",
        "formCardTitle": "Dados principais",
        "formCardDescription": "Preencha os dados essenciais para concluir a operacao com seguranca.",
        "submitLabel": submit_label,
        "highlights": [
            "Fluxo pensado para reduzir duvidas no preenchimento.",
            "Feedback claro ao concluir ou revisar a operacao."
        ],
        "recordsTitle": "Registros recentes",
        "recordsEmptyState": "Nenhum registro disponivel ainda.",
    }


def main():
    payload = json.load(sys.stdin)

    prompt = f"""
Voce e um especialista em UX writing e product design para interfaces SaaS premium.
Sua tarefa e gerar apenas uma proposta curta de copy e estrutura visual para UMA tela de produto.

Contexto da implementacao:
- Titulo da task: {payload.get('taskTitle')}
- Resumo: {payload.get('summary')}
- Rota frontend: {payload.get('frontendRoute')}
- Template de tela: {payload.get('screenTemplate')}
- Acao principal: {payload.get('submitLabel')}
- Campos: {json.dumps(payload.get('fields', []), ensure_ascii=False)}
- Objetivos de experiencia: {json.dumps(payload.get('experienceGoals', []), ensure_ascii=False)}
- Estados de UI: {json.dumps(payload.get('uiStates', {}), ensure_ascii=False)}
- Validacoes: {json.dumps(payload.get('validationSummary', []), ensure_ascii=False)}
- Permissoes: {json.dumps(payload.get('permissions', {}), ensure_ascii=False)}
- Memoria do projeto: {json.dumps(payload.get('projectMemory', {}), ensure_ascii=False)}
- Contexto de reparo: {json.dumps(payload.get('repairContext'), ensure_ascii=False)}

Instrucoes:
- Nao replique requisitos longos, QA, criterios de aceite ou documentacao na tela.
- Escreva como uma interface real de produto, curta e objetiva.
- Mantenha linguagem em portugues do Brasil.
- Priorize titulos curtos, orientados a usuario final.
- Evite tom tecnico, burocratico ou academico.
- Proponha uma tela com cara de produto pronto, nao de prototipo.
- Se o template for `settings`, use copy de configuracao/autogestao.
- Se o template for `wizard`, use copy de etapas e progressao.
- Se o template for `dashboard`, use copy orientada a visao geral, metricas e acompanhamento.
- Se o template for `crud`, use copy de cadastro/listagem com valor percebido.
- Prefira textos que transmitam clareza, confianca e valor percebido.
- Os highlights devem parecer beneficios reais da experiencia, nunca instrucoes internas do sistema.
- Se houver memoria do projeto, reaproveite os padroes bem avaliados e evite repetir achados recorrentes.
- Se houver contexto de reparo, use-o para evitar repetir os mesmos problemas da tentativa anterior.
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
        raw = generate_text_from_llm(prompt)
        data = extract_json_block(raw)
        print(json.dumps({"success": True, "data": data}, ensure_ascii=False))
    except Exception:
        print(json.dumps({"success": True, "data": fallback(payload)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
