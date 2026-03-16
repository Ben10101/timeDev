# -*- coding: utf-8 -*-
import sys
import json
import subprocess
# Garantir UTF-8 para saída de caracteres acentuados
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf8', buffering=1)

def ensure_model_available(model: str) -> bool:
    """
    Verifica se o modelo está disponível. Se não estiver, tenta baixar.
    """
    try:
        import ollama
        models = ollama.list()
        model_names = [m.model if hasattr(m, 'model') else str(m) for m in (models.models if hasattr(models, 'models') else models)]
        
        if any(model in name for name in model_names):
            print(f"[Ollama Service] ✅ Modelo '{model}' já está disponível", file=sys.stderr)
            return True
        
        print(f"[Ollama Service] ⚠️ Modelo '{model}' não encontrado. Tentando baixar...", file=sys.stderr)
        
        try:
            import ollama
            print(f"[Ollama Service] Iniciando download de '{model}'... Isso pode levar alguns minutos.", file=sys.stderr)
            ollama.pull(model)
            print(f"[Ollama Service] ✅ Modelo '{model}' baixado com sucesso!", file=sys.stderr)
            return True
        except Exception as pull_err:
            print(f"[Ollama Service] ⚠️ Não conseguiu baixar '{model}': {pull_err}", file=sys.stderr)
            print(f"[Ollama Service] Execute manualmente: ollama pull {model}", file=sys.stderr)
            return False
            
    except Exception as e:
        print(f"[Ollama Service] ❌ Erro ao verificar modelos: {e}", file=sys.stderr)
        return False

def generate_with_ollama(prompt: str, model: str, is_json: bool = False) -> str | list:
    """
    Função genérica para gerar conteúdo usando um modelo local do Ollama.
    """
    try:
        import ollama
        
        print(f"[Ollama Service] Tentando com o modelo local: {model}...", file=sys.stderr)
        
        # Verificar e tentar baixar modelo se não existir
        if not ensure_model_available(model):
            print(f"[Ollama Service] ⚠️ Modelo '{model}' não disponível. Usando fallback...", file=sys.stderr)
            return [] if is_json else "⚠️ Modelo não disponível. Tente: ollama pull " + model
        
        # Configurações para a chamada da API
        options = {
            "temperature": 0.2 if is_json else 0.7,
        }
        
        # Formato JSON, se solicitado
        format_type = "json" if is_json else ""

        response = ollama.generate(
            model=model,
            prompt=prompt,
            format=format_type,
            options=options,
            stream=False
        )
        
        content = response['response']
        print(f"[Ollama Service] Resposta bruta recebida do modelo '{model}':", file=sys.stderr)
        print(content, file=sys.stderr)

        if is_json:
            data = json.loads(content)
            if 'attributes' in data and isinstance(data['attributes'], list):
                print(f"[Ollama Service] ✅ Modelo '{model}' retornou JSON válido!", file=sys.stderr)
                return data['attributes']
            else:
                print(f"Content {content}")
                print(f"[Ollama Service] ⚠️ Resposta JSON do modelo '{model}' não tem o formato esperado.", file=sys.stderr)
                return []
        else:
            print(f"[Ollama Service] ✅ Texto gerado com sucesso pelo modelo '{model}'!", file=sys.stderr)
            return content

    except Exception as e:
        print(f"[Ollama Service] ❌ ERRO CRÍTICO ao usar o modelo '{model}': {e}", file=sys.stderr)
        print("[Ollama Service] 📋 Verifique se o Ollama está rodando: ollama serve", file=sys.stderr)

        return [] if is_json else f"❌ ERRO: Falha ao comunicar com o Ollama. Detalhes: {e}"