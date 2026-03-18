import os
import sys

# Adiciona o diretório raiz ao path para permitir importações relativas se necessário
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

# Tenta importar o serviço de LLM compartilhado
try:
    from agents.developer.llm_service import generate_text_from_llm
except ImportError:
    # Fallback caso a importação direta falhe devido à estrutura de execução
    from ..developer.llm_service import generate_text_from_llm

def run(project_id, payload):
    """
    Executa o agente UI UX Specialist.
    
    Args:
        project_id (str): ID do projeto.
        payload (dict): Deve conter 'requirements' ou 'idea'.
    """
    print(f"[{project_id}] 🎨 Iniciando UI UX Specialist...", file=sys.stderr)

    requirements = payload.get('requirements', '')
    idea = payload.get('idea', '')
    
    # Carrega o prompt do sistema
    # Ajuste de path para sair de agents/ui_ux_specialist/ até prompts/
    prompt_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prompts', 'ui_ux_prompt.txt')
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()
    except FileNotFoundError:
        print(f"⚠️ Prompt file not found at {prompt_path}, using default.", file=sys.stderr)
        system_prompt = "Role: UI Generator Specialist. Output: JSON structure of the UI."

    # Monta o prompt final
    full_prompt = f"""
    {system_prompt}

    ---
    DADOS DE ENTRADA (Requisitos do Projeto):
    {requirements}
    
    Ideia Original:
    {idea}
    ---
    
    Gere o JSON da UI agora:
    """

    # Chama o LLM com o modelo específico 'meu-lowcode'
    ui_json = generate_text_from_llm(full_prompt, model='meu-lowcode')
    
    return ui_json