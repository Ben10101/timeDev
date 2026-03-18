# -*- coding: utf-8 -*-
import sys
import os
from datetime import datetime

# Garantir UTF-8 para saída (evitar reabrir handles no Windows, o que pode causar crash em processos com pipes)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
Requirements Analyst Agent
Análise detalhada de requisitos funcionais, não-funcionais e casos de uso
"""

from agents.developer.llm_service import generate_text_from_llm

class RequirementsAnalyst:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def process(self, idea, backlog):
        """Processa idea e backlog para gerar requisitos detalhados via IA"""
        
        prompt = f"""
        Atue como um Analista de Requisitos Sênior.
        Baseado na ideia e no backlog abaixo, crie uma Especificação de Requisitos detalhada.
        Você está refinando apenas UMA única história de usuário.
        Não amplie o escopo para o projeto inteiro.
        Não invente módulos adicionais, dashboards, importação em massa, histórico completo, relatórios ou funcionalidades de outras histórias.
        Restrinja a resposta ao comportamento necessário para a história selecionada.
        
        Ideia: "{idea}"
        
        Backlog Existente:
        {backlog}
        
        Gere o documento em formato Markdown contendo:
        # 📋 ESPECIFICAÇÃO DE REQUISITOS
        ## 🎯 História Refinada (repita apenas a história alvo)
        ## 🛡️ Requisitos Não-Funcionais (Performance, Segurança, Usabilidade)
        ## 📊 Casos de Uso Principais (Pelo menos 2 fluxos completos)
        
        Seja detalhista e técnico.
        Se o backlog trouxer apenas uma história, trate isso como limite rígido de escopo.
        """
        
        return generate_text_from_llm(prompt)
