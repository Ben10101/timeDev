# -*- coding: utf-8 -*-
import os
import sys
import json

# Garantir UTF-8 para saída (evitar reabrir handles no Windows, o que pode causar crash em processos com pipes)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    import google.generativeai as genai # Usando a biblioteca oficial do Google
except ImportError:
    # Levanta um erro claro se a biblioteca não estiver instalada.
    raise ImportError("A biblioteca do Google Gemini (google-generativeai) não está instalada. Por favor, rode: pip install -r requirements.txt")
from dotenv import load_dotenv

# Importação opcional do serviço Ollama
try:
    from .ollama_service import generate_with_ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    def generate_with_ollama(*args, **kwargs):
        raise RuntimeError("Ollama não está instalado. Use pip install ollama")

# Importação do cache service
try:
    from .cache_service import get_cache
    CACHE = get_cache()
    CACHE_ENABLED = True
except Exception as e:
    print(f"[LLM Service] ⚠️  Cache não disponível: {e}", file=sys.stderr)
    CACHE = None
    CACHE_ENABLED = False # Desabilitar cache se houver erro na inicialização

# Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def generate_attributes_fallback(idea: str, error_message: str = "") -> list:
    """
    Fallback inteligente para gerar atributos sem chamar LLM.
    Usa análise de texto para extrair campos mencionados na ideia.
    """
    if error_message:
        print(f"[LLM Service Fallback] Motivo do fallback: {error_message}", file=sys.stderr)
    attributes = [
        {"name": "title", "type": "string", "sql_type": "VARCHAR(255) NOT NULL"},
        {"name": "description", "type": "text", "sql_type": "TEXT"},
    ]
    
    idea_lower = idea.lower()
    
    # Mapear palavras-chave para atributos
    patterns = {
        'name': {"name": "name", "type": "string", "sql_type": "VARCHAR(255)"},
        'email': {"name": "email", "type": "string", "sql_type": "VARCHAR(255) UNIQUE"},
        'phone|telefone': {"name": "phone", "type": "string", "sql_type": "VARCHAR(20)"},
        'price|preço|valor': {"name": "price", "type": "number", "sql_type": "DECIMAL(10, 2)"},
        'quantity|quantidade|estoque': {"name": "quantity", "type": "number", "sql_type": "INTEGER"},
        'status': {"name": "status", "type": "string", "sql_type": "VARCHAR(50) DEFAULT 'active'"},
        'priority|prioridade': {"name": "priority", "type": "string", "sql_type": "VARCHAR(50) DEFAULT 'medium'"},
        'date|data': {"name": "date", "type": "date", "sql_type": "DATE"},
        'time|hora': {"name": "time", "type": "string", "sql_type": "TIME"},
        'category|categoria': {"name": "category", "type": "string", "sql_type": "VARCHAR(100)"},
        'tags': {"name": "tags", "type": "string", "sql_type": "VARCHAR(500)"},
        'rating|avaliação|nota': {"name": "rating", "type": "number", "sql_type": "DECIMAL(3, 1)"},
    }
    
    import re
    for pattern, attr in patterns.items():
        if re.search(pattern, idea_lower):
            # Verificar se o atributo já existe
            if not any(a['name'] == attr['name'] for a in attributes):
                attributes.append(attr)
    
    print(f"[LLM Service Fallback] Gerados {len(attributes)} atributos a partir da análise de texto", file=sys.stderr)
    return attributes

def generate_text_fallback(prompt: str, error_message: str = "") -> str:
    """
    Fallback para geração de texto. Retorna um template estruturado.
    """
    print(f"[LLM Service Fallback] Usando template para texto livre", file=sys.stderr)
    if error_message:
        print(f"[LLM Service Fallback] Motivo do fallback: {error_message}", file=sys.stderr)
    return """
# Documentação Gerada

## Resumo
Este é um documento gerado automaticamente a partir dos requisitos do projeto.

## Estrutura
O projeto foi estruturado com:
- Frontend responsivo com componentes reutilizáveis
- Backend com APIs RESTful
- Banco de dados relacional estruturado
- Autenticação e controle de acesso

## Próximos Passos
1. Personalizar os componentes conforme necessário
2. Implementar lógica de negócios específica
3. Adicionar testes automatizados
4. Fazer deploy na infraestrutura desejada
"""

