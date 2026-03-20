# -*- coding: utf-8 -*-
import json
import os
import sys
import urllib.error
import urllib.request

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    import google.generativeai as genai
except ImportError:
    raise ImportError(
        "A biblioteca do Google Gemini (google-generativeai) nao esta instalada. Rode: pip install -r requirements.txt"
    )

from dotenv import load_dotenv

try:
    from .ollama_service import generate_with_ollama

    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

    def generate_with_ollama(*args, **kwargs):
        raise RuntimeError("Ollama nao esta instalado. Use pip install ollama")

try:
    from .cache_service import get_cache

    CACHE = get_cache()
    CACHE_ENABLED = True
except Exception as e:
    print(f"[LLM Service] Cache nao disponivel: {e}", file=sys.stderr)
    CACHE = None
    CACHE_ENABLED = False

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

SUPPORTED_PROVIDERS = ("gemini", "openai", "anthropic", "groq", "openrouter", "ollama")


def is_error_text_response(result: str) -> bool:
    if not isinstance(result, str):
        return False

    normalized = result.strip().lower()
    return (
        normalized.startswith("erro:")
        or normalized.startswith("❌ erro:")
        or normalized.startswith("⚠️ erro:")
        or "falha ao comunicar com o ollama" in normalized
        or normalized.startswith("modelo nao disponivel")
        or normalized.startswith("modelo não disponível")
    )


def get_provider_order():
    configured_order = [
        item.strip().lower()
        for item in os.getenv("AI_PROVIDER_ORDER", "").split(",")
        if item.strip()
    ]

    if configured_order:
        seen = set()
        ordered = []
        for provider in configured_order:
            if provider in SUPPORTED_PROVIDERS and provider not in seen:
                seen.add(provider)
                ordered.append(provider)
        if ordered:
            return ordered

    llm_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    if llm_provider in SUPPORTED_PROVIDERS and llm_provider != "auto":
        others = [provider for provider in SUPPORTED_PROVIDERS if provider not in (llm_provider, "ollama")]
        return [llm_provider, *others, "ollama"] if llm_provider != "ollama" else ["ollama"]

    return ["gemini", "openai", "anthropic", "groq", "openrouter", "ollama"]


def get_cache_provider_key():
    return ",".join(get_provider_order())


def http_post_json(url, payload, headers=None, timeout=120):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {"raw": body}
        return error.code, parsed


def extract_error_message(data):
    if not isinstance(data, dict):
        return str(data)

    metadata_raw = data.get("error", {}).get("metadata", {}).get("raw")
    if isinstance(metadata_raw, str):
        try:
            parsed = json.loads(metadata_raw)
            return parsed.get("error", {}).get("message") or metadata_raw
        except Exception:
            return metadata_raw

    return (
        data.get("error", {}).get("message")
        or data.get("message")
        or data.get("raw")
        or json.dumps(data)
    )


def generate_attributes_fallback(idea: str, error_message: str = "") -> list:
    if error_message:
        print(f"[LLM Service Fallback] Motivo do fallback: {error_message}", file=sys.stderr)

    attributes = [
        {"name": "title", "type": "string", "sql_type": "VARCHAR(255) NOT NULL"},
        {"name": "description", "type": "text", "sql_type": "TEXT"},
    ]

    idea_lower = idea.lower()
    patterns = {
        "name": {"name": "name", "type": "string", "sql_type": "VARCHAR(255)"},
        "email": {"name": "email", "type": "string", "sql_type": "VARCHAR(255) UNIQUE"},
        "phone|telefone": {"name": "phone", "type": "string", "sql_type": "VARCHAR(20)"},
        "price|preco|preço|valor": {"name": "price", "type": "number", "sql_type": "DECIMAL(10, 2)"},
        "quantity|quantidade|estoque": {"name": "quantity", "type": "number", "sql_type": "INTEGER"},
        "status": {"name": "status", "type": "string", "sql_type": "VARCHAR(50) DEFAULT 'active'"},
        "priority|prioridade": {"name": "priority", "type": "string", "sql_type": "VARCHAR(50) DEFAULT 'medium'"},
        "date|data": {"name": "date", "type": "date", "sql_type": "DATE"},
        "time|hora": {"name": "time", "type": "string", "sql_type": "TIME"},
        "category|categoria": {"name": "category", "type": "string", "sql_type": "VARCHAR(100)"},
        "tags": {"name": "tags", "type": "string", "sql_type": "VARCHAR(500)"},
        "rating|avaliacao|avaliação|nota": {"name": "rating", "type": "number", "sql_type": "DECIMAL(3, 1)"},
    }

    import re

    for pattern, attr in patterns.items():
        if re.search(pattern, idea_lower):
            if not any(a["name"] == attr["name"] for a in attributes):
                attributes.append(attr)

    print(f"[LLM Service Fallback] Gerados {len(attributes)} atributos a partir da analise de texto", file=sys.stderr)
    return attributes


