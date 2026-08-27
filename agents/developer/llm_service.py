# -*- coding: utf-8 -*-
import json
import os
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import urllib.error
import urllib.request

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

GEMINI_SDK = None
genai = None
google_genai = None

try:
    from google import genai as google_genai

    GEMINI_SDK = "google-genai"
except ImportError:
    try:
        import google.generativeai as genai

        GEMINI_SDK = "google-generativeai"
    except ImportError:
        raise ImportError(
            "Nenhuma biblioteca Gemini foi encontrada. Rode: pip install -r requirements.txt"
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

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"), override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    if GEMINI_SDK == "google-generativeai":
        genai.configure(api_key=GEMINI_API_KEY)

SUPPORTED_PROVIDERS = ("gemini", "openai", "deepseek", "nvidia", "anthropic", "groq", "openrouter", "ollama")


class ProviderRateLimitError(RuntimeError):
    """A transient 429 response, optionally carrying the Retry-After delay."""

    def __init__(self, message, retry_after_seconds=None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


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


def validate_structured_response(result: str, options_override: dict | None = None) -> str | None:
    """Return a provider-quality error when a structured response is unusable.

    This quality gate runs *inside* the model router.  A provider that returns
    a tiny refusal or non-JSON text no longer counts as a successful attempt,
    allowing the router to try the next configured model.
    """
    options = options_override or {}
    text = str(result or "").strip()
    try:
        minimum_length = max(0, int(options.get("min_response_chars", 0) or 0))
    except (TypeError, ValueError):
        minimum_length = 0
    if minimum_length and len(text) < minimum_length:
        return f"Resposta curta para contrato estruturado ({len(text)} caracteres; minimo {minimum_length})."
    if not options.get("require_json_object"):
        return None

    decoder = json.JSONDecoder()
    for index, char in enumerate(text.lstrip("\ufeff")):
        if char != "{":
            continue
        try:
            candidate, _ = decoder.raw_decode(text.lstrip("\ufeff")[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(candidate, dict):
            return None
    return "Resposta sem objeto JSON completo."


def get_provider_order():
    agent_name = str(os.getenv("AI_AGENT_NAME", "") or "").strip().lower()
    agent_suffix = agent_name.upper().replace("-", "_") if agent_name else ""

    disable_ollama_value = (
        os.getenv(f"AI_DISABLE_OLLAMA_FALLBACK_{agent_suffix}") if agent_suffix else None
    ) or os.getenv("AI_DISABLE_OLLAMA_FALLBACK", "1")
    disable_ollama_fallback = str(disable_ollama_value).lower() in ("1", "true", "yes")

    configured_order_value = (
        os.getenv(f"AI_PROVIDER_ORDER_{agent_suffix}") if agent_suffix else None
    ) or os.getenv("AI_PROVIDER_ORDER", "")
    configured_order = [
        item.strip().lower()
        for item in configured_order_value.split(",")
        if item.strip()
    ]

    if configured_order:
        seen = set()
        ordered = []
        for provider in configured_order:
            if provider in SUPPORTED_PROVIDERS and provider not in seen:
                if disable_ollama_fallback and provider == "ollama":
                    continue
                seen.add(provider)
                ordered.append(provider)
        if ordered:
            return ordered

    llm_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    if llm_provider in SUPPORTED_PROVIDERS and llm_provider != "auto":
        others = [
            provider
            for provider in SUPPORTED_PROVIDERS
            if provider not in (llm_provider, "ollama") and (not disable_ollama_fallback or provider != "ollama")
        ]
        if llm_provider == "ollama":
            if disable_ollama_fallback:
                return [provider for provider in SUPPORTED_PROVIDERS if provider != "ollama"]
            return ["ollama"]
        return [llm_provider, *others] if disable_ollama_fallback else [llm_provider, *others, "ollama"]

    fallback_order = ["gemini", "openai", "deepseek", "nvidia", "anthropic", "groq", "openrouter", "ollama"]
    return [provider for provider in fallback_order if not (disable_ollama_fallback and provider == "ollama")]


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
            return response.status, json.loads(body) if body else {}, dict(response.headers.items())
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {"raw": body}
        return error.code, parsed, dict(error.headers.items()) if error.headers else {}


def get_retry_after_seconds(headers):
    value = next((value for key, value in (headers or {}).items() if key.lower() == "retry-after"), None)
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        try:
            retry_at = parsedate_to_datetime(str(value))
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, IndexError):
            return None


def raise_for_rate_limit(status, data, headers):
    if status == 429:
        raise ProviderRateLimitError(
            extract_error_message(data) or "Too Many Requests",
            get_retry_after_seconds(headers),
        )


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


def generate_text_with_gemini(prompt, model, options_override=None):
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY nao configurada.")

    options = options_override or {}
    generation_config = {"temperature": options.get("temperature", 0.7)}
    # Gemini supports a native JSON MIME type.  Prefer it whenever an agent is
    # producing a contract, instead of relying solely on prompt compliance.
    if options.get("json_mode"):
        generation_config["response_mime_type"] = "application/json"

    if GEMINI_SDK == "google-genai":
        client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=generation_config,
        )
        text = getattr(response, "text", None)
        if text and str(text).strip():
            return str(text).strip()
        raise RuntimeError("Resposta vazia do Gemini.")

    model_instance = genai.GenerativeModel(model, generation_config=generation_config)
    response = model_instance.generate_content(
        prompt,
        request_options={
            "timeout": get_provider_timeout_seconds("gemini", 120, options_override),
        },
    )

    if response.prompt_feedback.block_reason:
        raise RuntimeError(f"Prompt bloqueado: {response.prompt_feedback.block_reason.name}")

    if response.candidates and response.candidates[0].content.parts:
        return response.text

    raise RuntimeError("Resposta vazia do Gemini.")


def compact_prompt(prompt, ratio):
    text = str(prompt or "").strip()
    if ratio >= 0.98 or len(text) < 400:
        return text

    target_length = max(240, int(len(text) * max(0.35, min(ratio, 0.95))))
    head_length = int(target_length * 0.72)
    tail_length = max(80, target_length - head_length)
    if head_length + tail_length >= len(text):
        return text
    return f"{text[:head_length].rstrip()}\n\n[...conteudo resumido automaticamente...]\n\n{text[-tail_length:].lstrip()}"


def extract_text_from_openai_like(data):
    """Extract text without assuming providers always return message.content.

    Some OpenAI-compatible providers return ``content: null`` for an interrupted,
    filtered or otherwise empty completion.  Treat it as an empty response so the
    router can retry another candidate instead of crashing with ``None.strip()``.
    """
    if not isinstance(data, dict):
        return ""
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    choice = choices[0] if isinstance(choices[0], dict) else {}
    message = choice.get("message") if isinstance(choice, dict) else {}
    content = message.get("content") if isinstance(message, dict) else None
    return content.strip() if isinstance(content, str) else ""


def parse_model_list(value):
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        items = value
    else:
        items = re.split(r"[\n,;]+", str(value))
    return [str(item).strip() for item in items if str(item).strip()]


def get_provider_timeout_seconds(provider, default_timeout=120, options_override=None):
    requested_timeout = (options_override or {}).get("request_timeout_seconds")
    if requested_timeout is not None:
        try:
            return max(30, int(requested_timeout))
        except (TypeError, ValueError):
            pass
    specific_key = f"{str(provider or '').upper()}_REQUEST_TIMEOUT_SECONDS"
    candidate = os.getenv(specific_key) or os.getenv("LLM_REQUEST_TIMEOUT_SECONDS")
    try:
        timeout = int(candidate) if candidate else int(default_timeout)
    except Exception:
        timeout = int(default_timeout)
    return max(30, timeout)


def get_openrouter_model_candidates(primary_model):
    candidates = []
    for candidate in [primary_model, *parse_model_list(os.getenv("OPENROUTER_MODEL_FALLBACKS", ""))]:
        if str(candidate).strip().lower() in {"openrouter/free", "qwen/qwen3-coder:free"}:
            continue
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    if not candidates:
        candidates.append("openai/gpt-4.1-mini")
    return candidates


def should_fallback_openrouter_model(error_message):
    normalized = str(error_message or "").strip().lower()
    if not normalized:
        return False

    patterns = (
        r"prompt tokens limit exceeded",
        r"context length",
        r"context window",
        r"maximum context length",
        r"input.*too long",
        r"token limit",
        r"max tokens",
        r"can only afford",
        r"capacity",
        r"temporarily unavailable",
        r"no endpoints found",
        r"resposta vazia ou invalida",
    )
    return any(re.search(pattern, normalized, re.I) for pattern in patterns)


def generate_text_with_openrouter_model(prompt, model, api_key, options_override=None):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": os.getenv("OPENROUTER_APP_URL") or os.getenv("VITE_FRONTEND_URL") or "http://localhost:5173",
        "X-Title": os.getenv("OPENROUTER_APP_TITLE") or "Factory OS",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": (options_override or {}).get("temperature", 0.7),
        "max_tokens": max(64, int((options_override or {}).get("num_predict", 800))),
    }
    if (options_override or {}).get("json_mode"):
        payload["response_format"] = {"type": "json_object"}

    attempts = [payload]
    tried_prompt_compaction = False

    while attempts:
        current_payload = attempts.pop(0)
        status, data, response_headers = http_post_json(
            "https://openrouter.ai/api/v1/chat/completions",
            current_payload,
            headers=headers,
            timeout=get_provider_timeout_seconds("openrouter", 180, options_override),
        )
        if status < 400:
            result = extract_text_from_openai_like(data)
            if result:
                return result
            raise RuntimeError("Resposta vazia ou invalida.")

        raise_for_rate_limit(status, data, response_headers)

        error_message = extract_error_message(data)
        if current_payload.get("response_format") and re.search(r"response_format|json.?mode|unsupported", error_message or "", re.I):
            attempts.insert(0, {key: value for key, value in current_payload.items() if key != "response_format"})
            continue
        affordable_match = re.search(r"can only afford\s+(\d+)", error_message or "", re.I)
        if affordable_match:
            affordable_tokens = int(affordable_match.group(1))
            if affordable_tokens >= 64 and affordable_tokens < current_payload["max_tokens"]:
                attempts.append({
                    **current_payload,
                    "max_tokens": max(64, affordable_tokens - 16),
                })
                continue

        prompt_limit_match = re.search(r"Prompt tokens limit exceeded:\s*(\d+)\s*>\s*(\d+)", error_message or "", re.I)
        if prompt_limit_match and not tried_prompt_compaction:
            requested_tokens = max(1, int(prompt_limit_match.group(1)))
            limit_tokens = max(1, int(prompt_limit_match.group(2)))
            ratio = min(0.9, limit_tokens / requested_tokens)
            attempts.append({
                **current_payload,
                "messages": [{
                    "role": "user",
                    "content": compact_prompt(prompt, ratio),
                }],
            })
            tried_prompt_compaction = True
            continue

        raise RuntimeError(error_message)

    raise RuntimeError("Falha inesperada ao gerar texto com OpenRouter.")


def generate_text_with_openai_compatible(provider, prompt, model, api_key, options_override=None):
    base_urls = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "deepseek": "https://api.deepseek.com/chat/completions",
        "nvidia": "https://integrate.api.nvidia.com/v1/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
    }
    if provider == "openrouter":
        candidates = get_openrouter_model_candidates(model)
        openrouter_errors = []
        for index, candidate_model in enumerate(candidates):
            try:
                print(f"[LLM Service] OpenRouter tentando modelo: {candidate_model}", file=sys.stderr)
                return generate_text_with_openrouter_model(prompt, candidate_model, api_key, options_override)
            except Exception as error:
                if isinstance(error, ProviderRateLimitError):
                    raise
                error_message = str(error)
                openrouter_errors.append(f"{candidate_model}: {error_message}")
                if should_fallback_openrouter_model(error_message) and index < len(candidates) - 1:
                    print(f"[LLM Service] OpenRouter trocando para fallback apos falha em {candidate_model}: {error_message}", file=sys.stderr)
                    continue
                raise RuntimeError(" | ".join(openrouter_errors))

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": (options_override or {}).get("temperature", 0.7),
        "max_tokens": max(64, int((options_override or {}).get("num_predict", 800))),
    }
    if (options_override or {}).get("json_mode"):
        payload["response_format"] = {"type": "json_object"}

    status, data, response_headers = http_post_json(
        base_urls[provider],
        payload,
        headers=headers,
        timeout=get_provider_timeout_seconds(provider, 180 if provider == "nvidia" else 120, options_override),
    )
    if status < 400:
        return extract_text_from_openai_like(data)

    raise_for_rate_limit(status, data, response_headers)
    raise RuntimeError(extract_error_message(data))