def get_attributes_from_llm(idea: str) -> list:
    """
    Chama um LLM para extrair atributos de uma entidade a partir de uma ideia.
    """
    # Determina o provedor e modelo em tempo de execução para maior robustez
    # Prioridade: local (Ollama) quando possível.
    llm_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    # OLLAMA_MODEL agora é definido no .env ou no script de teste
    ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:4b")

    prompt = f"""
    Você é um engenheiro de software sênior especialista em modelagem de dados.
    Sua tarefa é analisar a ideia de um projeto de software e extrair os atributos da entidade de negócio principal.

    Ideia do Projeto: "{idea}"

    Instruções:
    1.  Identifique a entidade principal (ex: "Produto", "Carro", "Cliente").
    2.  Extraia os atributos relevantes para essa entidade com base na descrição.
    3.  Para cada atributo, determine um tipo de dado JavaScript ('string', 'text', 'number', 'boolean', 'date') e um tipo de dado SQL apropriado (ex: 'VARCHAR(255) NOT NULL', 'TEXT', 'INTEGER', 'DECIMAL(10, 2)', 'BOOLEAN', 'DATE').
    4.  Se a ideia mencionar "status" ou "prioridade", inclua-os como atributos.
    5.  Não inclua os campos 'id', 'user_id', 'created_at', 'updated_at', pois eles são adicionados automaticamente.
    6.  Responda **APENAS** com um objeto JSON válido, sem nenhum texto ou explicação adicional.

    O formato do JSON de saída deve ser o seguinte:
    {{
      "attributes": [
        {{
          "name": "nome_do_atributo_em_snake_case",
          "type": "tipo_javascript",
          "sql_type": "TIPO_SQL"
        }}
      ]
    }}

    Exemplo para a ideia "Sistema de gestão de estoque de sapatos com nome, preço e quantidade":
    {{
      "attributes": [
        {{ "name": "name", "type": "string", "sql_type": "VARCHAR(255) NOT NULL" }},
        {{ "name": "price", "type": "number", "sql_type": "DECIMAL(10, 2)" }},
        {{ "name": "stock", "type": "number", "sql_type": "INTEGER" }}
      ]
    }}
    """

    # ✅ CACHE CHECK: Verificar cache antes de qualquer chamada ao LLM
    if CACHE_ENABLED:
        try:
            cached_response = CACHE.get(prompt, model=llm_provider, provider=llm_provider)
            if cached_response:
                print("[LLM Service] ✅ CACHE HIT! Usando resposta cacheada para atributos.", file=sys.stderr)
                return json.loads(cached_response)
        except Exception as e:
            print(f"[LLM Service] ⚠️ Erro ao acessar cache: {e}", file=sys.stderr)

    # Tentar com Ollama (local) primeiro quando disponível, exceto se forçado gemini
    should_try_ollama = OLLAMA_AVAILABLE and llm_provider in ("auto", "ollama")
    if should_try_ollama:
        try:
            result = generate_with_ollama(prompt, model=ollama_model, is_json=True)
            # ✅ CACHE STORE: Guardar resultado após sucesso
            if result: # Se o Ollama retornou algo válido
                if CACHE_ENABLED:
                    try:
                        CACHE.set(prompt, json.dumps(result), model=ollama_model, provider="ollama", is_json=True)
                    except Exception as e:
                        print(f"[LLM Service] ⚠️ Erro ao guardar cache: {e}", file=sys.stderr)
                return result
            else: # Ollama retornou vazio ou com erro interno
                print(f"[LLM Service] Ollama retornou vazio ou com erro. Usando Gemini como fallback...", file=sys.stderr)
        except Exception as e:
            print(f"[LLM Service] ❌ Erro ao chamar Ollama: {e}. Usando Gemini como fallback...", file=sys.stderr)

    # Se forçado a usar apenas Ollama e falhou, usar fallback local (sem Gemini)
    if llm_provider == "ollama":
        return generate_attributes_fallback(idea, "Ollama falhou ou não retornou JSON válido.")

    # Tentar com Gemini se configurado e disponível
    # Lista de modelos para tentar, em ordem de preferência.
    models_to_try = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
    ]

    if not GEMINI_API_KEY:
        print("[LLM Service] ⚠️ GEMINI_API_KEY não configurada. Não é possível usar Gemini. Usando fallback...", file=sys.stderr)
        return generate_attributes_fallback(idea, "GEMINI_API_KEY não configurada.")

    if not genai.configure: # Verifica se a configuração do Gemini foi bem-sucedida
        print("[LLM Service] ⚠️ Configuração do Gemini falhou. Usando fallback...", file=sys.stderr)
        return generate_attributes_fallback(idea, "Configuração do Gemini falhou.")


    for model_name in models_to_try:
        try:
            print(f"[LLM Service] Tentando com o modelo: {model_name}...", file=sys.stderr)
            generation_config = {
              "temperature": 0.2,
              "response_mime_type": "application/json",
            }
            model = genai.GenerativeModel(
                model_name,
                generation_config=generation_config
            )
            print("[LLM Service] Enviando prompt para o Gemini...", file=sys.stderr)
            response = model.generate_content(prompt)

            # Verificação de segurança e conteúdo da resposta
            if response.prompt_feedback.block_reason:
                print(f"[LLM Service] ⚠️ Prompt bloqueado pelo modelo '{model_name}'. Razão: {response.prompt_feedback.block_reason.name}", file=sys.stderr)
                continue

            content = response.text
            print(f"[LLM Service] Resposta bruta recebida do modelo '{model_name}':", file=sys.stderr)
            print(content, file=sys.stderr)

            data = json.loads(content)
            
            if 'attributes' in data and isinstance(data['attributes'], list):
                print(f"[LLM Service] ✅ Modelo '{model_name}' funcionou!", file=sys.stderr)
                # ✅ CACHE STORE: Guardar resultado após sucesso
                if CACHE_ENABLED:
                    try:
                        CACHE.set(prompt, json.dumps(data['attributes']), model=model_name, provider="gemini", is_json=True)
                    except Exception as e:
                        print(f"[LLM Service] ⚠️ Erro ao guardar cache: {e}", file=sys.stderr)
                return data['attributes']
            else:
                print(f"[LLM Service] ⚠️ Resposta JSON do modelo '{model_name}' não tem o formato esperado.", file=sys.stderr)
                continue

        except Exception as e:
            print(f"[LLM Service] ⚠️ Falha ao usar o modelo '{model_name}': {e}", file=sys.stderr)
            continue # Tenta o próximo modelo da lista

    print("[LLM Service] ❌ Nenhum LLM (Ollama ou Gemini) funcionou. Usando fallback de análise de texto...", file=sys.stderr)
    return generate_attributes_fallback(idea, "Nenhum LLM funcionou.")