def generate_text_with_gemini(prompt, model):
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY nao configurada.")

    generation_config = {"temperature": 0.7}
    model_instance = genai.GenerativeModel(model, generation_config=generation_config)
    response = model_instance.generate_content(prompt)

    if response.prompt_feedback.block_reason:
        raise RuntimeError(f"Prompt bloqueado: {response.prompt_feedback.block_reason.name}")

    if response.candidates and response.candidates[0].content.parts:
        return response.text

    raise RuntimeError("Resposta vazia do Gemini.")


def extract_text_from_openai_like(data):
    return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def generate_text_with_openai_compatible(provider, prompt, model, api_key, options_override=None):
    base_urls = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_APP_URL") or os.getenv("VITE_FRONTEND_URL") or "http://localhost:5173"
        headers["X-Title"] = os.getenv("OPENROUTER_APP_TITLE") or "Factory OS"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": (options_override or {}).get("temperature", 0.7),
        "max_tokens": max(64, int((options_override or {}).get("num_predict", 800))),
    }

    status, data = http_post_json(base_urls[provider], payload, headers=headers, timeout=120)
    if status >= 400:
        raise RuntimeError(extract_error_message(data))

    return extract_text_from_openai_like(data)


def extract_text_from_anthropic(data):
    return " ".join(
        item.get("text", "").strip()
        for item in data.get("content", [])
        if item.get("type") == "text"
    ).strip()


def generate_text_with_anthropic(prompt, model, api_key, options_override=None):
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": (options_override or {}).get("temperature", 0.7),
        "max_tokens": max(64, int((options_override or {}).get("num_predict", 800))),
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    status, data = http_post_json("https://api.anthropic.com/v1/messages", payload, headers=headers, timeout=120)
    if status >= 400:
        raise RuntimeError(extract_error_message(data))

    return extract_text_from_anthropic(data)


