# -*- coding: utf-8 -*-
import json
import os
import sys

# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)


def get_ollama_client():
    import ollama

    host = os.getenv('OLLAMA_HOST', 'http://127.0.0.1:11434')
    timeout_seconds = float(os.getenv('OLLAMA_REQUEST_TIMEOUT_SECONDS', '120'))
    return ollama.Client(host=host, timeout=timeout_seconds)


def ensure_model_available(model: str) -> bool:
    """
    Verifica se o modelo está disponível. Se não estiver, tenta baixar.
    """
    try:
        client = get_ollama_client()
        models = client.list()
        model_names = [m.model if hasattr(m, 'model') else str(m) for m in (models.models if hasattr(models, 'models') else models)]

        if any(model in name for name in model_names):
            print(f"[Ollama Service] Modelo '{model}' já está disponível", file=sys.stderr)
            return True

        print(f"[Ollama Service] Modelo '{model}' não encontrado. Tentando baixar...", file=sys.stderr)

        try:
            print(f"[Ollama Service] Iniciando download de '{model}'... Isso pode levar alguns minutos.", file=sys.stderr)
            client.pull(model)
            print(f"[Ollama Service] Modelo '{model}' baixado com sucesso!", file=sys.stderr)
            return True
        except Exception as pull_err:
            print(f"[Ollama Service] Não conseguiu baixar '{model}': {pull_err}", file=sys.stderr)
            print(f"[Ollama Service] Execute manualmente: ollama pull {model}", file=sys.stderr)
            return False

    except Exception as e:
        print(f"[Ollama Service] Erro ao verificar modelos: {e}", file=sys.stderr)
        return False


def generate_with_ollama(
    prompt: str,
    model: str,
    is_json: bool = False,
    options_override: dict | None = None,
) -> str | list:
    """
    Função genérica para gerar conteúdo usando um modelo local do Ollama.
    """
    try:
        print(f"[Ollama Service] Tentando com o modelo local: {model}...", file=sys.stderr)

        if not ensure_model_available(model):
            print(f"[Ollama Service] Modelo '{model}' não disponível. Usando fallback...", file=sys.stderr)
            return [] if is_json else "Modelo não disponível. Tente: ollama pull " + model

        options = {
            "temperature": 0.2 if is_json else 0.7,
        }
        if options_override:
            options.update(options_override)

        format_type = "json" if is_json else ""
        client = get_ollama_client()

        response = client.generate(
            model=model,
            prompt=prompt,
            format=format_type,
            options=options,
            stream=False,
        )

        content = response['response']
        print(f"[Ollama Service] Resposta bruta recebida do modelo '{model}':", file=sys.stderr)
        print(content, file=sys.stderr)

        if is_json:
            data = json.loads(content)
            if 'attributes' in data and isinstance(data['attributes'], list):
                print(f"[Ollama Service] Modelo '{model}' retornou JSON válido!", file=sys.stderr)
                return data['attributes']

            print(f"Content {content}")
            print(f"[Ollama Service] Resposta JSON do modelo '{model}' não tem o formato esperado.", file=sys.stderr)
            return []

        print(f"[Ollama Service] Texto gerado com sucesso pelo modelo '{model}'!", file=sys.stderr)
        return content

    except Exception as e:
        print(f"[Ollama Service] ERRO CRÍTICO ao usar o modelo '{model}': {e}", file=sys.stderr)
        print("[Ollama Service] Verifique se o Ollama está rodando: ollama serve", file=sys.stderr)
        return [] if is_json else f"ERRO: Falha ao comunicar com o Ollama. Detalhes: {e}"