def generate_text_from_llm(prompt: str) -> str:
    """
    Função genérica para gerar texto livre (Documentação, Backlog, etc) usando o Gemini.
    """
    # Prioridade: local (Ollama) quando possível.
    llm_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:4b")


    # ✅ CACHE CHECK: Verificar cache antes de qualquer chamada ao LLM
    if CACHE_ENABLED:
        try:
            cached_response = CACHE.get(prompt, model=llm_provider, provider=llm_provider)
            if cached_response:
                print("[LLM Service] ✅ CACHE HIT! Usando resposta cacheada.", file=sys.stderr)
                return cached_response
        except Exception as e:
            print(f"[LLM Service] ⚠️ Erro ao acessar cache: {e}", file=sys.stderr)

    # Tentar com Ollama (local) primeiro quando disponível, exceto se forçado gemini
    should_try_ollama = OLLAMA_AVAILABLE and llm_provider in ("auto", "ollama")
    if should_try_ollama:
        try:
            result = generate_with_ollama(prompt, model=ollama_model, is_json=False)
            if result and not result.startswith("❌ ERRO:"): # Se o Ollama retornou algo válido
                if CACHE_ENABLED:
                    try:
                        CACHE.set(prompt, result, model=ollama_model, provider="ollama", is_json=False)
                    except Exception as e:
                        print(f"[LLM Service] ⚠️ Erro ao guardar cache: {e}", file=sys.stderr)
                return result
            else: # Ollama retornou vazio ou com erro interno
                print(f"[LLM Service] Ollama retornou vazio ou com erro. Usando Gemini como fallback...", file=sys.stderr)
        except Exception as e:
            print(f"[LLM Service] ❌ Erro ao chamar Ollama: {e}. Usando Gemini como fallback...", file=sys.stderr)

    # Se forçado a usar apenas Ollama e falhou, usar fallback local (sem Gemini)
    if llm_provider == "ollama":
        return generate_text_fallback(prompt, "Ollama falhou ou não retornou resposta válida.")

    # Tentar com Gemini se configurado e disponível

    if not GEMINI_API_KEY:
        return "⚠️ ERRO: Chave API do Gemini não configurada. O agente não pôde gerar o conteúdo."

    models_to_try = [ # A lista é a mesma da função de atributos para consistência
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
    ]
    if not genai.configure: # Verifica se a configuração do Gemini foi bem-sucedida
        print("[LLM Service] ⚠️ Configuração do Gemini falhou. Usando fallback...", file=sys.stderr)
        return generate_text_fallback(prompt, "Configuração do Gemini falhou.")

    for model_name in models_to_try:
        try:
            print(f"[LLM Service] Gerando texto com modelo: {model_name}...", file=sys.stderr)
            
            # Configuração para texto livre (criatividade moderada)
            generation_config = {
              "temperature": 0.7, 
            }
            
            model = genai.GenerativeModel(
                model_name,
                generation_config=generation_config
            )
            
            response = model.generate_content(prompt)
            
            # Verificação de segurança e conteúdo da resposta
            if response.prompt_feedback.block_reason:
                print(f"[LLM Service] ⚠️ Prompt bloqueado pelo modelo '{model_name}'. Razão: {response.prompt_feedback.block_reason.name}", file=sys.stderr)
                continue

            if response.candidates and response.candidates[0].content.parts:
                print(f"[LLM Service] ✅ Texto gerado com sucesso pelo modelo '{model_name}'!", file=sys.stderr)
                result = response.text
                # ✅ CACHE STORE: Guardar resultado após sucesso
                if CACHE_ENABLED:
                    try:
                        CACHE.set(prompt, result, model=model_name, provider="gemini", is_json=False)
                    except Exception as e:
                        print(f"[LLM Service] ⚠️ Erro ao guardar cache: {e}", file=sys.stderr)
                return result
            else:
                finish_reason = response.candidates[0].finish_reason.name if response.candidates else "UNKNOWN"
                print(f"[LLM Service] ⚠️ Resposta vazia do modelo '{model_name}'. Razão de finalização: {finish_reason}", file=sys.stderr)
                continue
            
        except Exception as e:
            print(f"[LLM Service] ⚠️ Falha ao gerar texto com '{model_name}': {e}", file=sys.stderr)
            continue
            
    print("[LLM Service] ❌ Nenhum LLM (Ollama ou Gemini) funcionou. Usando fallback de template...", file=sys.stderr)
    return generate_text_fallback(prompt, "Nenhum LLM funcionou.")