def extract_text_from_anthropic(data):
    return " ".join(
        item.get("text", "").strip()
        for item in data.get("content", [])
        if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)
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
    status, data, response_headers = http_post_json(
        "https://api.anthropic.com/v1/messages",
        payload,
        headers=headers,
        timeout=get_provider_timeout_seconds("anthropic", 180),
    )
    if status >= 400:
        raise_for_rate_limit(status, data, response_headers)
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
        return generate_text_with_gemini(
            prompt,
            model_override or os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
            options_override,
        )

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("openai", prompt, model_override or os.getenv("OPENAI_MODEL", "gpt-4.1-mini"), api_key, options_override)

    if provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY nao configurada.")
        return generate_text_with_anthropic(prompt, model_override or os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"), api_key, options_override)

    if provider == "deepseek":
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("deepseek", prompt, model_override or os.getenv("DEEPSEEK_MODEL", "deepseek-chat"), api_key, options_override)

    if provider == "nvidia":
        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            raise RuntimeError("NVIDIA_API_KEY nao configurada.")
        return generate_text_with_openai_compatible("nvidia", prompt, model_override or os.getenv("NVIDIA_MODEL", "qwen/qwen3.5-122b-a10b"), api_key, options_override)

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY nao configurada.")
        model = model_override or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        if str(model).lower() == "qwen/qwen3.6-27b":
            model = "llama-3.3-70b-versatile"
        return generate_text_with_openai_compatible("groq", prompt, model, api_key, options_override)

    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY nao configurada.")
        model = model_override or os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini")
        if str(model).lower() in {"openrouter/free", "qwen/qwen3-coder:free"}:
            model = "openai/gpt-4.1-mini"
        return generate_text_with_openai_compatible("openrouter", prompt, model, api_key, options_override)

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


def generate_text_from_llm(prompt: str, model: str = None, options_override: dict | None = None, use_cache: bool = True, task: str = None) -> str:
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

    from .model_router import execute_routed_text

    def execute_provider(provider, selected_model, selected_options):
        print(f"[LLM Service] Tentando gerar texto com {provider}...", file=sys.stderr)
        result = generate_text_from_provider(
            provider,
            prompt,
            options_override=selected_options,
            # O parametro model legado sempre foi exclusivo do Ollama. Mantemos esse
            # contrato e permitimos que o router escolha os demais modelos.
            model_override=model if provider == "ollama" and model else selected_model,
        )
        if not result or is_error_text_response(result):
            raise RuntimeError("Resposta vazia ou invalida.")
        structured_error = validate_structured_response(result, selected_options)
        if structured_error:
            raise RuntimeError(structured_error)
        return result

    result, _metadata = execute_routed_text(
        prompt,
        task=task,
        options_override=options_override,
        provider_order=provider_order,
        provider_executor=execute_provider,
    )
    if CACHE_ENABLED and use_cache:
        try:
            CACHE.set(prompt, result, model=provider_key, provider="provider-chain", is_json=False)
        except Exception as e:
            print(f"[LLM Service] Erro ao guardar cache: {e}", file=sys.stderr)
    return result