def generate_text_from_provider(provider, prompt, options_override=None, model_override=None):
    if provider == "ollama":
        if not OLLAMA_AVAILABLE:
            raise RuntimeError("Ollama nao esta disponivel.")
        return generate_with_ollama(
            prompt,
            model=model_override or os.getenv("OLLAMA_MODEL", "gemma3:4b"),
            is_json=False,
            options_override=options_override,
        )

    if provider == "gemini":
        return generate_text_with_gemini(prompt, os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("openai", prompt, os.getenv("OPENAI_MODEL", "gpt-4.1-mini"), api_key, options_override)

    if provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY nao configurada.")
        return generate_text_with_anthropic(prompt, os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"), api_key, options_override)

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("groq", prompt, os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), api_key, options_override)

    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("openrouter", prompt, os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini"), api_key, options_override)

    raise RuntimeError(f"Provider nao suportado: {provider}")


def extract_json_from_text(content):
    if isinstance(content, list):
        return {"attributes": content}
    if isinstance(content, dict):
        return content

    text = str(content).strip()
    start = text.find("{")
    end = text.rfind("}")
    candidate = text[start:end + 1] if start != -1 and end != -1 and end > start else text
    return json.loads(candidate)


def generate_attributes_with_provider(provider, prompt):
    if provider == "ollama":
        if not OLLAMA_AVAILABLE:
            raise RuntimeError("Ollama nao esta disponivel.")
        return generate_with_ollama(prompt, model=os.getenv("OLLAMA_MODEL", "gemma3:4b"), is_json=True)

    content = generate_text_from_provider(
        provider,
        prompt + "\n\nResponda APENAS com JSON valido no formato {\"attributes\": [...]}",
        options_override={"temperature": 0.2, "num_predict": 600},
    )
    data = extract_json_from_text(content)
    attributes = data.get("attributes", [])
    if not isinstance(attributes, list) or not attributes:
        raise RuntimeError("Resposta JSON sem lista de atributos.")
    return attributes


def get_attributes_from_llm(idea: str) -> list:
    provider_key = get_cache_provider_key()
    prompt = f"""
    Voce e um engenheiro de software senior especialista em modelagem de dados.
    Sua tarefa e analisar a ideia de um projeto de software e extrair os atributos da entidade de negocio principal.

    Ideia do Projeto: "{idea}"

    Instrucoes:
    1. Identifique a entidade principal.
    2. Extraia os atributos relevantes.
    3. Para cada atributo, determine um tipo JavaScript e um tipo SQL.
    4. Nao inclua id, user_id, created_at e updated_at.
    5. Responda APENAS com JSON valido no formato {{"attributes":[...]}}.
    """

    if CACHE_ENABLED:
        try:
            cached_response = CACHE.get(prompt, model=provider_key, provider="provider-chain")
            if cached_response:
                print("[LLM Service] CACHE HIT para atributos.", file=sys.stderr)
                return json.loads(cached_response)
        except Exception as e:
            print(f"[LLM Service] Erro ao acessar cache: {e}", file=sys.stderr)

    errors = []
    for provider in get_provider_order():
        try:
            print(f"[LLM Service] Tentando atributos com {provider}...", file=sys.stderr)
            result = generate_attributes_with_provider(provider, prompt)
            if result:
                if CACHE_ENABLED:
                    try:
                        CACHE.set(prompt, json.dumps(result), model=provider_key, provider="provider-chain", is_json=True)
                    except Exception as e:
                        print(f"[LLM Service] Erro ao guardar cache: {e}", file=sys.stderr)
                return result
        except Exception as e:
            errors.append(f"{provider}: {e}")
            print(f"[LLM Service] Falha em atributos com {provider}: {e}", file=sys.stderr)

    print("[LLM Service] Nenhum modelo de IA funcionou para atributos. Usando fallback analitico.", file=sys.stderr)
    return generate_attributes_fallback(idea, " | ".join(errors[:5]))


def generate_text_from_llm(prompt: str, model: str = None, options_override: dict | None = None, use_cache: bool = True) -> str:
    provider_key = get_cache_provider_key()

    if CACHE_ENABLED and use_cache:
        try:
            cached_response = CACHE.get(prompt, model=provider_key, provider="provider-chain")
            if cached_response:
                print("[LLM Service] CACHE HIT para texto.", file=sys.stderr)
                return cached_response
        except Exception as e:
            print(f"[LLM Service] Erro ao acessar cache: {e}", file=sys.stderr)

    provider_order = get_provider_order()

    errors = []
    for provider in provider_order:
        try:
            print(f"[LLM Service] Tentando gerar texto com {provider}...", file=sys.stderr)
            result = generate_text_from_provider(
                provider,
                prompt,
                options_override=options_override,
                model_override=model if provider == "ollama" else None,
            )
            if result and not is_error_text_response(result):
                if CACHE_ENABLED and use_cache:
                    try:
                        CACHE.set(prompt, result, model=provider_key, provider="provider-chain", is_json=False)
                    except Exception as e:
                        print(f"[LLM Service] Erro ao guardar cache: {e}", file=sys.stderr)
                return result

            raise RuntimeError("Resposta vazia ou invalida.")
        except Exception as e:
            errors.append(f"{provider}: {e}")
            print(f"[LLM Service] Falha ao gerar texto com {provider}: {e}", file=sys.stderr)

    raise RuntimeError(
        "Nenhum modelo de IA conseguiu gerar o texto solicitado. Tentativas: " + " | ".join(errors[:5])
    )
